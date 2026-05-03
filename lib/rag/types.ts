export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_FILE_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"] as const;

export const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/markdown",
  "application/x-markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type SupportedSourceType = "pdf" | "txt" | "md" | "docx";

export type RagMetadataValue = string | number | boolean | null;

export type RagMetadata = Record<string, RagMetadataValue>;

export type LoadedDocument = {
  text: string;
  title: string;
  fileName: string;
  mimeType: string;
  sourceType: SupportedSourceType;
  sizeBytes: number;
  metadata: RagMetadata;
};

export type PreparedChunk = {
  chunkIndex: number;
  content: string;
  metadata: RagMetadata;
};

export type IngestDocumentInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type IngestDocumentResult = {
  documentId: string;
  title: string;
  fileName: string;
  chunkCount: number;
  status: "READY" | "FAILED" | "PROCESSING";
  skipped: boolean;
  securityWarnings: {
    total: number;
    promptInjectionCount: number;
    secretCount: number;
    warnings: string[];
  };
};

export type SearchResult = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
  metadata: RagMetadata;
};

export type RagSource = {
  documentId: string;
  title: string;
  fileName: string;
  chunkIndex: number;
  score: number;
};
