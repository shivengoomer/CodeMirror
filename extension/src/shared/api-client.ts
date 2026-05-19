import { API } from "./constants";
import { getAuthTokens, setAuthTokens, getSettings } from "./storage";
import type {
  AuthResponse,
  AuthTokens,
  MessageResponse,
  NotificationItem,
  PatternSummary,
  RevisionItem,
  SubmissionResponse,
  UnifiedSubmission,
  UserProfile,
} from "./types";

/**
 * Typed HTTP client for the CodeMirror backend.
 * Runs inside the service-worker (background) context.
 */
export class ApiClient {
  private static readonly REQUEST_TIMEOUT_MS = 10000;
  private static readonly MAX_RETRIES = 2;

  // ── HTTP primitives ───────────────────────────────────────────────

  private async baseUrl(): Promise<string> {
    return (await getSettings()).backendUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true
  ): Promise<T> {
    const base = await this.baseUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth) {
      const tokens = await getAuthTokens();
      if (tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
      }
    }

    const doFetch = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ApiClient.REQUEST_TIMEOUT_MS);
      try {
        return await fetch(`${base}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let res: Response;
    try {
      res = await doFetch();
    } catch (err) {
      if (ApiClient.MAX_RETRIES > 0) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          res = await doFetch();
        } catch {
          throw new Error("BACKEND_UNREACHABLE");
        }
      } else {
        throw new Error(`Network request failed: ${String(err)}`);
      }
    }

    // If 401 and we have a refresh token, try refresh once
    if (res.status === 401 && auth) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(method, path, body, true);
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        (errBody as Record<string, string>).error ??
        (errBody as Record<string, string>).detail ??
        `HTTP ${res.status}`
      );
    }

    return (await res.json()) as T;
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const tokens = await getAuthTokens();
      if (!tokens?.refresh_token) return false;

      const base = await this.baseUrl();
      const res = await fetch(`${base}${API.AUTH_REFRESH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as { access_token: string };
      await setAuthTokens({
        access_token: data.access_token,
        refresh_token: tokens.refresh_token,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────

  async register(payload: {
    email: string;
    password: string;
    leetcode_username?: string;
    gfg_username?: string;
    hackerrank_username?: string;
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>("POST", API.AUTH_REGISTER, payload, false);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>(
      "POST",
      API.AUTH_LOGIN,
      { email, password },
      false
    );
  }

  async me(): Promise<UserProfile> {
    return this.request<UserProfile>("GET", API.AUTH_ME);
  }

  async syncLeetCodeSession(payload: {
    leetcode_session?: string;
    leetcode_csrf?: string;
    leetcode_headers?: Record<string, string>;
  }): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      "POST",
      API.AUTH_LEETCODE_SESSION,
      payload
    );
  }

  async syncExtension(payload: { submissions: any[] }): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      "POST",
      "/sync/extension",
      payload
    );
  }

  // ── Submissions ───────────────────────────────────────────────────

  async submitFailure(
    submission: UnifiedSubmission
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      API.SUBMISSIONS,
      submission
    );
  }

  // ── Patterns ──────────────────────────────────────────────────────

  async getPatterns(): Promise<PatternSummary[]> {
    return this.request<PatternSummary[]>("GET", API.PATTERNS);
  }

  // ── Revision Queue ────────────────────────────────────────────────

  async getRevisionToday(): Promise<RevisionItem[]> {
    return this.request<RevisionItem[]>("GET", API.REVISION_TODAY);
  }

  // ── Notifications ─────────────────────────────────────────────────

  async getUnreadNotifications(): Promise<NotificationItem[]> {
    return this.request<NotificationItem[]>("GET", API.NOTIFICATIONS_UNREAD);
  }

  // ── Health ────────────────────────────────────────────────────────

  async health(): Promise<{ status: string }> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}${API.HEALTH}`);
    return (await res.json()) as { status: string };
  }

  // ── Convenience: build popup data ─────────────────────────────────

  async fetchPopupData(): Promise<MessageResponse> {
    try {
      const tokens = await getAuthTokens();
      if (!tokens) {
        return {
          success: true,
          data: {
            authenticated: false,
            user: null,
            stats: { submissions_this_week: 0, failures_this_week: 0 },
            top_patterns: [],
            revision_due_today: 0,
            notifications: [],
          },
        };
      }

      const [user, patterns, revision, notifications] = await Promise.all([
        this.me().catch(() => null),
        this.getPatterns().catch(() => []),
        this.getRevisionToday().catch(() => []),
        this.getUnreadNotifications().catch(() => []),
      ]);

      if (!user) {
        return {
          success: true,
          data: {
            authenticated: false,
            user: null,
            stats: { submissions_this_week: 0, failures_this_week: 0 },
            top_patterns: [],
            revision_due_today: 0,
            notifications: [],
          },
        };
      }

      return {
        success: true,
        data: {
          authenticated: true,
          user,
          stats: { submissions_this_week: 0, failures_this_week: 0 },
          top_patterns: (patterns as PatternSummary[]).slice(0, 3),
          revision_due_today: (revision as RevisionItem[]).length,
          notifications: notifications as NotificationItem[],
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}

/** Singleton API client */
export const apiClient = new ApiClient();
