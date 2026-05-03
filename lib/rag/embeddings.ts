import "server-only";

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-004";

let embeddings: GoogleGenerativeAIEmbeddings | null = null;

function getGoogleApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
}

export function getEmbeddingModelName() {
  return process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export function getEmbeddings() {
  const apiKey = getGoogleApiKey();

  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY for Gemini embeddings.");
  }

  if (!embeddings) {
    embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: getEmbeddingModelName(),
      maxRetries: 2,
    });
  }

  return embeddings;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  return getEmbeddings().embedDocuments(texts);
}

export async function embedQuery(query: string) {
  return getEmbeddings().embedQuery(query);
}
