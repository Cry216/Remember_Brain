import Link from "next/link";
import { BookOpen, DatabaseZap, FileUp, MessageSquare } from "lucide-react";

const actions = [
  {
    href: "/upload",
    label: "Upload documents",
    description: "Add PDFs, markdown, notes, and DOCX files to searchable memory.",
    icon: FileUp,
    tone: "bg-emerald-400 text-zinc-950",
  },
  {
    href: "/chat",
    label: "Ask memory",
    description: "Retrieve relevant chunks and answer with Gemini 2.5 Flash.",
    icon: MessageSquare,
    tone: "bg-sky-400 text-zinc-950",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold">Remember Brain</p>
              <p className="text-xs text-zinc-500">Personal second brain SaaS</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 sm:flex">
            <DatabaseZap className="h-4 w-4 text-emerald-300" />
            SQLite RAG active
          </div>
        </header>

        <section className="grid flex-1 content-center gap-6 py-10">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-medium text-emerald-300">Document memory workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Upload knowledge, then ask it back.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
              Remember Brain now has a local RAG pipeline: parsing, chunking,
              Gemini embeddings, SQLite storage, semantic retrieval, and chat context injection.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-lg border border-zinc-800 bg-zinc-900/55 p-5 transition hover:border-zinc-600"
                >
                  <div
                    className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg ${action.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-50">{action.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{action.description}</p>
                  <p className="mt-5 text-sm font-medium text-zinc-300 group-hover:text-white">
                    Open
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
