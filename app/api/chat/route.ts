// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message || !message.trim()) {
            return NextResponse.json({ response: "Write something 🙂" });
        }

        const result = await model.invoke(
            `You are Remember Brain — a friendly, intelligent, and helpful Personal Second Brain.

You help the user remember, organize, think, and develop their knowledge.
Always respond in clear, natural, and professional English.
Be concise, useful, and slightly witty when appropriate.

User: ${message}

Your response:`
        );

        return NextResponse.json({ response: result.content });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({
            response: "Sorry, something went wrong... Try again."
        });
    }
}