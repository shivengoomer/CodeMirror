import {
  AnalyzeResponse,
  Notification,
  Pattern,
  RevisionSession,
  UserProfile,
  SubmissionStats,
  AuthResponse,
  Submission,
  RevisionItem,
  SyncStatus,
  CacheStats
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "cm_dashboard_access_token";

export async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  let data: any;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = data?.detail || data?.message || (typeof data === 'string' ? data : JSON.stringify(data)) || "API request failed";
    throw new Error(errorMsg);
  }
  return data as T;
}

export const api = {
  // Auth
  register: (data: any) => fetchWithAuth<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (credentials: any) => fetchWithAuth<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  logout: (refresh_token: string) => fetchWithAuth<any>("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token }) }),
  getProfile: () => fetchWithAuth<UserProfile>("/auth/me"),
  updateProfile: (data: Partial<UserProfile>) => fetchWithAuth<UserProfile>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
  syncLeetCodeSession: (data: any) => fetchWithAuth<any>("/auth/leetcode-session", { method: "POST", body: JSON.stringify(data) }),

  // Submissions
  listSubmissions: (params: any = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchWithAuth<{ items: Submission[], total: number }>("/submissions?" + query);
  },
  getSubmission: (id: string) => fetchWithAuth<Submission>(`/submissions/${id}`),
  analyzeLatest: () => fetchWithAuth<AnalyzeResponse>("/submissions/leetcode/latest/analyze", { method: "POST" }),
  getStats: () => fetchWithAuth<SubmissionStats>("/stats"),

  // Patterns
  getPatterns: () => fetchWithAuth<Pattern[]>("/patterns"),
  createPattern: (data: any) => fetchWithAuth<Pattern>("/patterns", { method: "POST", body: JSON.stringify(data) }),
  getPattern: (id: string) => fetchWithAuth<any>(`/patterns/${id}`),
  updatePattern: (id: string, data: any) => fetchWithAuth<Pattern>(`/patterns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePattern: (id: string) => fetchWithAuth<void>(`/patterns/${id}`, { method: "DELETE" }),

  // Revision Queue
  listRevisionQueue: () => fetchWithAuth<RevisionItem[]>("/revision-queue"),
  getRevisionToday: () => fetchWithAuth<RevisionSession>("/revision-queue/today"),
  completeRevision: (id: string, quality: number, last_verdict: string) =>
    fetchWithAuth<RevisionItem>(`/revision-queue/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ quality, last_verdict })
    }),
  deleteRevision: (id: string) => fetchWithAuth<void>(`/revision-queue/${id}`, { method: "DELETE" }),

  // Notifications
  getNotifications: () => fetchWithAuth<Notification[]>("/notifications/unread"),

  // Chat
  chat: (message: string, context: any) => fetchWithAuth<{ text: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({ message, ...context })
  }),

  // Sync
  getSyncStatus: () => fetchWithAuth<SyncStatus>("/sync/status"),
  triggerSync: () => fetchWithAuth<any>("/sync/submissions", { method: "POST" }),
  triggerInitialSync: () => fetchWithAuth<any>("/sync/initial", { method: "POST" }),
  skipInitialSync: () => fetchWithAuth<any>("/sync/later", { method: "POST" }),
  getProblems: () => fetchWithAuth<{ problems: any[] }>("/sync/problems"),
  backfillCode: () => fetchWithAuth<{ status: string; pending_count: number }>("/sync/backfill-code", { method: "POST" }),

  // Cache
  getCacheStats: () => fetchWithAuth<CacheStats>("/cache/stats"),
  deleteCacheAnalysis: (id: string) => fetchWithAuth<void>(`/cache/analysis/${id}`, { method: "DELETE" }),

  // Health
  health: () => fetchWithAuth<{ status: string }>("/health"),

  // ── V2 Endpoints (Prefixed with /api/v1) ──────────────────────

  // Analysis (V2)
  getAnalysisV2: (id: string) => fetchWithAuth<any>(`/api/v1/analysis/${id}`),
  reanalyzeSubmission: (id: string) => fetchWithAuth<any>(`/api/v1/analysis/${id}/reanalyze`, { method: "POST" }),
  getPatternsV2: () => fetchWithAuth<any[]>("/api/v1/analysis/patterns"),
  getTopicStrengths: () => fetchWithAuth<import("@/types/api").TopicStrength[]>("/api/v1/analysis/topics/strength"),
  getLearningStyle: () => fetchWithAuth<import("@/types/api").LearningStyle>("/api/v1/analysis/learning-style"),

  // Analytics (V2)
  getDashboardSummary: () => fetchWithAuth<import("@/types/api").DashboardSummary>("/api/v1/analytics/dashboard"),
  getHeatmap: (type: string) => fetchWithAuth<{ data: any, generated_at: string }>(`/api/v1/analytics/heatmap/${type}`),
  getTrends: (days: number = 30) => fetchWithAuth<import("@/types/api").TrendData[]>(`/api/v1/analytics/trends?days=${days}`),
  getDailyReports: (days: number = 7) => fetchWithAuth<import("@/types/api").DailyReport[]>(`/api/v1/analytics/reports/daily?days=${days}`),
  getInterviewReadiness: () => fetchWithAuth<import("@/types/api").InterviewReadiness>("/api/v1/analytics/interview-readiness"),

  // Roadmap (V2)
  getRoadmap: () => fetchWithAuth<import("@/types/api").Roadmap>("/api/v1/roadmap"),
  createRoadmap: (data: any) => fetchWithAuth<{ id: string, status: string }>("/api/v1/roadmap", { method: "POST", body: JSON.stringify(data) }),
  updateRoadmapProgress: (id: string) => fetchWithAuth<any>(`/api/v1/roadmap/${id}`, { method: "PUT" }),
};
