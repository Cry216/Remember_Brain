import "server-only";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import type { LoadedDocument, PreparedChunk, RagMetadata } from "./types";

const DEFAULT_CHUNK_SIZE = 1600;
const DEFAULT_CHUNK_OVERLAP = 220;

function getSplitter(sourceType: LoadedDocument["sourceType"]) {
  if (sourceType === "md") {
    return RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    });
  }

  return new RecursiveCharacterTextSplitter({
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    separators: ["\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""],
  });
}

function estimateTokenCount(content: string) {
  return Math.ceil(content.length / 4);
}

function normalizeChunkMetadata(metadata: Record<string, unknown>): RagMetadata {
  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
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

export async function splitLoadedDocument(document: LoadedDocument) {
  const splitter = getSplitter(document.sourceType);
  const docs = await splitter.createDocuments([document.text], [document.metadata]);

  return docs
    .map<PreparedChunk>((doc, index) => ({
      chunkIndex: index,
      content: doc.pageContent.trim(),
      metadata: {
        ...normalizeChunkMetadata(doc.metadata),
        chunkIndex: index,
        estimatedTokens: estimateTokenCount(doc.pageContent),
      },
    }))
    .filter((chunk) => chunk.content.length > 0);
}

export { estimateTokenCount };
