import "server-only";

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-004";
const LOCAL_EMBEDDING_MODEL = "local-hash-embedding-v1";
const LOCAL_EMBEDDING_DIM = 256;

let embeddings: GoogleGenerativeAIEmbeddings | null = null;

function getGoogleApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
}

export function getEmbeddingModelName() {
  return getGoogleApiKey()
    ? process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
    : LOCAL_EMBEDDING_MODEL;
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

function hashToken(token: string) {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function localEmbedding(text: string) {
  const vector = new Array<number>(LOCAL_EMBEDDING_DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);

  if (!tokens?.length) return vector;

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % LOCAL_EMBEDDING_DIM;
    vector[index] += hash % 2 === 0 ? 1 : -1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map((value) => value / magnitude) : vector;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  if (!getGoogleApiKey()) return texts.map(localEmbedding);

  return getEmbeddings().embedDocuments(texts);
}

export async function embedQuery(query: string) {
  if (!getGoogleApiKey()) return localEmbedding(query);

  return getEmbeddings().embedQuery(query);
}
