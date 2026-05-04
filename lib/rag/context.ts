import "server-only";

import { Document } from "@langchain/core/documents";

import { getPrisma } from "@/lib/prisma";

import { escapePromptText, prepareUntrustedContextForPrompt } from "./security";
import { createSQLiteRetriever } from "./vector-store";
import type { RagMetadata, RagSource } from "./types";

type RetrievedMetadata = {
  chunkId?: string;
  documentId?: string;
  documentTitle?: string;
  fileName?: string;
  chunkIndex?: number;
  score?: number;
};

function toRetrievedMetadata(metadata: Record<string, unknown>): RetrievedMetadata {
  return {
    chunkId: typeof metadata.chunkId === "string" ? metadata.chunkId : undefined,
    documentId: typeof metadata.documentId === "string" ? metadata.documentId : undefined,
    documentTitle:
      typeof metadata.documentTitle === "string" ? metadata.documentTitle : undefined,
    fileName: typeof metadata.fileName === "string" ? metadata.fileName : undefined,
    chunkIndex: typeof metadata.chunkIndex === "number" ? metadata.chunkIndex : undefined,
    score: typeof metadata.score === "number" ? metadata.score : undefined,
  };
}

function parseChunkMetadata(serialized: string | null): RagMetadata {
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

function isGenericDocumentRequest(message: string) {
  return /\b(?:analy[sz]e|summari[sz]e|review|explain|outline)\b.{0,80}\b(?:file|document|upload|notes?)\b/i.test(
    message,
  );
}

const KEYWORD_SEARCH_STOP_WORDS = new Set([
  "about",
  "answer",
  "could",
  "document",
  "documents",
  "file",
  "files",
  "find",
  "give",
  "help",
  "info",
  "information",
  "into",
  "like",
  "look",
  "need",
  "please",
  "saved",
  "search",
  "show",
  "that",
  "the",
  "this",
  "want",
  "what",
  "where",
  "with",
  "would",
  "write",
]);

const KEYWORD_SEARCH_LIMIT = 1000;
const KEYWORD_MIN_SCORE = 0.12;

function extractKeywordTerms(query: string) {
  const quotedTerms = Array.from(
    query.matchAll(/["']([^"']{2,100})["']/g),
    (match) => match[1],
  );
  const wordTerms =
    query
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((word) => word.length > 2 && !KEYWORD_SEARCH_STOP_WORDS.has(word)) ?? [];

  return Array.from(
    new Set(
      [...quotedTerms, ...wordTerms]
        .map((term) => term.toLocaleLowerCase().replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  ).slice(0, 16);
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1 && count < 8) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

function scoreKeywordMatch(
  query: string,
  chunk: {
    content: string;
    document: {
      title: string;
      fileName: string;
    };
  },
) {
  const terms = extractKeywordTerms(query);

  if (terms.length === 0) return 0;

  const content = chunk.content.toLocaleLowerCase();
  const titleAndFile = `${chunk.document.title} ${chunk.document.fileName}`.toLocaleLowerCase();
  let matchedTerms = 0;
  let weightedHits = 0;

  for (const term of terms) {
    const contentHits = countOccurrences(content, term);
    const titleHits = countOccurrences(titleAndFile, term);

    if (contentHits > 0 || titleHits > 0) {
      matchedTerms += 1;
      weightedHits += Math.min(contentHits, 4);
      weightedHits += Math.min(titleHits, 2) * 0.7;
    }

    if (term.includes(" ") && contentHits > 0) {
      weightedHits += 2;
    }
  }

  const coverageScore = matchedTerms / terms.length;
  const hitScore = Math.min(1, weightedHits / Math.max(3, terms.length * 2));
  const normalizedQuery = query.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const exactQueryBonus =
    normalizedQuery.length > 10 && content.includes(normalizedQuery) ? 0.15 : 0;

  return Math.min(0.95, coverageScore * 0.62 + hitScore * 0.33 + exactQueryBonus);
}

async function getKeywordDocumentChunks(query: string, k: number) {
  if (extractKeywordTerms(query).length === 0) return [];

  const prisma = getPrisma();
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        status: "READY",
      },
    },
    include: {
      document: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: KEYWORD_SEARCH_LIMIT,
  });

  return chunks
    .map((chunk) => ({
      chunk,
      score: scoreKeywordMatch(query, chunk),
    }))
    .filter(({ score }) => score >= KEYWORD_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(
      ({ chunk, score }) =>
        new Document<RagMetadata>({
          pageContent: chunk.content,
          metadata: {
            ...parseChunkMetadata(chunk.metadata),
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentTitle: chunk.document.title,
            fileName: chunk.document.fileName,
            chunkIndex: chunk.chunkIndex,
            score,
            retrievalMode: "keyword",
          },
        }),
    );
}

function retrievedDocumentKey(doc: Document<RagMetadata>) {
  const metadata = toRetrievedMetadata(doc.metadata);

  return metadata.documentId && typeof metadata.chunkIndex === "number"
    ? `${metadata.documentId}-${metadata.chunkIndex}`
    : undefined;
}

function retrievedDocumentScore(doc: Document<RagMetadata>) {
  const metadata = toRetrievedMetadata(doc.metadata);

  return metadata.score ?? 0;
}

function mergeRetrievedDocuments(docs: Document<RagMetadata>[], k: number) {
  const seen = new Set<string>();
  const merged: Document<RagMetadata>[] = [];

  for (const doc of docs.sort((a, b) => retrievedDocumentScore(b) - retrievedDocumentScore(a))) {
    const key = retrievedDocumentKey(doc);

    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    merged.push(doc);
    if (merged.length >= k) break;
  }

  return merged;
}

function promptAttribute(value: string) {
  return escapePromptText(value).replace(/"/g, "&quot;");
}

async function getRecentDocumentChunks(k: number) {
  const prisma = getPrisma();
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        status: "READY",
      },
    },
    include: {
      document: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: k,
  });

  return chunks.map(
    (chunk) =>
      new Document<RagMetadata>({
        pageContent: chunk.content,
        metadata: {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.document.title,
          fileName: chunk.document.fileName,
          chunkIndex: chunk.chunkIndex,
          score: 0,
          retrievalMode: "recent",
        },
      }),
  );
}

export async function retrieveRagContext(
  message: string,
  k = 5,
  options: { allowSensitive?: boolean } = {},
) {
  const retriever = createSQLiteRetriever({ k });
  const semanticDocs = await retriever.invoke(message);
  const keywordDocs = await getKeywordDocumentChunks(message, k);
  let docs = mergeRetrievedDocuments([...semanticDocs, ...keywordDocs], k);

  if (docs.length === 0 && isGenericDocumentRequest(message)) {
    docs = await getRecentDocumentChunks(k);
  }

  const context = docs
    .map((doc, index) => {
      const metadata = toRetrievedMetadata(doc.metadata);
      const title = metadata.documentTitle || "Untitled document";
      const chunkIndex =
        typeof metadata.chunkIndex === "number" ? String(metadata.chunkIndex + 1) : "unknown";
      const safeContent = prepareUntrustedContextForPrompt(doc.pageContent, {
        allowSensitive: options.allowSensitive === true,
      });

      return `<source id="${index + 1}" title="${promptAttribute(title)}" file="${promptAttribute(
        metadata.fileName || "unknown",
      )}" chunk="${chunkIndex}">\n${safeContent}\n</source>`;
    })
    .join("\n\n");

  const sources: RagSource[] = docs
    .map((doc) => {
      const metadata = toRetrievedMetadata(doc.metadata);

      if (
        !metadata.documentId ||
        !metadata.documentTitle ||
        !metadata.fileName ||
        typeof metadata.chunkIndex !== "number" ||
        typeof metadata.score !== "number"
      ) {
        return null;
      }

      return {
        documentId: metadata.documentId,
        title: metadata.documentTitle,
        fileName: metadata.fileName,
        chunkIndex: metadata.chunkIndex,
        score: metadata.score,
      };
    })
    .filter((source): source is RagSource => source !== null);

  return {
    context,
    sources,
  };
}
