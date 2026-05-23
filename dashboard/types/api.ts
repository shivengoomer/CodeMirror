export interface AIAnalysis {
  root_cause: string;
  failure_category: string;
  what_they_thought: string;
  what_is_actually_true: string;
  code_evidence: string;
  fix_direction: string;
  pattern_signal: string | null;
  severity: "habit" | "gap" | "slip";
  repair_exercise: string;
}

export interface OverlayData {
  headline: string;
  body: string;
  call_to_action: string;
  badge_label: string;
  error_types: string[];
  concepts: string[];
  is_recurring: boolean;
  ai_analysis: AIAnalysis | null;
}

export interface AnalyzeResponse {
  status: string;
  submission_id?: string;
  problem_slug?: string;
  verdict?: string;
  overlay_data: OverlayData | null;
}

export interface UserProfile {
  id: string;
  email: string;
  leetcode_username: string | null;
  gfg_username: string | null;
  hackerrank_username: string | null;
  timezone: string;
  available_minutes_per_day: number;
  onboarding_complete: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}

export interface Pattern {
  id: string;
  tag: string;
  title: string;
  insight: string;
  occurrence_count: number;
  impact: string;
  confidence: number;
  last_seen: string;
}

export interface Submission {
  id: string;
  platform: string;
  problem_slug: string;
  problem_title: string;
  language: string;
  verdict: string;
  submitted_at: string;
  analysed: boolean;
  ai_analysis: AIAnalysis | null;
  code_snapshot: string;
  error_message: string | null;
  failing_test_cases: Array<{
    input: string;
    expected: string;
    got: string;
  }>;
}

export interface RevisionItem {
  id: string;
  problem_slug: string;
  platform: string;
  problem_title: string;
  linked_pattern_id: string | null;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  next_due: string;
  last_reviewed: string | null;
  last_verdict: string | null;
}

export interface RevisionSession {
  items: RevisionItem[];
  plan: {
    due_today: Array<{
      problem_title: string;
      reason: string;
      focus_question: string;
      last_mistake: string;
      expected_duration_mins: number;
    }>;
    streak_status: string;
    recommendation?: string;
  };
}

export interface Notification {
  title: string;
  body: string;
  type: string;
}

export interface SubmissionStats {
  weekly_total: number;
  weekly_failed: number;
  weekly_accepted: number;
  failure_rate: number;
}

export interface SyncStatus {
  ready: boolean;
  progress: number;
  has_leetcode_session?: boolean;
  needs_initial_sync?: boolean;
  sync_status?: string;
  last_synced_at?: string | null;
  total_submissions?: number;
  last_sync_error?: string | null;
}

export interface CacheStats {
  submission_analyses: number;
  problem_metadata: number;
  problem_tags: number;
}

// ── V2 Architecture Types ────────────────────────────────────────

export interface TopicStrength {
  topic: string;
  strength_score: number;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  avoidance_score: number;
  last_practiced_at: string | null;
}

export interface DashboardSummary {
  weekly_total: number;
  weekly_accepted: number;
  weekly_failed: number;
  acceptance_rate: number;
  topic_strengths: TopicStrength[];
  strongest_topics: TopicStrength[];
  weakest_topics: TopicStrength[];
}

export interface InterviewReadiness {
  status?: string;
  overall_score: number;
  easy_score: number;
  medium_score: number;
  hard_score: number;
  target_company: string | null;
  topics_strong: string[];
  topics_weak: string[];
  estimated_days_to_ready: number;
}

export interface DailyReport {
  date: string;
  summary: string;
  problems_solved: number;
  achievements: any;
  areas_of_concern: any;
  recommendations: any;
}

export interface LearningStyle {
  rushing_score: number;
  pattern_copying_score: number;
  debugging_strength: number;
  optimization_thinking: number;
  consistency_score: number;
  preferred_difficulty: string;
  analysis_summary: string;
  recommendations: any;
}

export interface Roadmap {
  id: string;
  goal: string;
  timeline_weeks: number;
  target_company: string | null;
  target_role: string | null;
  weekly_plan: any;
  milestones: any;
  current_week: number;
  completion_percentage: number;
  status: string;
}

export interface TrendData {
  date: string;
  total: number;
  accepted: number;
  failed: number;
  acceptance_rate: number;
}
