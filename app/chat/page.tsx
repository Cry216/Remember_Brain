"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, FileUp, Loader2, Send, ShieldAlert } from "lucide-react";

type ChatSource = {
  documentId: string;
  title: string;
  fileName: string;
  chunkIndex: number;
  score: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  warning?: string;
  blocked?: boolean;
};

function looksLikeSensitiveRequest(message: string) {
  return (
    /\b(?:extract|show|list|print|display|reveal|dump|return|find|give\s+me|what\s+are)\b/i.test(
      message,
    ) &&
    /\b(?:api\s*keys?|passwords?|secrets?|tokens?|credentials?|private\s*keys?|ssh\s*keys?|access\s*keys?|env(?:ironment)?\s*(?:vars?|variables?)?)\b/i.test(
      message,
    )
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi, I am Remember Brain. Ask me anything and I will search your documents first.",
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [allowSensitive, setAllowSensitive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const shouldShowSensitiveConsent = looksLikeSensitiveRequest(input) || allowSensitive;

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const consentForMessage = allowSensitive;

    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");
    setAllowSensitive(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, allowSensitive: consentForMessage }),
      });
      const data = (await response.json()) as {
        response?: string;
        sources?: ChatSource[];
        warning?: string;
        blocked?: boolean;
      };

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response || "I could not generate a useful answer this time.",
          sources: data.sources ?? [],
          warning: data.warning,
          blocked: data.blocked,
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Sorry, something went wrong while searching your memory.",
          sources: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-200">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Remember Brain</p>
              <p className="text-xs text-zinc-500">RAG chat</p>
            </div>
          </Link>

          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-400 hover:text-white"
          >
            <FileUp className="h-4 w-4" />
            Upload
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-6">
        <div className="flex-1 space-y-5 overflow-y-auto pb-6">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[84%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "bg-emerald-400 text-zinc-950"
                    : message.blocked
                      ? "border border-amber-500/40 bg-amber-500/10 text-amber-50"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-100"
                }`}
              >
                {message.warning ? (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{message.warning}</span>
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === "assistant" && message.sources?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
                    {message.sources.slice(0, 4).map((source) => (
                      <span
                        key={`${source.documentId}-${source.chunkIndex}`}
                        className="max-w-full truncate rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-100"
                      >
                        {source.title} - chunk {source.chunkIndex + 1}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {isLoading ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching memory
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-800 pt-4">
          {shouldShowSensitiveConsent ? (
            <label className="mb-3 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs leading-5 text-amber-100">
              <input
                type="checkbox"
                checked={allowSensitive}
                onChange={(event) => setAllowSensitive(event.target.checked)}
                className="mt-1 h-4 w-4 accent-amber-300"
              />
              <span>
                Allow sensitive-data retrieval for the next message only. Use this only for
                documents you own and rotate exposed credentials afterward.
              </span>
            </label>
          ) : null}
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask about your uploaded documents..."
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={isLoading || !input.trim()}
              className="inline-flex w-12 items-center justify-center rounded-lg bg-emerald-400 text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
