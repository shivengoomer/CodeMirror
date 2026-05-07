// ── Platform & Verdict ──────────────────────────────────────────────
export type Platform = "leetcode" | "gfg" | "hackerrank";

export type Verdict =
  | "wrong_answer"
  | "tle"
  | "mle"
  | "runtime_error"
  | "compile_error";

// ── Submission ──────────────────────────────────────────────────────
export interface FailingTestCase {
  input: string;
  expected: string;
  got: string;
}

export interface UnifiedSubmission {
  platform: Platform;
  problem_slug: string;
  problem_title: string;
  language: string;
  code: string;
  verdict: Verdict;
  failing_test_cases: FailingTestCase[];
  error_message: string | null;
  timestamp: number;
  leetcode_submission_id?: number;
  leetcode_session?: string;
  leetcode_csrf?: string;
  leetcode_headers?: Record<string, string>;
}

/** Raw data posted from the MAIN-world injector via postMessage */
export interface RawSubmissionEvent {
  type: "__CODEMIRROR_SUBMISSION__";
  payload: {
    platform: Platform;
    problemSlug: string;
    problemTitle: string;
    language: string;
    code: string;
    verdict: string;
    failingTestCases: FailingTestCase[];
    errorMessage: string | null;
    leetcodeSubmissionId?: number;
  };
}

// ── Overlay ─────────────────────────────────────────────────────────
export interface OverlayData {
  headline: string;
  body: string;
  call_to_action: string;
  badge_label: string;
  error_types: string[];
  is_recurring: boolean;
}

// ── API Responses ───────────────────────────────────────────────────
export interface SubmissionResponse {
  submission_id: string;
  overlay_data: OverlayData;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  leetcode_username: string | null;
  gfg_username: string | null;
  hackerrank_username: string | null;
  timezone: string;
  available_minutes_per_day: number | null;
}

export interface PatternSummary {
  id: string;
  tag: string;
  title: string;
  insight: string;
  occurrence_count: number;
  confidence: number;
  impact: "low" | "medium" | "high" | "critical";
  concept_cluster: string[];
}

export interface RevisionItem {
  id: string;
  problem_slug: string;
  platform: Platform;
  problem_title: string;
  next_due: string;
  interval_days: number;
}

export interface NotificationItem {
  id: string;
  type: "weekly_digest" | "revision_reminder" | "pattern_found";
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// ── Popup Data ──────────────────────────────────────────────────────
export interface PopupData {
  authenticated: boolean;
  user: UserProfile | null;
  stats: {
    submissions_this_week: number;
    failures_this_week: number;
  };
  top_patterns: PatternSummary[];
  revision_due_today: number;
  notifications: NotificationItem[];
}

// ── Extension Settings ──────────────────────────────────────────────
export interface ExtensionSettings {
  backendUrl: string;
  enableLeetcode: boolean;
  enableGfg: boolean;
  enableHackerrank: boolean;
}

// ── Chrome Message Protocol ─────────────────────────────────────────
export type ExtensionMessage =
  | { type: "SUBMISSION_CAPTURED"; data: UnifiedSubmission }
  | { type: "GET_POPUP_DATA" }
  | { type: "GET_AUTH_STATUS" }
  | { type: "LOGIN"; data: { email: string; password: string } }
  | {
      type: "REGISTER";
      data: {
        email: string;
        password: string;
        leetcode_username?: string;
        gfg_username?: string;
        hackerrank_username?: string;
      };
    }
  | { type: "LOGOUT" }
  | { type: "UPDATE_SETTINGS"; data: Partial<ExtensionSettings> }
  | { type: "FLUSH_QUEUE" };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Offline Queue ───────────────────────────────────────────────────
export interface QueuedSubmission {
  submission: UnifiedSubmission;
  retries: number;
  addedAt: number;
}
