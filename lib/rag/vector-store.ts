import "server-only";

import { Document } from "@langchain/core/documents";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";

import { getPrisma } from "@/lib/prisma";

import { embedQuery } from "./embeddings";
import type { RagMetadata, SearchResult } from "./types";

type SemanticSearchOptions = {
  k?: number;
  minScore?: number;
};

type SQLiteVectorRetrieverInput = BaseRetrieverInput & SemanticSearchOptions;

const DEFAULT_K = 5;
const DEFAULT_MIN_SCORE = 0.15;

function parseEmbedding(serialized: string) {
  const parsed: unknown = JSON.parse(serialized);

  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "number")) {
    throw new Error("Stored embedding is not a numeric vector.");
  }

  return parsed;
}

function parseMetadata(serialized: string | null): RagMetadata {
  if (!serialized) return {};

  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed).flatMap(([key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        return [[key, value]];
      }

      return [];
    }),
  );
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (!normA || !normB) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function semanticSearch(query: string, options: SemanticSearchOptions = {}) {
  const k = options.k ?? DEFAULT_K;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const queryEmbedding = await embedQuery(query);

  if (queryEmbedding.length === 0) return [];

  const prisma = getPrisma();
  const chunks = await prisma.documentChunk.findMany({
    where: {
      embeddingDim: queryEmbedding.length,
      document: {
        status: "READY",
      },
    },
    include: {
      document: true,
    },
  });

  return chunks
    .map<SearchResult | null>((chunk) => {
      try {
        const embedding = parseEmbedding(chunk.embedding);
        const score = cosineSimilarity(queryEmbedding, embedding);

        if (!Number.isFinite(score) || score < minScore) return null;

        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.document.title,
          fileName: chunk.document.fileName,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score,
          metadata: parseMetadata(chunk.metadata),
        };
      } catch (error) {
        console.error("Failed to score document chunk", { chunkId: chunk.id, error });
        return null;
      }
    })
    .filter((result): result is SearchResult => result !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export class SQLiteVectorRetriever extends BaseRetriever<RagMetadata> {
  lc_namespace = ["remember-brain", "rag", "sqlite-retriever"];

  private k: number;
  private minScore: number;

  constructor(fields: SQLiteVectorRetrieverInput = {}) {
    super(fields);
    this.k = fields.k ?? DEFAULT_K;
    this.minScore = fields.minScore ?? DEFAULT_MIN_SCORE;
  }

  async _getRelevantDocuments(query: string) {
    const results = await semanticSearch(query, {
      k: this.k,
      minScore: this.minScore,
    });

    return results.map(
      (result) =>
        new Document<RagMetadata>({
          pageContent: result.content,
          metadata: {
            ...result.metadata,
            chunkId: result.chunkId,
            documentId: result.documentId,
            documentTitle: result.documentTitle,
            fileName: result.fileName,
            chunkIndex: result.chunkIndex,
            score: result.score,
          },
        }),
    );
  }
}

export function createSQLiteRetriever(options: SemanticSearchOptions = {}) {
  return new SQLiteVectorRetriever(options);
}
