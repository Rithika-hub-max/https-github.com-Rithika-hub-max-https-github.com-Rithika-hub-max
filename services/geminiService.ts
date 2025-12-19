
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AgentActionType, AgentAction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const determineAction = async (query: string): Promise<AgentAction> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the user's intent and decide which action to take:
    - ANSWER: For simple questions or facts.
    - SUMMARIZE: If the user explicitly asks for a summary or to "explain briefly".
    - CATEGORIZE: If the user asks to "group", "theme", or "categorize" findings.
    - REPORT: If the user asks for a "detailed analysis", "research report", or "deep dive".

    User Query: "${query}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: Object.values(AgentActionType),
          },
          reasoning: {
            type: Type.STRING,
            description: "A short explanation of why this action was chosen."
          }
        },
        required: ["type", "reasoning"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return { type: AgentActionType.ANSWER, reasoning: "Defaulting to basic answer." };
  }
};

export const generateResponse = async (
  query: string,
  action: AgentAction,
  context: string,
  systemInstruction: string
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Action Type: ${action.type}
      Reasoning: ${action.reasoning}
      Retrieved Context:
      ---
      ${context}
      ---
      User Query: ${query}
    `,
    config: {
      systemInstruction,
      temperature: 0.7,
    }
  });

  return response.text || "I'm sorry, I couldn't process that request.";
};
