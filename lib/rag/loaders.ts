import "server-only";

import { Document } from "@langchain/core/documents";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";

import {
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  type IngestDocumentInput,
  type LoadedDocument,
  type RagMetadata,
  type SupportedSourceType,
} from "./types";
import { sanitizeUploadedText, type SecuritySignal } from "./security";

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function inferSourceType(fileName: string, mimeType: string): SupportedSourceType | null {
  const extension = getFileExtension(fileName);

  if (mimeType === "application/pdf" || extension === ".pdf") return "pdf";
  if (extension === ".md" || mimeType.includes("markdown")) return "md";
  if (extension === ".docx" || mimeType.includes("wordprocessingml")) return "docx";
  if (extension === ".txt" || mimeType === "text/plain") return "txt";

  return null;
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || fileName;
}

function toLangChainDocument(loadedDocument: LoadedDocument) {
  return new Document<RagMetadata>({
    pageContent: loadedDocument.text,
    metadata: loadedDocument.metadata,
  });
}

function bufferToBlob(buffer: Buffer, mimeType: string) {
  return new Blob([new Uint8Array(buffer)], {
    type: mimeType || "application/octet-stream",
  });
}

function startsWith(buffer: Buffer, signature: string) {
  return buffer.subarray(0, signature.length).toString("latin1") === signature;
}

function looksLikePlainText(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.length === 0) return false;

  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      suspicious += 1;
    }
  }

  return suspicious / sample.length < 0.02;
}

function assertContentSignature(sourceType: SupportedSourceType, buffer: Buffer) {
  if (sourceType === "pdf" && !startsWith(buffer, "%PDF-")) {
    throw new Error("File content does not match a valid PDF document.");
  }

  if (sourceType === "docx" && !startsWith(buffer, "PK")) {
    throw new Error("File content does not match a valid DOCX document.");
  }

  if ((sourceType === "txt" || sourceType === "md") && !looksLikePlainText(buffer)) {
    throw new Error("File content looks binary, not plain text.");
  }
}

async function loadTextWithLangChain(input: IngestDocumentInput, sourceType: SupportedSourceType) {
  const blob = bufferToBlob(input.buffer, input.mimeType);

  if (sourceType === "pdf") {
    const loader = new PDFLoader(blob, {
      splitPages: false,
      parsedItemSeparator: " ",
    });
    const documents = await loader.load();
    return documents.map((document) => document.pageContent).join("\n\n");
  }

  if (sourceType === "docx") {
    const loader = new DocxLoader(blob, { type: "docx" });
    const documents = await loader.load();
    return documents.map((document) => document.pageContent).join("\n\n");
  }

  const loader = new TextLoader(blob);
  const documents = await loader.load();
  return documents.map((document) => document.pageContent).join("\n\n");
}

export function sanitizeFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() || "uploaded-document";
  return (
    baseName
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[<>:"/\\|?*]/g, "_")
      .slice(0, 180)
      .trim() || "uploaded-document"
  );
}

export function assertSupportedFile(fileName: string, mimeType: string) {
  const sourceType = inferSourceType(fileName, mimeType);
  const extension = getFileExtension(fileName);
  const hasKnownExtension = SUPPORTED_FILE_EXTENSIONS.includes(
    extension as (typeof SUPPORTED_FILE_EXTENSIONS)[number],
  );
  const hasKnownMimeType = mimeType ? SUPPORTED_MIME_TYPES.has(mimeType) : false;

  if (!sourceType || (!hasKnownExtension && !hasKnownMimeType)) {
    throw new Error("Unsupported file type. Upload PDF, TXT, MD, or DOCX files.");
  }

  return sourceType;
}

export async function loadUploadedDocument(input: IngestDocumentInput) {
  const fileName = sanitizeFileName(input.fileName);
  const sourceType = assertSupportedFile(fileName, input.mimeType);
  assertContentSignature(sourceType, input.buffer);

  const text = await loadTextWithLangChain({ ...input, fileName }, sourceType);
  const sanitized = sanitizeUploadedText(text);

  const loadedDocument: LoadedDocument = {
    text: sanitized.text,
    title: titleFromFileName(fileName),
    fileName,
    mimeType: input.mimeType || "application/octet-stream",
    sourceType,
    sizeBytes: input.sizeBytes,
    metadata: {
      source: fileName,
      sourceType,
      mimeType: input.mimeType || "application/octet-stream",
      securitySignalCount: sanitized.signals.length,
      removedControlCharCount: sanitized.removedControlCharCount,
    },
  };

  if (!loadedDocument.text) {
    throw new Error("No readable text could be extracted from this document.");
  }

  return {
    loadedDocument,
    langChainDocument: toLangChainDocument(loadedDocument),
    securitySignals: sanitized.signals satisfies SecuritySignal[],
  };
}
