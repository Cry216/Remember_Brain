import "server-only";

import { createHash } from "node:crypto";

import { getPrisma } from "@/lib/prisma";

import { embedTexts, getEmbeddingModelName } from "./embeddings";
import { loadUploadedDocument, sanitizeFileName } from "./loaders";
import { logSecuritySignals, summarizeSecuritySignals } from "./security";
import { estimateTokenCount, splitLoadedDocument } from "./splitter";
import type { IngestDocumentInput, IngestDocumentResult } from "./types";

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function serializeEmbedding(embedding: number[]) {
  return JSON.stringify(embedding);
}

function serializeMetadata(metadata: Record<string, unknown>) {
  return JSON.stringify(metadata);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown document processing error.";
}

export async function ingestUploadedDocument(
  input: IngestDocumentInput,
): Promise<IngestDocumentResult> {
  const prisma = getPrisma();
  const fileChecksum = checksum(input.buffer);
  const fileName = sanitizeFileName(input.fileName);
  const existing = await prisma.document.findUnique({
    where: { checksum: fileChecksum },
  });

  if (existing?.status === "READY") {
    return {
      documentId: existing.id,
      title: existing.title,
      fileName: existing.fileName,
      chunkCount: existing.chunkCount,
      status: existing.status,
      skipped: true,
      securityWarnings: {
        total: 0,
        promptInjectionCount: 0,
        secretCount: 0,
        warnings: [],
      },
    };
  }

  const document = await prisma.document.upsert({
    where: { checksum: fileChecksum },
    update: {
      fileName,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: input.sizeBytes,
      status: "PROCESSING",
      error: null,
      chunkCount: 0,
    },
    create: {
      title: fileName.replace(/\.[^.]+$/, "") || fileName,
      fileName,
      mimeType: input.mimeType || "application/octet-stream",
      sourceType: "unknown",
      sizeBytes: input.sizeBytes,
      checksum: fileChecksum,
      status: "PROCESSING",
    },
  });

  try {
    const { loadedDocument, securitySignals } = await loadUploadedDocument({
      ...input,
      fileName,
    });
    const chunks = await splitLoadedDocument(loadedDocument);

    if (chunks.length === 0) {
      throw new Error("Document did not produce any searchable chunks.");
    }

    await logSecuritySignals(securitySignals, {
      eventType: "DOCUMENT_SCAN",
      action: "UPLOAD_INGESTION",
      source: loadedDocument.fileName,
      documentId: document.id,
    });

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
    const embeddingModel = getEmbeddingModelName();
    const securityWarnings = summarizeSecuritySignals(securitySignals);

    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding count did not match document chunk count.");
    }

    const records = chunks.map((chunk, index) => {
      const embedding = embeddings[index];

      if (!embedding || embedding.length === 0) {
        throw new Error(`Embedding failed for chunk ${index + 1}.`);
      }

      return {
        documentId: document.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: estimateTokenCount(chunk.content),
        embedding: serializeEmbedding(embedding),
        embeddingModel,
        embeddingDim: embedding.length,
        metadata: serializeMetadata(chunk.metadata),
      };
    });

    await prisma.$transaction([
      prisma.documentChunk.deleteMany({
        where: { documentId: document.id },
      }),
      prisma.documentChunk.createMany({
        data: records,
      }),
      prisma.document.update({
        where: { id: document.id },
        data: {
          title: loadedDocument.title,
          fileName: loadedDocument.fileName,
          mimeType: loadedDocument.mimeType,
          sourceType: loadedDocument.sourceType,
          chunkCount: records.length,
          status: "READY",
          error: null,
        },
      }),
    ]);

    return {
      documentId: document.id,
      title: loadedDocument.title,
      fileName: loadedDocument.fileName,
      chunkCount: records.length,
      status: "READY",
      skipped: false,
      securityWarnings,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Document ingestion failed", {
      documentId: document.id,
      fileName,
      error,
    });

    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        error: message,
      },
    });

    throw new Error(message);
  }
}
