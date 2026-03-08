'use server';
/**
 * @fileOverview A simple chat flow that uses the Gemini model with RAG.
 */

import { z } from 'zod';
import { initializeFirebase } from '@/firebase';
import { retrieveDocuments } from '@/lib/rag';
import { callTyphoonAI } from '@/lib/typhoon';
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType as GenAISchemaType, Content } from '@google/generative-ai';
import { collection, getDocs, limit, query } from 'firebase/firestore';

const searchArticlesDeclaration: FunctionDeclaration = {
  name: "searchArticles",
  description: "Search for relevant legal information from the knowledge base (PDFs and Articles).",
  parameters: {
    type: GenAISchemaType.OBJECT,
    properties: {
      query: {
        type: GenAISchemaType.STRING,
        description: "The search query to find relevant information.",
      },
    },
    required: ["query"],
  },
};

async function executeSearchArticles(queryStr: string) {
  console.log(`[searchArticlesTool] Searching for: ${queryStr}`);

  // 1. Search RAG (Cloudflare)
  let ragDocs: Array<{ source: string, content: string, score: number }> = [];
  try {
    const allDocs = await retrieveDocuments(queryStr);
    ragDocs = allDocs.filter(doc => doc.score > 0.6);
    console.log(`[searchArticlesTool] RAG found ${allDocs.length} docs, ${ragDocs.length} passed threshold.`);
  } catch (err) {
    console.error("RAG search failed:", err);
  }

  const results = [];

  if (ragDocs.length > 0) {
    ragDocs.forEach(doc => {
      results.push({
        title: "ข้อมูลจากเอกสารกฎหมาย (PDF)",
        content: doc.content
      });
    });
  } else {
    console.log("[searchArticlesTool] No relevant RAG docs. Asking Typhoon...");
    const typhoonResponse = await callTyphoonAI(queryStr);
    if (typhoonResponse) {
      results.push({
        title: "ข้อมูลความรู้ทั่วไป (จาก Typhoon AI)",
        content: typhoonResponse
      });
    }
  }

  return { results };
}

const ChatRequestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.array(z.object({ text: z.string() })),
    })
  ),
  prompt: z.string(),
  locale: z.string().optional(),
});

const ChatResponseSchema = z.object({
  sections: z.array(z.object({
    title: z.string().describe('The title of the section.'),
    content: z.string().describe('The content of the section.'),
    link: z.string().optional().describe('An optional URL for a call-to-action button.'),
    linkText: z.string().optional().describe('The text to display on the call-to-action button.'),
  })).describe('An array of sections to structure the response.'),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export async function chat(
  request: z.infer<typeof ChatRequestSchema>
): Promise<ChatResponse> {
  const { history, prompt, locale = 'th' } = request;

  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    if (!apiKey) {
      console.warn("[ChatFlow] No Google API Key found. Falling back to manual mode.");
      throw new Error("No API Key");
    }

    let languageInstruction = "Answer in Thai.";
    if (locale.startsWith('en')) {
      languageInstruction = "Answer in English. IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the English translation (e.g., 'Civil Code (ประมวลกฎหมายแพ่ง)').";
    }
    if (locale.startsWith('zh')) {
      languageInstruction = "Answer in Chinese (Simplified). IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the Chinese translation.";
    }

    let finalPrompt = `${prompt}\n\n[System Instruction: ${languageInstruction}]`;

    if (history && history.length > 0) {
      finalPrompt += `\n\n[System Note: This is a continuing conversation. Do NOT introduce yourself again. Do NOT say 'Hello' or 'Sawasdee'. Answer the question directly.]`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      tools: [{ functionDeclarations: [searchArticlesDeclaration] }],
      systemInstruction: `You are an AI legal assistant for Lawslane, a legal tech platform in Thailand.
Your role is to provide preliminary analysis and information, not definitive legal advice.

Always follow these steps:
1.  First, use the \`searchArticles\` tool to find relevant information.
2.  If the tool returns "Legal Documents (PDF)", treat this as high-confidence legal information. Base your answer primarily on this.
3.  If the tool returns "General Knowledge (Typhoon AI)", this means no specific legal document was found. Use this information to answer the user's question but explicitly state that it is general knowledge, not specific legal advice from the database.
4.  If no information is found at all, answer based on your own general knowledge.
5.  Always conclude your response by reminding the user that your analysis is for informational purposes only and they should consult with a qualified lawyer for formal advice.
6.  **Complex Legal Issues**: If the issue is complex and does not fit into the specific services above, advise the user to seek professional legal counsel from a specialized firm.
7.  **CRITICAL**: In the **very first response** of the conversation, you **MUST** introduce yourself as the AI assistant for Lawslane AND explicitly state that your advice is preliminary and not a substitute for a lawyer (Limitation of Liability).
8.  For all **subsequent messages** (after the first one), **DO NOT** introduce yourself, **DO NOT** say "Hello" or "Sawasdee", and **DO NOT** repeat the disclaimer. Answer the user's question directly and immediately.

Output MUST be a valid JSON object matching this structure:
{
  "sections": [
    {
      "title": "Section Title",
      "content": "Section Content",
      "link": "Optional URL",
      "linkText": "Optional Link Text"
    }
  ]
}
`,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const formattedHistory: Content[] = history ? history.map(h => ({
      role: h.role,
      parts: h.content.map(c => ({ text: c.text }))
    })) : [];

    const chatSession = model.startChat({
      history: formattedHistory,
    });

    let result = await chatSession.sendMessage(finalPrompt);

    // Handle function calls if any
    if (result.response.functionCalls()) {
      const calls = result.response.functionCalls();
      for (const call of calls || []) {
        if (call.name === "searchArticles") {
          const args = call.args as { query: string };
          const toolResult = await executeSearchArticles(args.query);
          result = await chatSession.sendMessage([{
            functionResponse: {
              name: "searchArticles",
              response: toolResult
            }
          }]);
        }
      }
    }

    const text = result.response.text();
    return JSON.parse(text) as ChatResponse;

  } catch (error) {
    console.error("[ChatFlow] AI generation failed:", error);
    return await fallbackChat(prompt, locale);
  }
}

async function fallbackChat(prompt: string, locale: string = 'th'): Promise<ChatResponse> {
  console.log("[ChatFlow] Running fallback chat logic...");
  try {
    const { firestore } = initializeFirebase();

    let languageInstruction = "ตอบเป็นภาษาไทย";
    if (locale.startsWith('en')) {
      languageInstruction = "Answer in English. IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the English translation (e.g., 'Civil Code (ประมวลกฎหมายแพ่ง)').";
    }
    if (locale.startsWith('zh')) {
      languageInstruction = "Answer in Chinese (Simplified). IMPORTANT: For any specific legal terms, laws, or sensitive legal advice, you MUST provide the original Thai text alongside the Chinese translation.";
    }

    const t = {
      th: {
        greetingTitle: "สวัสดีครับ (โหมดสำรอง)",
        greetingContent: "สวัสดีครับ! ผมคือผู้ช่วย AI (ในโหมดสำรอง) ผมสามารถช่วยค้นหาข้อมูลกฎหมายและธุรกิจเบื้องต้นได้ครับ ลองพิมพ์คำถาม เช่น 'จดบริษัท', 'ภาษี', หรือ 'สัญญา' ได้เลยครับ",
        knowledgeTitle: "ข้อมูลจากฐานความรู้ (โหมดสำรอง)",
        knowledgeIntro: (terms: string) => `จากการค้นหาคำว่า "${terms}" พบข้อมูลที่เกี่ยวข้องดังนี้ครับ:`,
        relatedInfo: "ข้อมูลที่เกี่ยวข้อง",
        article: "บทความ",
        adviceTitle: "คำแนะนำเพิ่มเติม",
        adviceContent: "ข้อมูลข้างต้นเป็นเพียงการค้นหาเบื้องต้น แนะนำให้ศึกษาเพิ่มเติมหรือปรึกษาผู้เชี่ยวชาญครับ",
        findLawyer: "ดูบริการของเรา",
        typhoonTitle: "คำตอบจาก AI (Typhoon)",
        typhoonAdviceTitle: "คำแนะนำ",
        typhoonAdviceContent: "คำตอบนี้สร้างโดย AI อาจไม่ครอบคลุมรายละเอียดกฎหมายทั้งหมด แนะนำให้ใช้เป็นข้อมูลอ้างอิงเบื้องต้น",
        consultLawyerTitle: "แนะนำบริการ",
        consultLawyerContent: (p: string) => `สำหรับหัวข้อ "${p}" แนะนำให้ใช้บริการจัดการสัญญาหรือบริการจดทะเบียนธุรกิจของเราเพื่อความรัดกุมครับ`,
        consultLawyerBtn: "ดูบริการทั้งหมด",
        errorTitle: "ระบบขัดข้องชั่วคราว",
        errorContent: (msg: string) => `ขออภัยครับ ไม่สามารถเข้าถึงข้อมูลได้ในขณะนี้ (${msg})`
      },
      en: {
        greetingTitle: "Hello (Backup Mode)",
        greetingContent: "Hello! I am the AI Assistant (in backup mode). I can help you find preliminary legal and business information. Try typing keywords like 'Registration', 'Tax', or 'Contract'.",
        knowledgeTitle: "Knowledge Base Results (Backup Mode)",
        knowledgeIntro: (terms: string) => `Based on your search for "${terms}", here is the relevant information found:`,
        relatedInfo: "Related Information",
        article: "Article",
        adviceTitle: "Additional Advice",
        adviceContent: "The information above is a preliminary search. We recommend further research or consulting a professional.",
        findLawyer: "View Our Services",
        typhoonTitle: "Answer from AI (Typhoon)",
        typhoonAdviceTitle: "Advice",
        typhoonAdviceContent: "This answer was generated by AI and may not cover all legal details. Please use it as preliminary information.",
        consultLawyerTitle: "Our Services",
        consultLawyerContent: (p: string) => `Regarding "${p}", we recommend checking our contract or registration services for more comprehensive solutions.`,
        consultLawyerBtn: "View All Services",
        errorTitle: "Temporary System Error",
        errorContent: (msg: string) => `Sorry, we cannot access the data at this time (${msg}).`
      },
      zh: {
        greetingTitle: "你好 (备份模式)",
        greetingContent: "你好！我是 AI 助手（备份模式）。我可以帮助您寻找初步的法律和业务信息。尝试输入关键词，如“注册”、“税务”或“合同”。",
        knowledgeTitle: "知识库结果 (备份模式)",
        knowledgeIntro: (terms: string) => `根据您搜索的 "${terms}"，以下是找到的相关信息：`,
        relatedInfo: "相关信息",
        article: "文章",
        adviceTitle: "额外建议",
        adviceContent: "以上信息仅为初步搜索结果。我们建议进一步研究或咨询专业人士。",
        findLawyer: "查看我们的服务",
        typhoonTitle: "AI 回答 (Typhoon)",
        typhoonAdviceTitle: "建议",
        typhoonAdviceContent: "此回答由 AI 生成，可能不涵盖所有法律细节。请将其作为初步信息使用。",
        consultLawyerTitle: "我们的服务",
        consultLawyerContent: (p: string) => `关于“${p}”，我们建议查看我们的合同或注册服务以获得更全面的解决方案。`,
        consultLawyerBtn: "查看所有服务",
        errorTitle: "系统暂时故障",
        errorContent: (msg: string) => `抱歉，我们目前无法访问数据 (${msg})。`
      }
    };

    const strings = locale.startsWith('en') ? t.en : (locale.startsWith('zh') ? t.zh : t.th);

    if (!firestore) throw new Error("Firestore not initialized");
    const articlesRef = collection(firestore, 'articles');
    const q = query(articlesRef, limit(20));
    const snapshot = await getDocs(q);

    const articles = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        content: data.content || '',
      };
    });

    const lowerCaseQuery = prompt.toLowerCase();

    const greetings = ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ทักทาย', '你好'];
    if (greetings.some(g => lowerCaseQuery.includes(g))) {
      return {
        sections: [{
          title: strings.greetingTitle,
          content: strings.greetingContent
        }]
      };
    }

    const cleanPrompt = lowerCaseQuery
      .replace(/^(คดี|กฎหมาย|เรื่อง|การ|ความ|ข้อหา)/, '')
      .trim();

    const searchTerms = cleanPrompt.split(/\s+/).filter(w => w.length > 1);
    if (cleanPrompt !== lowerCaseQuery) {
      searchTerms.push(lowerCaseQuery);
    }

    const relevantArticles = articles
      .filter(article => {
        const title = article.title.toLowerCase();
        const content = article.content.toLowerCase();
        return searchTerms.some(term => title.includes(term) || content.includes(term));
      })
      .slice(0, 3);

    const sections = [];

    let ragDocs: Array<{ source: string, content: string, score: number }> = [];
    try {
      const allDocs = await retrieveDocuments(cleanPrompt);
      ragDocs = allDocs.filter(doc => doc.score > 0.6);
      console.log(`[ChatFlow] RAG found ${allDocs.length} docs, ${ragDocs.length} passed threshold.`);
    } catch (err) {
      console.error("Fallback RAG search failed:", err);
    }

    if (relevantArticles.length > 0 || ragDocs.length > 0) {
      sections.push({
        title: strings.knowledgeTitle,
        content: strings.knowledgeIntro(searchTerms.join('", "'))
      });

      if (ragDocs.length > 0) {
        ragDocs.forEach((doc, index) => {
          const cleanContent = doc.content.trim();
          if (cleanContent) {
            sections.push({
              title: `${strings.relatedInfo} (${index + 1})`,
              content: cleanContent
            });
          }
        });
      }

      relevantArticles.forEach(article => {
        sections.push({
          title: `${strings.article}: ${article.title}`,
          content: article.content.substring(0, 300) + "..."
        });
      });

      sections.push({
        title: strings.adviceTitle,
        content: strings.adviceContent,
        link: "/services/contracts",
        linkText: strings.findLawyer
      });
    } else {
      console.log("[ChatFlow] No RAG results, asking Typhoon...");
      const typhoonResponse = await callTyphoonAI(prompt, languageInstruction);

      if (typhoonResponse) {
        sections.push({
          title: strings.typhoonTitle,
          content: typhoonResponse
        });
        sections.push({
          title: strings.typhoonAdviceTitle,
          content: strings.typhoonAdviceContent,
          link: "/lawyers",
          linkText: strings.consultLawyerBtn
        });
      } else {
        sections.push({
          title: strings.consultLawyerTitle,
          content: strings.consultLawyerContent(prompt),
          link: "/lawyers",
          linkText: strings.findLawyer
        });
      }
    }

    return { sections };
  } catch (error: any) {
    console.error("[ChatFlow] Fallback logic failed:", error);
    const errorMsg = locale.startsWith('en')
      ? `Sorry, we cannot access the database at this time (${error?.message || 'Unknown Error'}). Please try again.`
      : (locale.startsWith('zh')
        ? `抱歉，我们目前无法访问数据库 (${error?.message || 'Unknown Error'})。请重试。`
        : `ขออภัยครับ ไม่สามารถเข้าถึงฐานข้อมูลได้ในขณะนี้ (${error?.message || 'Unknown Error'}) กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่`);

    return {
      sections: [
        {
          title: "System Error",
          content: errorMsg
        }
      ]
    };
  }
}
