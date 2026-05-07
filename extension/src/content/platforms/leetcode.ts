import type { UnifiedSubmission } from "../../shared/types";
import { MSG_SUBMISSION } from "../../shared/constants";
import {
  normalizeLanguage,
  normalizeVerdict,
  truncateCode,
  buildFailingCase,
  sendToServiceWorker,
} from "../adapters/base-adapter";
import { listenForOverlay } from "../../overlay/overlay";

function isOnProblemPage(): boolean {
  return /\/problems\/[\w-]+/.test(window.location.pathname);
}

function extractSlug(): string {
  const match = window.location.pathname.match(/\/problems\/([\w-]+)/);
  return match?.[1] ?? "unknown";
}

function extractTitle(): string {
  const el =
    document.querySelector('[data-cy="question-title"]') ??
    document.querySelector("div.text-title-large") ??
    document.querySelector("h4.text-lg");
  return el?.textContent?.trim() ?? extractSlug();
}

function injectMainWorldScript(): void {
  if (document.getElementById("codemirror-lc-main-script")) return;
  const script = document.createElement("script");
  script.id = "codemirror-lc-main-script";
  script.src = chrome.runtime.getURL("dist/lc-main.js");
  script.async = false;
  (document.head ?? document.documentElement).appendChild(script);
}

function listenForSubmissions(): void {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== MSG_SUBMISSION) return;
    if (event.data.payload?.platform !== "leetcode") return;

    const raw = event.data.payload;
    const verdict = normalizeVerdict(raw.verdict);
    if (!verdict) return;

    const submission: UnifiedSubmission = {
      platform: "leetcode",
      problem_slug: raw.problemSlug || extractSlug(),
      problem_title: raw.problemTitle || extractTitle(),
      language: normalizeLanguage(raw.language),
      code: truncateCode(raw.code),
      verdict,
      failing_test_cases: (raw.failingTestCases ?? []).map(
        (tc: { input: string; expected: string; got: string }) =>
          buildFailingCase(tc.input, tc.expected, tc.got)
      ),
      error_message: raw.errorMessage ?? null,
      timestamp: Date.now(),
      leetcode_submission_id:
        typeof raw.leetcodeSubmissionId === "number" ? raw.leetcodeSubmissionId : undefined,
    };

    await sendToServiceWorker(submission);
  });

}

function init(): void {
  if (!isOnProblemPage()) return;
  injectMainWorldScript();
  listenForSubmissions();
  listenForOverlay();
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, { once: true });
}
