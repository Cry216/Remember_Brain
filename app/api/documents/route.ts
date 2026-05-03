import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = getPrisma();
  const documents = await prisma.document.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      sourceType: document.sourceType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      error: document.error,
      chunkCount: document.chunkCount,
      securityEventCount: 0,
      createdAt: document.createdAt.toISOString(),
    })),
  });
}
