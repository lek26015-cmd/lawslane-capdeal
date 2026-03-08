import { NextRequest, NextResponse } from 'next/server';
import {
    verifyLineSignature,
    replyMessage,
    getImageContent,
    formatChatResponseToFlex,
    formatContractToFlex,
    createWelcomeMessage,
    type LineWebhookBody,
    type LineWebhookEvent,
    type LineMessage,
} from '@/lib/line';
import { chat } from '@/ai/flows/chat-flow';

const LIFF_URL = process.env.NEXT_PUBLIC_LIFF_ID
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : undefined;

/**
 * LINE Webhook endpoint
 * Receives events from LINE Platform and responds accordingly
 */
export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('x-line-signature');

        // Verify signature
        if (!signature || !verifyLineSignature(bodyText, signature)) {
            console.error('[LINE Webhook] Invalid signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const body: LineWebhookBody = JSON.parse(bodyText);

        // Process events in parallel
        await Promise.all(
            body.events.map((event) => handleEvent(event))
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[LINE Webhook] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Also handle GET for webhook URL verification
export async function GET() {
    return NextResponse.json({ status: 'ok' });
}

async function handleEvent(event: LineWebhookEvent): Promise<void> {
    // Skip events without reply token (e.g., unfollow)
    if (!event.replyToken) return;

    try {
        switch (event.type) {
            case 'follow':
                await handleFollow(event);
                break;
            case 'message':
                if (event.message?.type === 'text') {
                    await handleTextMessage(event);
                } else if (event.message?.type === 'image') {
                    await handleImageMessage(event);
                } else {
                    await replyMessage(event.replyToken, [{
                        type: 'text',
                        text: 'ขอโทษครับ ตอนนี้รองรับแค่ข้อความและรูปภาพเท่านั้น\n\n💬 พิมพ์คำถามกฎหมาย\n📸 ส่งรูปแชท → สร้างสัญญา',
                    }]);
                }
                break;
            default:
                break;
        }
    } catch (error) {
        console.error('[LINE Webhook] Error handling event:', error);
        // Try to send error message
        if (event.replyToken) {
            try {
                await replyMessage(event.replyToken, [{
                    type: 'text',
                    text: 'ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
                }]);
            } catch {
                // Ignore error in error handler
            }
        }
    }
}

/**
 * Handle follow event — send welcome message
 */
async function handleFollow(event: LineWebhookEvent): Promise<void> {
    const welcome = createWelcomeMessage(LIFF_URL);
    await replyMessage(event.replyToken!, [welcome]);
}

/**
 * Handle text message — AI chat
 */
async function handleTextMessage(event: LineWebhookEvent): Promise<void> {
    const userMessage = event.message?.text || '';

    if (!userMessage.trim()) {
        await replyMessage(event.replyToken!, [{
            type: 'text',
            text: 'กรุณาพิมพ์คำถามหรือส่งรูปแชทมาครับ 💬',
        }]);
        return;
    }

    // Call the existing AI chat flow
    const response = await chat({
        history: [],
        prompt: userMessage,
        locale: 'th',
    });

    // Format and send response
    const messages: LineMessage[] = [];

    if (response.sections && response.sections.length > 0) {
        messages.push(formatChatResponseToFlex(response, LIFF_URL));
    } else {
        messages.push({
            type: 'text',
            text: 'ขออภัยครับ ไม่สามารถประมวลผลคำถามของคุณได้ กรุณาลองใหม่อีกครั้ง',
        });
    }

    await replyMessage(event.replyToken!, messages);
}

/**
 * Handle image message — Cap Deal (screenshot → contract)
 */
async function handleImageMessage(event: LineWebhookEvent): Promise<void> {
    const messageId = event.message?.id;
    if (!messageId) return;

    // Send a "processing" message first (using replyToken)
    // Note: We only get one replyToken per event, so we process inline

    try {
        // Download image from LINE
        const imageBase64 = await getImageContent(messageId);

        // Call the contract draft API logic directly
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
        if (!apiKey) throw new Error('API Key not found');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: 'application/json' },
        });

        const prompt = `
      You are a legal AI assistant. Analyze the screenshot(s) of a chat conversation between a craftsman/freelancer and a customer.
      Extract the following information to draft a simple agreement.
      
      IMPORTANT: You must output all values in the Thai language.
      
      CRITICAL RULES FOR EMPTY FIELDS:
      - If you cannot find a piece of information, return an EMPTY STRING (""), NOT a placeholder like "ไม่ระบุ"
      - NEVER include labels like "ผู้ว่าจ้าง" or "ผู้รับจ้าง" in the values - only return actual names
      
      CRITICAL CONTEXT FOR IDENTIFYING PARTIES:
      - The person who ASKS someone to do work = EMPLOYER (ผู้ว่าจ้าง)
      - The person who is ASKED to do work = CONTRACTOR (ผู้รับจ้าง)
      
      Output strictly in JSON format:
      {
        "employer": "string",
        "contractor": "string",
        "task": "string",
        "price": number,
        "deposit": number,
        "deadline": "string",
        "paymentTerms": "string",
        "missingInfo": ["string"],
        "riskyTerms": ["string"]
      }
    `;

        // Parse base64 image
        let mimeType = 'image/jpeg';
        let data = imageBase64;
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (matches && matches[1] && matches[2]) {
                mimeType = matches[1];
                data = matches[2];
            }
        }

        const result = await model.generateContent([
            prompt,
            { inlineData: { data, mimeType } },
        ]);

        if (!result?.response) throw new Error('No response from AI');

        const contractData = JSON.parse(result.response.text());
        const flexMessage = formatContractToFlex(contractData, LIFF_URL);

        await replyMessage(event.replyToken!, [
            {
                type: 'text',
                text: '📋 วิเคราะห์รูปแชทเรียบร้อยแล้วครับ!',
            },
            flexMessage,
        ]);
    } catch (error: any) {
        console.error('[LINE Webhook] Image processing error:', error);
        await replyMessage(event.replyToken!, [{
            type: 'text',
            text: '❌ ไม่สามารถวิเคราะห์รูปได้ครับ กรุณาลองส่งรูปใหม่อีกครั้ง\n\nTips:\n• ส่งรูป screenshot แชทที่ชัดเจน\n• ตรวจสอบว่ามีข้อความสนทนาในรูป',
        }]);
    }
}
