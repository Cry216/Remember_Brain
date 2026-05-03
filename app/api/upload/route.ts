import { NextResponse } from "next/server";

import { ingestUploadedDocument } from "@/lib/rag/ingest";
import { assertSupportedFile, sanitizeFileName } from "@/lib/rag/loaders";
import { logSecurityEvent } from "@/lib/rag/security";
import { MAX_UPLOAD_BYTES } from "@/lib/rag/types";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Upload failed.";
}

function statusForError(message: string) {
  if (
    message.includes("Unsupported file type") ||
    message.includes("No readable text") ||
    message.includes("too large") ||
    message.includes("does not match") ||
    message.includes("looks binary")
  ) {
    return 400;
  }

  return 500;
}

function isSuspiciousUploadError(message: string) {
  return (
    message.includes("Unsupported file type") ||
    message.includes("too large") ||
    message.includes("does not match") ||
    message.includes("looks binary")
  );
}

export async function POST(request: Request) {
  let uploadContext: { fileName?: string; mimeType?: string; sizeBytes?: number } = {};

  try {
    const formData = await request.formData();
    const uploaded = formData.get("file");

    if (!uploaded || typeof uploaded === "string") {
      return NextResponse.json({ error: "Upload a document file." }, { status: 400 });
    }

    const file = uploaded as File;
    const fileName = sanitizeFileName(file.name);
    uploadContext = {
      fileName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };

    if (file.size > MAX_UPLOAD_BYTES) {
      await logSecurityEvent({
        eventType: "UPLOAD_REJECTED",
        severity: "MEDIUM",
        action: "FILE_TOO_LARGE",
        source: "upload",
        message: "Rejected oversized document upload.",
        metadata: uploadContext,
      });

      return NextResponse.json(
        { error: "File is too large. The current limit is 20 MB." },
        { status: 400 },
      );
    }

    assertSupportedFile(fileName, file.type);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestUploadedDocument({
      fileName,
      mimeType: file.type,
      sizeBytes: file.size,
      buffer,
    });

    return NextResponse.json(
      {
        document: result,
      },
      { status: result.skipped ? 200 : 201 },
    );
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Upload API error", { error });

    if (isSuspiciousUploadError(message)) {
      await logSecurityEvent({
        eventType: "UPLOAD_REJECTED",
        severity: "MEDIUM",
        action: "VALIDATION_FAILED",
        source: "upload",
        message,
        metadata: uploadContext,
      });
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: statusForError(message) },
    );
  }
}
