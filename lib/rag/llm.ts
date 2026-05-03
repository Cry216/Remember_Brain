import "server-only";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

let chatModel: ChatGoogleGenerativeAI | null = null;

function getGoogleApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
}

export function hasChatModelApiKey() {
  return Boolean(getGoogleApiKey());
}

export function getChatModelName() {
  return process.env.GEMINI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
}

export function getChatModel() {
  const apiKey = getGoogleApiKey();

  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY for Gemini chat.");
  }

  if (!chatModel) {
    chatModel = new ChatGoogleGenerativeAI({
      apiKey,
      model: getChatModelName(),
      temperature: 0.6,
      maxRetries: 2,
    });
  }

  return chatModel;
}

export function modelContentToString(content: unknown) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}
