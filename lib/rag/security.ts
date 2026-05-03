import "server-only";

import { getPrisma } from "@/lib/prisma";

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SecuritySignalType =
  | "PROMPT_INJECTION"
  | "SECRET"
  | "CONTROL_CHARS"
  | "JAILBREAK";

export type SecuritySignal = {
  type: SecuritySignalType;
  severity: SecuritySeverity;
  label: string;
  index: number;
  excerpt: string;
};

export type SecurityWarningSummary = {
  total: number;
  promptInjectionCount: number;
  secretCount: number;
  warnings: string[];
};

type Detector = {
  type: SecuritySignalType;
  severity: SecuritySeverity;
  label: string;
  pattern: RegExp;
  redactionStyle?: "assignment" | "whole";
};

type LogSecurityEventInput = {
  eventType: string;
  severity: SecuritySeverity;
  message: string;
  action?: string;
  source?: string;
  documentId?: string;
  metadata?: Record<string, unknown>;
};

const MAX_LOGGED_SIGNALS = 40;
const MAX_USER_MESSAGE_CHARS = 2000;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const SECRET_DETECTORS: Detector[] = [
  {
    type: "SECRET",
    severity: "CRITICAL",
    label: "private key block",
    pattern:
      /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]{0,12000}?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gi,
    redactionStyle: "whole",
  },
  {
    type: "SECRET",
    severity: "HIGH",
    label: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    redactionStyle: "whole",
  },
  {
    type: "SECRET",
    severity: "HIGH",
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    redactionStyle: "whole",
  },
  {
    type: "SECRET",
    severity: "HIGH",
    label: "GitHub token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g,
    redactionStyle: "whole",
  },
  {
    type: "SECRET",
    severity: "HIGH",
    label: "OpenAI-style API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    redactionStyle: "whole",
  },
  {
    type: "SECRET",
    severity: "HIGH",
    label: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    redactionStyle: "whole",
  },
  {
    type: "SECRET",
    severity: "HIGH",
    label: "credential assignment",
    pattern:
      /\b(?:api[_\-\s]?key|secret(?:[_\-\s]?key)?|password|passwd|pwd|auth[_\-\s]?token|access[_\-\s]?token|refresh[_\-\s]?token|client[_\-\s]?secret|private[_\-\s]?key)\b\s*[:=]\s*["']?[^"'\s]{8,}/gi,
    redactionStyle: "assignment",
  },
];

const PROMPT_INJECTION_DETECTORS: Detector[] = [
  {
    type: "PROMPT_INJECTION",
    severity: "HIGH",
    label: "ignore prior instructions",
    pattern: /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|system|developer)\s+instructions\b/gi,
  },
  {
    type: "PROMPT_INJECTION",
    severity: "HIGH",
    label: "system prompt extraction",
    pattern: /\b(?:reveal|print|show|dump|return)\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message|instructions)\b/gi,
  },
  {
    type: "PROMPT_INJECTION",
    severity: "HIGH",
    label: "safety bypass",
    pattern: /\b(?:jailbreak|DAN mode|developer mode|disable\s+(?:safety|guardrails|policy|filters))\b/gi,
  },
  {
    type: "PROMPT_INJECTION",
    severity: "HIGH",
    label: "secret exfiltration instruction",
    pattern: /\bexfiltrate\b.{0,160}\b(?:secret|token|key|password|credential)s?\b/gi,
  },
];

const SENSITIVE_EXTRACTION_VERB =
  /\b(?:extract|show|list|print|display|reveal|dump|return|find|give\s+me|what\s+are)\b/i;
const SENSITIVE_NOUN =
  /\b(?:api\s*keys?|passwords?|secrets?|tokens?|credentials?|private\s*keys?|ssh\s*keys?|access\s*keys?|env(?:ironment)?\s*(?:vars?|variables?)?)\b/i;

function cloneGlobal(pattern: RegExp) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function normalizePlainText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .normalize("NFC")
    .trim();
}

function countControlChars(text: string) {
  return text.match(CONTROL_CHAR_PATTERN)?.length ?? 0;
}

function signalExcerpt(text: string, index: number, length: number) {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + length + 90);
  return redactSensitiveText(text.slice(start, end))
    .replace(/\s+/g, " ")
    .slice(0, 260)
    .trim();
}

function scanWithDetectors(text: string, detectors: Detector[], maxPerDetector = 8) {
  const signals: SecuritySignal[] = [];

  for (const detector of detectors) {
    const pattern = cloneGlobal(detector.pattern);
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = pattern.exec(text)) && count < maxPerDetector) {
      signals.push({
        type: detector.type,
        severity: detector.severity,
        label: detector.label,
        index: match.index,
        excerpt: signalExcerpt(text, match.index, match[0].length),
      });
      count += 1;

      if (match[0].length === 0) {
        pattern.lastIndex += 1;
      }
    }
  }

  return signals;
}

export function sanitizeUploadedText(text: string) {
  const removedControlCharCount = countControlChars(text);
  const sanitized = normalizePlainText(text);
  const signals = scanTextForSecuritySignals(sanitized);

  if (removedControlCharCount > 0) {
    signals.push({
      type: "CONTROL_CHARS",
      severity: "LOW",
      label: "unsafe control characters removed",
      index: 0,
      excerpt: `${removedControlCharCount} unsafe control characters removed during normalization.`,
    });
  }

  return {
    text: sanitized,
    removedControlCharCount,
    signals,
  };
}

export function sanitizeUserMessage(text: string) {
  return normalizePlainText(text).slice(0, MAX_USER_MESSAGE_CHARS);
}

export function scanTextForSecuritySignals(text: string) {
  return [
    ...scanWithDetectors(text, SECRET_DETECTORS),
    ...scanWithDetectors(text, PROMPT_INJECTION_DETECTORS),
  ].slice(0, MAX_LOGGED_SIGNALS);
}

export function detectSensitiveExtractionIntent(message: string) {
  return SENSITIVE_EXTRACTION_VERB.test(message) && SENSITIVE_NOUN.test(message);
}

export function detectJailbreakAttempt(message: string) {
  return scanWithDetectors(message, PROMPT_INJECTION_DETECTORS, 3).map((signal) => ({
    ...signal,
    type: "JAILBREAK" as const,
  }));
}

export function redactSensitiveText(text: string) {
  let redacted = text;

  for (const detector of SECRET_DETECTORS) {
    redacted = redacted.replace(cloneGlobal(detector.pattern), (match) => {
      if (detector.redactionStyle === "assignment") {
        return match.replace(/([:=]\s*["']?)[^"'\s]+/, `$1[REDACTED ${detector.label}]`);
      }

      return `[REDACTED ${detector.label}]`;
    });
  }

  return redacted;
}

export function escapePromptText(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function prepareUntrustedContextForPrompt(
  content: string,
  options: { allowSensitive: boolean },
) {
  const sanitized = normalizePlainText(content);
  const safeForPolicy = options.allowSensitive ? sanitized : redactSensitiveText(sanitized);
  return escapePromptText(safeForPolicy);
}

export function summarizeSecuritySignals(signals: SecuritySignal[]): SecurityWarningSummary {
  const promptInjectionCount = signals.filter(
    (signal) => signal.type === "PROMPT_INJECTION",
  ).length;
  const secretCount = signals.filter((signal) => signal.type === "SECRET").length;
  const warnings: string[] = [];

  if (promptInjectionCount > 0) {
    warnings.push("Potential prompt-injection instructions were found and logged.");
  }

  if (secretCount > 0) {
    warnings.push("Possible secrets were found; chat redacts them unless explicitly allowed.");
  }

  if (signals.some((signal) => signal.type === "CONTROL_CHARS")) {
    warnings.push("Unsafe control characters were removed during sanitization.");
  }

  return {
    total: signals.length,
    promptInjectionCount,
    secretCount,
    warnings,
  };
}

export async function logSecurityEvent(input: LogSecurityEventInput) {
  try {
    const prisma = getPrisma();
    await prisma.securityEvent.create({
      data: {
        eventType: input.eventType,
        severity: input.severity,
        action: input.action,
        source: input.source,
        message: input.message,
        documentId: input.documentId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    });
  } catch (error) {
    console.error("Security event logging failed", { error });
  }
}

export async function logSecuritySignals(
  signals: SecuritySignal[],
  context: { eventType: string; source?: string; documentId?: string; action?: string },
) {
  if (signals.length === 0) return;

  try {
    const prisma = getPrisma();
    await prisma.securityEvent.createMany({
      data: signals.slice(0, MAX_LOGGED_SIGNALS).map((signal) => ({
        eventType: context.eventType,
        severity: signal.severity,
        action: context.action,
        source: context.source,
        documentId: context.documentId,
        message: signal.label,
        metadata: JSON.stringify({
          type: signal.type,
          index: signal.index,
          excerpt: signal.excerpt,
        }),
      })),
    });
  } catch (error) {
    console.error("Security signal logging failed", { error });
  }
}
