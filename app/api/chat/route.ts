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
      `You are Remember Brain — a friendly and intelligent Personal Second Brain.
User: ${message}
Answer in natural English:`
    );

    return NextResponse.json({ response: result.content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ response: "Sorry, something went wrong..." });
  }
}
