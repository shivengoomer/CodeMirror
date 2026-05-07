/**
 * GeeksForGeeks content script (isolated world).
 *
 * GFG uses XHR (not fetch) for submissions, so we intercept
 * XMLHttpRequest.prototype.open/send in the MAIN world.
 */

import type { UnifiedSubmission } from "../shared/types";
import { MSG_SUBMISSION, GFG_LANGUAGE_MAP } from "../shared/constants";
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
  return /\/problems\/[\w-]+/.test(window.location.pathname);
}

function extractSlug(): string {
  const match = window.location.pathname.match(/\/problems\/([\w-]+)/);
  return match?.[1] ?? "unknown";
}

function extractTitle(): string {
  const el =
    document.querySelector("h3.problems_header_content__title__L2cB2") ??
    document.querySelector(".problem-tab h3") ??
    document.querySelector("h3");
  return el?.textContent?.trim() ?? extractSlug();
}

// ── Injector (MAIN world) ───────────────────────────────────────────

function getInjectorCode(): string {
  return `(function() {
    if (window.__codemirror_gfg_injected__) return;
    window.__codemirror_gfg_injected__ = true;

    var MSG = "${MSG_SUBMISSION}";
    var LANG_MAP = ${JSON.stringify(GFG_LANGUAGE_MAP)};

    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this.__cm_url = url;
      this.__cm_method = method;
      if (typeof url === 'string' &&
          (url.includes('/problems/submit/') ||
           url.includes('/api/problems/submit') ||
           url.includes('/compile-and-run/'))) {
        this.__cm_isSubmit = true;
      }
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      if (this.__cm_isSubmit && body) {
        var self = this;
        var reqBody = body;
        self.addEventListener('load', function() {
          try {
            var result = JSON.parse(self.responseText);
            // GFG returns different shapes; check for failure
            var status = (result.status || '').toLowerCase();
            var verdict = '';
            if (status === 'wrong answer' || status === 'wrong_answer' || result.isCorrect === false) {
              verdict = 'wrong_answer';
            } else if (status.includes('time limit') || status === 'tle') {
              verdict = 'tle';
            } else if (status.includes('runtime') || status === 'runtime error') {
              verdict = 'runtime_error';
            } else if (status.includes('compilation') || status === 'compile error') {
              verdict = 'compile_error';
            } else if (status.includes('memory') || status === 'mle') {
              verdict = 'mle';
            }

            if (!verdict) return; // accepted or unknown

            // Parse the request body for code & language
            var parsed = {};
            try { parsed = JSON.parse(reqBody); } catch(e) {
              try {
                // URL-encoded form data
                var params = new URLSearchParams(reqBody);
                parsed = Object.fromEntries(params.entries());
              } catch(e2) {}
            }

            var langId = parseInt(parsed.lang || parsed.language || '0', 10);
            var lang = LANG_MAP[langId] || parsed.lang || 'unknown';
            var code = parsed.code || parsed.solution || '';

            var failingCases = [];
            if (result.expected_output || result.your_output) {
              failingCases.push({
                input: result.input || '',
                expected: result.expected_output || '',
                got: result.your_output || result.output || '',
              });
            }

            window.postMessage({
              type: MSG,
              payload: {
                platform: 'gfg',
                problemSlug: '',
                problemTitle: '',
                language: lang,
                code: code,
                verdict: verdict,
                failingTestCases: failingCases,
                errorMessage: result.error_message || result.compilationError || null,
              }
            }, '*');
          } catch(e) { /* parse error */ }
        });
      }
      return origSend.apply(this, arguments);
    };
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
    if (event.data.payload?.platform !== "gfg") return;

    const raw = event.data.payload;
    const verdict = normalizeVerdict(raw.verdict);
    if (!verdict) return;

    const submission: UnifiedSubmission = {
      platform: "gfg",
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
  console.log("[CodeMirror] GFG adapter attached");
  injectMainWorldScript();
  listenForSubmissions();
  listenForOverlay();
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, { once: true });
}
