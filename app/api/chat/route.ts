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
            return NextResponse.json({ response: "Напиши что-нибудь 🙂" });
        }

        const result = await model.invoke(
            `Ты — Remember Brain, дружелюбный и умный персональный Second Brain.

Пользователь: ${message}

Отвечай естественно и по делу:`
        );

        return NextResponse.json({ response: result.content });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({
            response: "Извини, что-то пошло не так... Попробуй ещё раз."
        });
    }
}