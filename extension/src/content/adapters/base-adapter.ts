import type { Platform, UnifiedSubmission, FailingTestCase } from "../shared/types";

/**
 * Interface every platform adapter must implement.
 * Each adapter runs as a content script on its respective platform.
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  /** Returns true if the current page is a coding problem page. */
  isOnProblemPage(): boolean;

  /** Start intercepting submissions. */
  attach(): void;
}

/**
 * Normalise a raw language string to our canonical set.
 */
export function normalizeLanguage(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s-_]+/g, "");
  const MAP: Record<string, string> = {
    python: "python3",
    python3: "python3",
    python2: "python2",
    cpp: "cpp",
    "c++": "cpp",
    "c++14": "cpp",
    "c++17": "cpp",
    "c++20": "cpp",
    c: "c",
    java: "java",
    javascript: "javascript",
    js: "javascript",
    typescript: "typescript",
    ts: "typescript",
    go: "go",
    golang: "go",
    rust: "rust",
    ruby: "ruby",
    swift: "swift",
    kotlin: "kotlin",
    scala: "scala",
    csharp: "csharp",
    "c#": "csharp",
    php: "php",
    dart: "dart",
    elixir: "elixir",
    erlang: "erlang",
    racket: "racket",
  };
  return MAP[lower] ?? lower;
}

/**
 * Map a raw verdict string to our canonical Verdict enum.
 */
export function normalizeVerdict(
  raw: string
): UnifiedSubmission["verdict"] | null {
  const lower = raw.toLowerCase().replace(/[\s_]+/g, "");
  if (lower.includes("wronganswer") || lower.includes("wa")) return "wrong_answer";
  if (lower.includes("timelimit") || lower === "tle") return "tle";
  if (lower.includes("memorylimit") || lower === "mle") return "mle";
  if (lower.includes("runtimeerror") || lower === "re") return "runtime_error";
  if (lower.includes("compileerror") || lower === "ce") return "compile_error";
  if (lower.includes("accepted") || lower === "ac") return null; // not a failure
  return null;
}

/**
 * Truncate code to MAX_CODE_BYTES to avoid storage bloat.
 */
export function truncateCode(code: string, maxBytes = 50 * 1024): string {
  if (new Blob([code]).size <= maxBytes) return code;
  // Rough byte-based truncation
  return code.slice(0, maxBytes) + "\n// ... truncated by CodeMirror";
}

/**
 * Build a FailingTestCase from raw platform data.
 */
export function buildFailingCase(
  input: string,
  expected: string,
  got: string
): FailingTestCase {
  return {
    input: (input ?? "").slice(0, 1000),
    expected: (expected ?? "").slice(0, 1000),
    got: (got ?? "").slice(0, 1000),
  };
}

/**
 * Send the normalised submission to the service worker and return overlay data.
 */
export async function sendToServiceWorker(
  submission: UnifiedSubmission
): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SUBMISSION_CAPTURED",
      data: submission,
    });

    if (response?.success && response.data?.overlay_data) {
      // Post overlay data so the content script's listener can inject it
      window.postMessage(
        {
          type: "__CODEMIRROR_OVERLAY__",
          payload: response.data.overlay_data,
        },
        "*"
      );
      return;
    }

    if (!response?.success && typeof response?.error === "string" && response.error.includes("queued")) {
      window.postMessage(
        {
          type: "__CODEMIRROR_OVERLAY__",
          payload: {
            headline: "Offline mode",
            body: "CodeMirror AI temporarily offline. Submission saved locally and will retry automatically.",
            call_to_action: "Keep solving. Sync resumes automatically.",
            badge_label: "Queued",
            error_types: [],
            concepts: [],
            is_recurring: false,
          },
        },
        "*"
      );
    }
  } catch (err) {
    console.error("[CodeMirror] Failed to send submission:", err);
  }
}
