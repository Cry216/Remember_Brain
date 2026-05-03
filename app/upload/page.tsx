"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCcw,
  UploadCloud,
  X,
} from "lucide-react";

type DocumentStatus = "PROCESSING" | "READY" | "FAILED";

type StoredDocument = {
  id: string;
  title: string;
  fileName: string;
  sourceType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  securityEventCount: number;
  createdAt: string;
};

type UploadStatus = "uploading" | "processing" | "ready" | "failed";

type UploadItem = {
  id: string;
  fileName: string;
  sizeBytes: number;
  progress: number;
  status: UploadStatus;
  message: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function statusTone(status: DocumentStatus) {
  if (status === "READY") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "FAILED") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

function uploadStatusIcon(status: UploadStatus) {
  if (status === "ready") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-rose-300" />;
  return <Loader2 className="h-4 w-4 animate-spin text-sky-300" />;
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);

    try {
      const response = await fetch("/api/documents");
      const data = (await response.json()) as { documents?: StoredDocument[] };
      setDocuments(data.documents ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const response = await fetch("/api/documents");
        const data = (await response.json()) as { documents?: StoredDocument[] };

        if (isActive) {
          setDocuments(data.documents ?? []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isActive) {
          setIsLoadingDocuments(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((current) =>
      current.map((upload) => (upload.id === id ? { ...upload, ...patch } : upload)),
    );
  }, []);

  const uploadOneFile = useCallback(
    (file: File) =>
      new Promise<void>((resolve) => {
        const id = `${file.name}-${file.size}-${Date.now()}`;
        const formData = new FormData();
        formData.append("file", file);

        setUploads((current) => [
          {
            id,
            fileName: file.name,
            sizeBytes: file.size,
            progress: 0,
            status: "uploading",
            message: "Uploading",
          },
          ...current,
        ]);

        const request = new XMLHttpRequest();

        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;

          const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
          updateUpload(id, {
            progress,
            status: progress >= 100 ? "processing" : "uploading",
            message: progress >= 100 ? "Processing" : "Uploading",
          });
        };

        request.onload = async () => {
          let data: {
            error?: string;
            document?: {
              chunkCount?: number;
              skipped?: boolean;
              securityWarnings?: { total?: number; warnings?: string[] };
            };
          } = {};

          try {
            data = JSON.parse(request.responseText) as typeof data;
          } catch {
            data = {};
          }

          if (request.status >= 200 && request.status < 300) {
            const chunkCount = data.document?.chunkCount ?? 0;
            const warningCount = data.document?.securityWarnings?.total ?? 0;
            updateUpload(id, {
              progress: 100,
              status: "ready",
              message:
                warningCount > 0
                  ? `Ready with ${chunkCount} chunks; ${warningCount} warnings logged`
                  : data.document?.skipped
                    ? "Already in memory"
                    : `Ready with ${chunkCount} chunks`,
            });
            await loadDocuments();
          } else {
            updateUpload(id, {
              status: "failed",
              message: data.error || "Upload failed",
            });
          }

          resolve();
        };

        request.onerror = () => {
          updateUpload(id, {
            status: "failed",
            message: "Network error",
          });
          resolve();
        };

        request.open("POST", "/api/upload");
        request.send(formData);
      }),
    [loadDocuments, updateUpload],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const selectedFiles = Array.from(files).filter((file) => file.size > 0);

      for (const file of selectedFiles) {
        await uploadOneFile(file);
      }
    },
    [uploadOneFile],
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Remember Brain</p>
              <p className="text-xs text-zinc-500">Document memory</p>
            </div>
          </Link>

          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-sky-400 hover:text-white"
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={`flex min-h-[430px] flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition ${
            isDragging
              ? "border-emerald-300 bg-emerald-500/10"
              : "border-zinc-700 bg-zinc-900/45"
          }`}
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-sky-500/10 text-sky-200">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
            Upload documents into your second brain
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            PDF, TXT, MD, and DOCX files are parsed, chunked, embedded with Gemini,
            and stored locally in SQLite for retrieval during chat.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
            >
              <UploadCloud className="h-4 w-4" />
              Choose files
            </button>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-sky-400"
            >
              <MessageSquare className="h-4 w-4" />
              Ask memory
            </Link>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void handleFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </section>

        <aside className="rounded-lg border border-zinc-800 bg-zinc-900/45">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Processing</h2>
              <p className="text-xs text-zinc-500">Current uploads</p>
            </div>
            {uploads.length > 0 ? (
              <button
                type="button"
                onClick={() => setUploads([])}
                className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Clear uploads"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
            {uploads.length === 0 ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-4 text-sm text-zinc-500">
                New uploads will appear here.
              </p>
            ) : (
              uploads.map((upload) => (
                <div key={upload.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="flex items-start gap-3">
                    {uploadStatusIcon(upload.status)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{upload.fileName}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatBytes(upload.sizeBytes)} - {upload.message}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        upload.status === "failed" ? "bg-rose-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/45">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Knowledge base</h2>
              <p className="text-xs text-zinc-500">{documents.length} documents indexed</p>
            </div>
            <button
              type="button"
              onClick={() => void loadDocuments()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-400"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoadingDocuments ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="divide-y divide-zinc-800">
            {documents.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-500">
                Your searchable documents will appear here after upload.
              </p>
            ) : (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_130px_120px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{document.title}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">{document.fileName}</p>
                    {document.error ? (
                      <p className="mt-2 text-xs text-rose-300">{document.error}</p>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500">
                    <p>{document.chunkCount} chunks</p>
                    <p className="mt-1 uppercase">
                      {document.sourceType}
                      {document.securityEventCount > 0
                        ? ` - ${document.securityEventCount} security events`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs ${statusTone(
                        document.status,
                      )}`}
                    >
                      {document.status.toLowerCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
