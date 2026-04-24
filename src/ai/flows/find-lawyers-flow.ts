'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { specialtyMap } from '@/lib/specialties';

export async function findLawyerSpecialties({ problem }: { problem: string }) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    if (!apiKey) throw new Error("API Key not found");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const specialtiesList = Object.keys(specialtyMap).join(', ');
    
    const prompt = `
      You are an AI legal assistant. Analyze the user's problem and map it to the most relevant legal specialties.
      
      User Problem: "${problem}"
      
      Available Specialties: [${specialtiesList}]
      
      Return a JSON object with a "specialties" array containing the most relevant specialties from the list above.
      Only use the exact strings from the provided list.
      
      Example Output:
      {
        "specialties": ["คดีแพ่งและพาณิชย์", "การผิดสัญญา"]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text) as { specialties: string[] };

  } catch (error) {
    console.error('Error in findLawyerSpecialties:', error);
    // Fallback to a general specialty if AI fails
    return { specialties: ['คดีแพ่งและพาณิชย์'] };
  }
}
