import type { Platform } from "./types";

// ── Backend ─────────────────────────────────────────────────────────
export const DEFAULT_BACKEND_URL = "http://localhost:8000";

export const API = {
  AUTH_REGISTER: "/auth/register",
  AUTH_LOGIN: "/auth/login",
  AUTH_REFRESH: "/auth/refresh",
  AUTH_ME: "/auth/me",
  AUTH_LEETCODE_SESSION: "/auth/leetcode-session",
  SUBMISSIONS: "/submissions",
  PATTERNS: "/patterns",
  REVISION_QUEUE: "/revision-queue",
  REVISION_TODAY: "/revision-queue/today",
  NOTIFICATIONS_UNREAD: "/notifications/unread",
  HEALTH: "/health",
} as const;

// ── Platform Hosts ──────────────────────────────────────────────────
export const PLATFORM_HOSTS: Record<Platform, string[]> = {
  leetcode: ["leetcode.com"],
  gfg: ["geeksforgeeks.org"],
  hackerrank: ["hackerrank.com"],
};

// ── Platform Colors ─────────────────────────────────────────────────
export const PLATFORM_COLORS: Record<Platform, string> = {
  leetcode: "#FFA116",
  gfg: "#2F8D46",
  hackerrank: "#1BA94C",
};

// ── Verdict Colors ──────────────────────────────────────────────────
export const VERDICT_COLORS: Record<string, string> = {
  wrong_answer: "#EF4444",
  tle: "#EAB308",
  mle: "#A855F7",
  runtime_error: "#F97316",
  compile_error: "#F97316",
};

// ── Impact Colors ───────────────────────────────────────────────────
export const IMPACT_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#6B7280",
};

// ── Storage Keys ────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKENS: "cm_auth_tokens",
  USER_PROFILE: "cm_user_profile",
  SETTINGS: "cm_settings",
  OFFLINE_QUEUE: "cm_offline_queue",
  POPUP_CACHE: "cm_popup_cache",
} as const;

// ── Timers ──────────────────────────────────────────────────────────
export const NOTIFICATION_POLL_MINUTES = 30;
export const OVERLAY_AUTO_DISMISS_MS = 12_000;
export const MAX_CODE_BYTES = 50 * 1024; // 50 KB
export const MAX_OFFLINE_QUEUE = 50;
export const LC_POLL_INTERVAL_MS = 1_000;
export const LC_POLL_TIMEOUT_MS = 15_000;

// ── PostMessage identifiers (main-world ↔ content-script) ──────────
export const MSG_PREFIX = "__CODEMIRROR_";
export const MSG_SUBMISSION = `${MSG_PREFIX}SUBMISSION__`;

// ── GFG Language Map ────────────────────────────────────────────────
export const GFG_LANGUAGE_MAP: Record<number, string> = {
  54: "cpp",
  62: "java",
  71: "python3",
  63: "javascript",
  72: "ruby",
  78: "swift",
  60: "go",
  73: "rust",
};

// ── LeetCode Verdict Map ────────────────────────────────────────────
export const LC_VERDICT_MAP: Record<number, string> = {
  10: "accepted",
  11: "wrong_answer",
  12: "mle",
  13: "output_limit",
  14: "tle",
  15: "runtime_error",
  20: "compile_error",
};
