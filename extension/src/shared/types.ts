export type Platform = "leetcode" | "gfg" | "hackerrank";

export interface UnifiedSubmission {
  platform: Platform;
  problemSlug: string;
  problemTitle: string;
  language: string;
  code: string;
  verdict: "wrong_answer" | "tle" | "mle" | "runtime_error" | "compile_error";
  failingTestCases: unknown[];
  errorMessage: string | null;
  timestamp: number;
}
