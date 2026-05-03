import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, UploadCloud } from "lucide-react";

import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
  }>;
};

const COMMON_SEARCH_WORDS = new Set([
  "about",
  "find",
  "from",
  "give",
  "like",
  "need",
  "search",
  "show",
  "that",
  "the",
  "what",
  "where",
  "word",
  "words",
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHighlightTerms(query: string) {
  const parentheticalTerms = Array.from(query.matchAll(/\(([^()]{2,80})\)/g), (match) =>
    match[1].trim(),
  );
  const quotedTerms = Array.from(query.matchAll(/["'“”‘’]([^"'“”‘’]{2,80})["'“”‘’]/g), (match) =>
    match[1].trim(),
  );
  const wordTerms =
    query
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((word) => word.length > 2 && !COMMON_SEARCH_WORDS.has(word)) ?? [];

  return Array.from(
    new Set(
      [...parentheticalTerms, ...quotedTerms, ...wordTerms]
        .map((term) => term.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  )
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);
}

function highlightText(text: string, terms: string[]) {
  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const lowerTerms = new Set(terms.map((term) => term.toLowerCase()));

  return text.split(pattern).map<ReactNode>((part, index) => {
    if (lowerTerms.has(part.toLowerCase())) {
      return (
        <mark
          key={`${part}-${index}`}
          className="rounded bg-emerald-300 px-1 py-0.5 text-zinc-950"
        >
          {part}
        </mark>
      );
    }

    return part;
  });
}

export default async function DocumentPage({ params, searchParams }: DocumentPageProps) {
  const [{ id }, { q = "" }] = await Promise.all([params, searchParams]);
  const prisma = getPrisma();
  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    include: {
      chunks: {
        orderBy: {
          chunkIndex: "asc",
        },
      },
    },
  });

  if (!document) notFound();

  const highlightTerms = getHighlightTerms(q);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/chat" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-200">
              <ArrowLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Back to chat</p>
              <p className="text-xs text-zinc-500">Highlighted source</p>
            </div>
          </Link>

          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-400 hover:text-white"
          >
            <UploadCloud className="h-4 w-4" />
            Upload
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/55 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-200">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{document.title}</h1>
              <p className="mt-1 text-sm text-zinc-500">{document.fileName}</p>
              {q ? (
                <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  Highlighting matches for: <span className="font-semibold">{q}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {document.chunks.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/55 p-5 text-sm text-zinc-400">
              No searchable text was saved for this document.
            </div>
          ) : (
            document.chunks.map((chunk) => (
              <article
                id={`chunk-${chunk.chunkIndex}`}
                key={chunk.id}
                className="scroll-mt-24 rounded-lg border border-zinc-800 bg-zinc-900/55 p-5"
              >
                <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3 text-xs text-zinc-500">
                  <span>Chunk {chunk.chunkIndex + 1}</span>
                  <span>{chunk.tokenCount ?? 0} estimated tokens</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                  {highlightText(chunk.content, highlightTerms)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
