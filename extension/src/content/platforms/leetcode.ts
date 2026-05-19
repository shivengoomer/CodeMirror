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

async function fetchAllSubmissions() {
  const allSubmissions = [];
  let offset = 0;
  let hasNext = true;
  let lastKey = "";
  
  while (hasNext) {
    const url = `https://leetcode.com/api/submissions/?offset=${offset}&limit=20&lastkey=${lastKey}`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      const subs = data.submissions_dump || [];
      allSubmissions.push(...subs);
      
      hasNext = data.has_next;
      lastKey = data.last_key || "";
      offset += 20;
      
      updateSyncButton(`Syncing... ${allSubmissions.length} submissions fetched`);
    } catch (e) {
      console.error(e);
      updateSyncButton("Sync failed!");
      return;
    }
  }
  
  updateSyncButton(`Sending ${allSubmissions.length} to backend...`);
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SYNC_SUBMISSIONS",
      payload: allSubmissions
    });
    
    if (response?.success) {
      updateSyncButton(`Done! ${allSubmissions.length} submissions synced`);
    } else {
      updateSyncButton("Backend sync failed!");
    }
  } catch (e) {
    console.error(e);
    updateSyncButton("Backend sync failed!");
  }
}

function updateSyncButton(text: string) {
  const btn = document.getElementById("codemirror-sync-btn");
  if (btn) btn.textContent = text;
}

function injectSyncButton() {
  if (document.getElementById("codemirror-sync-btn")) return;
  
  const btn = document.createElement("button");
  btn.id = "codemirror-sync-btn";
  btn.textContent = "Sync LeetCode Submissions";
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    background: #0ea5e9;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  `;
  
  btn.addEventListener("click", () => {
    btn.disabled = true;
    fetchAllSubmissions().finally(() => {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Sync LeetCode Submissions";
      }, 5000);
    });
  });
  
  document.body.appendChild(btn);
}

function init(): void {
  injectSyncButton();
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
