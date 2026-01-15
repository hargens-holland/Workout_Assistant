import { GoogleGenerativeAI } from "@google/generative-ai";
import { ModelRole } from "./types";

/**
 * Generate text using Gemini LLM
 * @param messages - Array of messages with role and content
 * @param modelRole - Optional role/context for the model (e.g., system instructions)
 * @returns The generated text response
 */
export async function generateText({
    messages,
    modelRole,
}: {
    messages: Array<{ role: string; content: string }>;
    modelRole?: ModelRole;
}): Promise<string> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-001",
        generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            responseMimeType: "application/json",
        },
    });

    // Convert messages array to a single prompt string
    // Preserve existing behavior by concatenating user messages
    const userMessages = messages
        .filter((msg) => msg.role === "user")
        .map((msg) => msg.content);

    let prompt = userMessages.join("\n\n");

    // If modelRole is provided, prepend it to the prompt
    if (modelRole) {
        prompt = `${modelRole}\n\n${prompt}`;
    }

    const result = await model.generateContent(prompt);
    return result.response.text();
}
