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

function isGenericDocumentRequest(message: string) {
  return /\b(?:analy[sz]e|summari[sz]e|review|explain|outline)\b.{0,80}\b(?:file|document|upload|notes?)\b/i.test(
    message,
  );
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
  let docs = await retriever.invoke(message);

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
