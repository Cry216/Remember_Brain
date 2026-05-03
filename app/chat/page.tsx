"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock3,
  ExternalLink,
  FileText,
  FileUp,
  History,
  Loader2,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";

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
  query?: string;
  sources?: ChatSource[];
  warning?: string;
  blocked?: boolean;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

const CHAT_SESSIONS_KEY = "remember-brain-chat-sessions";
const ACTIVE_CHAT_KEY = "remember-brain-active-chat";
const CHAT_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_CHAT_SESSIONS = 7;
const MAX_MESSAGE_CHARACTERS = 2000;

function welcomeMessage(): ChatMessage {
  return {
    role: "assistant",
    content: "Hi, I am Remember Brain. Ask me anything and I will search your documents first.",
    sources: [],
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleFromMessages(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();

  if (!firstUserMessage) return "New chat";
  if (firstUserMessage.length <= 48) return firstUserMessage;

  return `${firstUserMessage.slice(0, 45).trim()}...`;
}

function createSession(now = Date.now()): ChatSession {
  return {
    id: createId(),
    title: "New chat",
    messages: [welcomeMessage()],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + CHAT_TTL_MS,
  };
}

function pruneSessions(sessions: ChatSession[], now = Date.now()) {
  return sessions
    .filter((session) => session.expiresAt > now)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHAT_SESSIONS);
}

function readStoredSessions() {
  try {
    const stored = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as ChatSession[];
    if (!Array.isArray(parsed)) return [];

    return pruneSessions(
      parsed.filter(
        (session) =>
          typeof session.id === "string" &&
          Array.isArray(session.messages) &&
          typeof session.createdAt === "number" &&
          typeof session.updatedAt === "number" &&
          typeof session.expiresAt === "number",
      ),
    );
  } catch {
    return [];
  }
}

function writeStoredSessions(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
}

function formatSessionTime(updatedAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
}

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

function countCharacters(text: string) {
  return Array.from(text.trim()).length;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [input, setInput] = useState("");
  const [allowSensitive, setAllowSensitive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [limitNotice, setLimitNotice] = useState("");
  const shouldShowSensitiveConsent = looksLikeSensitiveRequest(input) || allowSensitive;
  const inputCharacterCount = countCharacters(input);
  const isOverCharacterLimit = inputCharacterCount > MAX_MESSAGE_CHARACTERS;
  const hasReachedChatLimit = sessions.length >= MAX_CHAT_SESSIONS;
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );
  const messages = activeSession?.messages ?? [welcomeMessage()];

  useEffect(() => {
    queueMicrotask(() => {
      const storedSessions = readStoredSessions();
      const storedActiveId = localStorage.getItem(ACTIVE_CHAT_KEY);
      const activeSessionExists = storedSessions.some((session) => session.id === storedActiveId);
      const nextSessions = storedSessions.length > 0 ? storedSessions : [createSession()];
      const nextActiveId =
        activeSessionExists && storedActiveId ? storedActiveId : nextSessions[0].id;

      setSessions(nextSessions);
      setActiveSessionId(nextActiveId);
      writeStoredSessions(nextSessions);
      localStorage.setItem(ACTIVE_CHAT_KEY, nextActiveId);
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isReady || sessions.length === 0) return;

    const prunedSessions = pruneSessions(sessions);
    const nextSessions = prunedSessions.length > 0 ? prunedSessions : [createSession()];
    const nextActiveId = nextSessions.some((session) => session.id === activeSessionId)
      ? activeSessionId
      : nextSessions[0].id;

    writeStoredSessions(nextSessions);
    localStorage.setItem(ACTIVE_CHAT_KEY, nextActiveId);
  }, [activeSessionId, isReady, sessions]);

  const updateActiveSession = (updater: (session: ChatSession) => ChatSession) => {
    setSessions((current) =>
      pruneSessions(
        current.map((session) => (session.id === activeSessionId ? updater(session) : session)),
      ),
    );
  };

  const startNewChat = () => {
    if (hasReachedChatLimit) {
      setLimitNotice(`You can keep up to ${MAX_CHAT_SESSIONS} chats. Delete one to start a new chat.`);
      return;
    }

    const session = createSession();
    setSessions((current) => [session, ...pruneSessions(current)]);
    setActiveSessionId(session.id);
    localStorage.setItem(ACTIVE_CHAT_KEY, session.id);
    setInput("");
    setAllowSensitive(false);
    setIsHistoryOpen(false);
    setLimitNotice("");
  };

  const openSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    localStorage.setItem(ACTIVE_CHAT_KEY, sessionId);
    setInput("");
    setAllowSensitive(false);
    setIsHistoryOpen(false);
    setLimitNotice("");
  };

  const deleteSession = (sessionId: string) => {
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      const nextSessions = remaining.length > 0 ? remaining : [createSession()];
      const nextActiveId =
        activeSessionId === sessionId ? nextSessions[0].id : activeSessionId;

      setActiveSessionId(nextActiveId);
      localStorage.setItem(ACTIVE_CHAT_KEY, nextActiveId);
      return nextSessions;
    });
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !activeSession) return;

    if (isOverCharacterLimit) {
      setLimitNotice(
        `Message is ${inputCharacterCount} characters. The limit is ${MAX_MESSAGE_CHARACTERS} characters.`,
      );
      return;
    }

    const consentForMessage = allowSensitive;
    const now = Date.now();
    const userMessage: ChatMessage = { role: "user", content: trimmed };

    updateActiveSession((session) => {
      const nextMessages = [...session.messages, userMessage];

      return {
        ...session,
        title: titleFromMessages(nextMessages),
        messages: nextMessages,
        updatedAt: now,
        expiresAt: now + CHAT_TTL_MS,
      };
    });
    setInput("");
    setAllowSensitive(false);
    setLimitNotice("");
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
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || "I could not generate a useful answer this time.",
        query: trimmed,
        sources: data.sources ?? [],
        warning: data.warning,
        blocked: data.blocked,
      };
      const responseTime = Date.now();

      updateActiveSession((session) => ({
        ...session,
        title: titleFromMessages([...session.messages, assistantMessage]),
        messages: [...session.messages, assistantMessage],
        updatedAt: responseTime,
        expiresAt: responseTime + CHAT_TTL_MS,
      }));
    } catch (error) {
      console.error(error);
      const errorTime = Date.now();
      updateActiveSession((session) => ({
        ...session,
        messages: [
          ...session.messages,
          {
            role: "assistant",
            content: "Sorry, something went wrong while searching your memory.",
            sources: [],
          },
        ],
        updatedAt: errorTime,
        expiresAt: errorTime + CHAT_TTL_MS,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-200">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Remember Brain</p>
              <p className="text-xs text-zinc-500">RAG chat</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-sky-400 hover:text-white lg:hidden"
            >
              <History className="h-4 w-4" />
              History
            </button>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-400 hover:text-white"
            >
              <FileUp className="h-4 w-4" />
              Upload
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 gap-5 px-5 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`${
            isHistoryOpen ? "block" : "hidden"
          } rounded-lg border border-zinc-800 bg-zinc-900/45 lg:block`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4 text-sky-200" />
                History
              </h2>
              <p className="mt-1 text-xs text-zinc-500">2-day memory</p>
              <p className="mt-1 text-xs text-zinc-600">
                {sessions.length}/{MAX_CHAT_SESSIONS} chats
              </p>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              disabled={hasReachedChatLimit}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {limitNotice ? (
            <div className="border-b border-zinc-800 px-4 py-3 text-xs leading-5 text-amber-200">
              {limitNotice}
            </div>
          ) : null}

          <div className="max-h-[calc(100vh-180px)] space-y-2 overflow-y-auto p-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group rounded-lg border p-2 transition ${
                  session.id === activeSessionId
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => openSession(session.id)}
                  className="w-full text-left"
                >
                  <span className="line-clamp-2 block text-sm font-medium text-zinc-100">
                    {session.title}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatSessionTime(session.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(session.id)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-[calc(100vh-130px)] flex-col">
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <button
              type="button"
              onClick={startNewChat}
              disabled={hasReachedChatLimit}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
            <div className="text-xs text-zinc-500">
              {sessions.length}/{MAX_CHAT_SESSIONS} saved chats
            </div>
          </div>

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
                    <div className="mt-4 border-t border-zinc-800 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Sources
                      </p>
                      {message.sources.slice(0, 4).map((source) => (
                        <Link
                          key={`${source.documentId}-${source.chunkIndex}`}
                          href={`/documents/${source.documentId}?q=${encodeURIComponent(
                            message.query ?? "",
                          )}#chunk-${source.chunkIndex}`}
                          className="group mt-2 flex items-center justify-between gap-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/15"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{source.title}</span>
                              <span className="block truncate text-sky-200/70">
                                {source.fileName} - chunk {source.chunkIndex + 1}
                              </span>
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-sky-200 group-hover:text-white">
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </span>
                        </Link>
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
            {limitNotice ? (
              <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100 lg:hidden">
                {limitNotice}
              </div>
            ) : null}
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
                onChange={(event) => {
                  setInput(event.target.value);
                  setLimitNotice("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask about your uploaded documents..."
                className={`min-w-0 flex-1 rounded-lg border bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 ${
                  isOverCharacterLimit
                    ? "border-amber-400 focus:border-amber-300"
                    : "border-zinc-700 focus:border-emerald-400"
                }`}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={isLoading || !input.trim() || isOverCharacterLimit}
                className="inline-flex w-12 items-center justify-center rounded-lg bg-emerald-400 text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Limit: {MAX_MESSAGE_CHARACTERS} characters per message</span>
              <span className={isOverCharacterLimit ? "text-amber-200" : ""}>
                {inputCharacterCount}/{MAX_MESSAGE_CHARACTERS} characters
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
