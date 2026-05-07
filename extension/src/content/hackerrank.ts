/**
 * HackerRank content script (isolated world).
 *
 * HR uses fetch for submissions and requires polling.
 * Must run with all_frames: true because HR uses iframes.
 */

import type { UnifiedSubmission } from "../shared/types";
import { MSG_SUBMISSION, LC_POLL_INTERVAL_MS, LC_POLL_TIMEOUT_MS } from "../shared/constants";
import {
  normalizeLanguage,
  normalizeVerdict,
  truncateCode,
  buildFailingCase,
  sendToServiceWorker,
} from "./adapters/base-adapter";
import { listenForOverlay } from "../overlay/overlay";

// ── Helpers ─────────────────────────────────────────────────────────

function isOnProblemPage(): boolean {
  return /\/challenges\/[\w-]+\/problem/.test(window.location.pathname) ||
         /\/contests\/[\w-]+\/challenges\/[\w-]+/.test(window.location.pathname);
}

function extractSlug(): string {
  const match = window.location.pathname.match(/\/challenges\/([\w-]+)/);
  return match?.[1] ?? "unknown";
}

function extractTitle(): string {
  const el =
    document.querySelector(".challenge-view h2") ??
    document.querySelector(".challenge-name") ??
    document.querySelector("h2.hr-challenge-name");
  return el?.textContent?.trim() ?? extractSlug();
}

// ── Injector (MAIN world) ───────────────────────────────────────────

function getInjectorCode(): string {
  return `(function() {
    if (window.__codemirror_hr_injected__) return;
    window.__codemirror_hr_injected__ = true;

    var MSG = "${MSG_SUBMISSION}";
    var POLL_INTERVAL = ${LC_POLL_INTERVAL_MS};
    var POLL_TIMEOUT = ${LC_POLL_TIMEOUT_MS};

    var origFetch = window.fetch;
    window.fetch = async function() {
      var args = arguments;
      var url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      // Detect submission endpoint
      var submitMatch = url.match(/\\/rest\\/contests\\/(\\w+)\\/challenges\\/([\\w-]+)\\/submissions/);
      if (submitMatch) {
        var response = await origFetch.apply(this, args);
        var clone = response.clone();
        try {
          var data = await clone.json();
          var submissionId = data.model?.id || data.id;
          var contestSlug = submitMatch[1];
          var challengeSlug = submitMatch[2];

          // Try to extract code and language from request body
          var code = '';
          var lang = '';
          if (args[1] && args[1].body) {
            try {
              var body = JSON.parse(args[1].body);
              code = body.code || '';
              lang = body.language || '';
            } catch(e) {}
          }

          if (submissionId) {
            pollHRResult(submissionId, contestSlug, challengeSlug, code, lang);
          }
        } catch(e) { /* parse error */ }
        return response;
      }

      return origFetch.apply(this, args);
    };

    async function pollHRResult(subId, contestSlug, challengeSlug, code, lang) {
      var deadline = Date.now() + POLL_TIMEOUT;
      while (Date.now() < deadline) {
        try {
          var url = '/rest/contests/' + contestSlug + '/submissions/' + subId;
          var res = await origFetch(url, { credentials: 'include' });
          var data = await res.json();
          var model = data.model || data;

          if (model.status !== undefined && model.status !== 'Processing') {
            var status = (model.status || '').toLowerCase();
            var verdict = '';
            if (status === 'wrong answer' || status.includes('wrong')) verdict = 'wrong_answer';
            else if (status.includes('time')) verdict = 'tle';
            else if (status.includes('runtime') || status.includes('segfault')) verdict = 'runtime_error';
            else if (status.includes('compilation') || status.includes('compile')) verdict = 'compile_error';
            else if (status.includes('memory')) verdict = 'mle';
            else if (status === 'accepted') return; // not a failure

            if (!verdict) return;

            var failingCases = [];
            if (model.expected_output || model.stdout) {
              failingCases.push({
                input: model.stdin || '',
                expected: model.expected_output || '',
                got: model.stdout || '',
              });
            }

            window.postMessage({
              type: MSG,
              payload: {
                platform: 'hackerrank',
                problemSlug: challengeSlug,
                problemTitle: '',
                language: lang || model.language || '',
                code: code || model.code || '',
                verdict: verdict,
                failingTestCases: failingCases,
                errorMessage: model.compile_message || model.stderr || null,
              }
            }, '*');
            return;
          }
          await new Promise(function(r) { setTimeout(r, POLL_INTERVAL); });
        } catch(e) {
          await new Promise(function(r) { setTimeout(r, POLL_INTERVAL); });
        }
      }
    }
  })();`;
}

// ── Init ────────────────────────────────────────────────────────────

function injectMainWorldScript(): void {
  const script = document.createElement("script");
  script.textContent = getInjectorCode();
  (document.head ?? document.documentElement).appendChild(script);
  script.remove();
}

function listenForSubmissions(): void {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== MSG_SUBMISSION) return;
    if (event.data.payload?.platform !== "hackerrank") return;

    const raw = event.data.payload;
    const verdict = normalizeVerdict(raw.verdict);
    if (!verdict) return;

    const submission: UnifiedSubmission = {
      platform: "hackerrank",
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
    };

    await sendToServiceWorker(submission);
  });
}

function init(): void {
  if (!isOnProblemPage()) return;
  console.log("[CodeMirror] HackerRank adapter attached");
  injectMainWorldScript();
  listenForSubmissions();
  listenForOverlay();
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, { once: true });
}
