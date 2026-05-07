(() => {
  if ((window as any).__codemirror_lc_injected__) return;
  (window as any).__codemirror_lc_injected__ = true;

  const MSG = "__CODEMIRROR_SUBMISSION__";
  const POLL_INTERVAL = 1000;
  const POLL_TIMEOUT = 15000;
  const VERDICT_MAP: Record<number, string> = {
    10: "accepted",
    11: "wrong_answer",
    12: "mle",
    14: "tle",
    15: "runtime_error",
    20: "compile_error",
  };

  const origFetch = window.fetch;

  function buildLCTestCases(data: any): Array<{ input: string; expected: string; got: string }> {
    const cases: Array<{ input: string; expected: string; got: string }> = [];
    if (data.input_formatted || data.expected_output || data.code_output) {
      cases.push({
        input: data.input_formatted || data.last_testcase || "",
        expected: data.expected_output || "",
        got: data.code_output || "",
      });
    }
    return cases;
  }

  async function pollResult(
    submissionId: string | number,
    code: string,
    lang: string,
    slug: string,
    submissionIdNumeric: number
  ): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT;
    while (Date.now() < deadline) {
      try {
        const res = await origFetch(`/submissions/detail/${submissionId}/check/`, { credentials: "include" });
        const data = await res.json();

        const state = (data?.state || "").toString().toUpperCase();
        if (state === "PENDING" || state === "STARTED") {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
          continue;
        }

        if (typeof data?.status_code === "number" && data.status_code !== 10) {
          window.postMessage(
            {
              type: MSG,
              payload: {
                platform: "leetcode",
                problemSlug: slug || "",
                problemTitle: "",
                language: lang,
                code: code,
                verdict: VERDICT_MAP[data.status_code] || "wrong_answer",
                failingTestCases: buildLCTestCases(data),
                errorMessage: data.status_msg || data.full_runtime_error || data.full_compile_error || null,
                leetcodeSubmissionId: submissionIdNumeric,
              },
            },
            "*"
          );
          return;
        }

        // Accepted or unexpected terminal response: stop polling.
        if (typeof data?.status_code === "number") {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
    }
  }

  window.fetch = async function (...args: any[]): Promise<Response> {
    const [url, options] = args;
    const urlStr = typeof url === "string" ? url : url?.url ?? "";

    if (urlStr.includes("/graphql")) {
      try {
        let rawBody: string | null = null;
        if (options?.body && typeof options.body === "string") {
          rawBody = options.body;
        } else if (url instanceof Request) {
          try {
            rawBody = await url.clone().text();
          } catch {
            rawBody = null;
          }
        }

        if (rawBody) {
          const body = JSON.parse(rawBody);
          const opName = (body.operationName || "").toString();
          if (
            opName === "submissionCreateSubmit" ||
            opName === "submitSolution" ||
            opName.toLowerCase().includes("submit")
          ) {
            const response = await origFetch.apply(this, args);
            const clone = response.clone();
            try {
              const data = await clone.json();
              const subId =
                data?.data?.submissionCreateSubmit?.submission_id ||
                data?.data?.submitSolution?.submission_id ||
                data?.data?.submit?.id;

              const variables = body.variables || {};
              const code = variables.typed_code || variables.code || "";
              const lang = variables.lang || variables.language || "";
              const slug = variables.questionSlug || variables.titleSlug || "";

              if (subId) {
                const parsedSubId = Number(subId);
                if (!Number.isNaN(parsedSubId) && Number.isFinite(parsedSubId)) {
                  void pollResult(subId, code, lang, slug, parsedSubId);
                }
              }
            } catch {
              // no-op
            }
            return response;
          }
        }
      } catch {
        // no-op
      }
    }

    return origFetch.apply(this, args);
  };
})();
