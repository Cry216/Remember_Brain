import { NextResponse } from "next/server";

import { retrieveRagContext } from "@/lib/rag/context";
import { getChatModel, modelContentToString } from "@/lib/rag/llm";

export const runtime = "nodejs";

type ChatRequestBody = {
  message?: unknown;
};

function buildPrompt(message: string, context: string) {
  const personalContext = context || "No relevant personal document chunks were found.";

  return `You are Remember Brain, a helpful personal second brain assistant.

Use the user's personal document context when it is relevant. You may also use general knowledge, but keep the boundary clear: do not invent facts from the user's documents.

If the personal context does not answer the question, say that briefly and then answer from general knowledge if useful.

<personal_document_context>
${personalContext}
</personal_document_context>

User message:
${message}

Answer naturally and cite document titles or file names when you rely on the personal context.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        {
          response: "Send me a question and I will search your second brain.",
          sources: [],
        },
        { status: 400 },
      );
    }

    const { context, sources } = await retrieveRagContext(message);
    const result = await getChatModel().invoke(buildPrompt(message, context));
    const response = modelContentToString(result.content);

    return NextResponse.json({
      response: response || "I could not generate a useful answer this time.",
      sources,
    });
  } catch (error) {
    console.error("Chat API error", { error });

    return NextResponse.json(
      {
        response: "Sorry, I could not search and answer right now.",
        sources: [],
      },
      { status: 500 },
    );
  }
}
