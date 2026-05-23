"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Brain, Target, TrendingUp, AlertTriangle,
  CheckCircle2, Shield, Calendar, XCircle, Code2, Database,
  Clock, ArrowUpRight, Zap, BarChart3, Eye, Sparkles, Check
} from "lucide-react";
import clsx from "clsx";

function formatDueDate(isoString: string) {
  const date = new Date(isoString);
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { label: "Due Today", type: "today" };
  if (diffDays === 1) return { label: "Tomorrow", type: "tomorrow" };
  return { label: `In ${diffDays}d`, type: "future" };
}

// ── Intersection Observer Hook for Count-Up Viewport Trigger ──
function useInView() {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}

// ── Smooth Count-Up Animation Component ──
function CountUp({ value, prefix = "", suffix = "" }: { value: number | string; prefix?: string; suffix?: string }) {
  const numericVal = typeof value === "number" ? value : parseFloat(value.toString().replace(/[^0-9.]/g, ""));
  const [current, setCurrent] = useState(0);
  const [ref, inView] = useInView();

  useEffect(() => {
    if (!inView || isNaN(numericVal)) {
      if (!inView) setCurrent(0);
      return;
    }
    let start = 0;
    const end = numericVal;
    if (start === end) {
      setCurrent(end);
      return;
    }
    const duration = 1000; // ms
    const increment = end / (duration / 16); // ~60fps
    let timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCurrent(end);
      } else {
        setCurrent(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [numericVal, inView]);

  return (
    <span ref={ref} className="font-mono">
      {prefix}
      {isNaN(numericVal) ? value : (numericVal % 1 === 0 ? Math.round(current) : current.toFixed(1))}
      {suffix}
    </span>
  );
}

// ── Premium Metric Card with Label on Top ──
function MetricCard({ title, value, subtitle, icon: Icon, color, bg, border, dotColor, delay }: any) {
  const isPercent = typeof value === "string" && value.includes("%");
  const numberPart = isPercent ? parseFloat(value) : (typeof value === "number" ? value : parseFloat(value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <PremiumCard className="p-0 overflow-hidden" variant="elevated">
        <div className="p-8 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[var(--foreground-muted)] uppercase tracking-[0.08em] font-semibold">
              {title}
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
              />
              <Icon size={14} className={color} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[36px] font-bold tracking-tight text-[var(--foreground)] leading-none font-mono">
              <CountUp value={numberPart} suffix={isPercent ? "%" : ""} />
            </span>
            <span className="text-[11px] text-[var(--foreground-muted)] font-mono mt-0.5">
              {subtitle}
            </span>
          </div>
        </div>
      </PremiumCard>
    </motion.div>
  );
}

function TopicBar({ topic, score, isWeak }: { topic: string; score: number; isWeak?: boolean }) {
  return (
    <div className="flex items-center gap-3 group">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: isWeak ? "var(--error)" : "var(--success)",
          boxShadow: isWeak ? "0 0 8px var(--error)" : "0 0 8px var(--success)"
        }}
      />
      <span className="text-[13px] text-[var(--foreground-muted)] flex-1 group-hover:text-[var(--foreground)] transition-colors truncate">
        {topic}
      </span>
      <div className="flex items-center gap-2 w-32 shrink-0">
        <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            className="h-full rounded-full"
            style={{
              background: isWeak
                ? "linear-gradient(90deg, var(--error), var(--accent-alt))"
                : "linear-gradient(90deg, var(--success), var(--accent))"
            }}
          />
        </div>
        <span className={clsx("text-[11px] font-mono font-semibold w-8 text-right", isWeak ? "text-[var(--error)]" : "text-[var(--success)]")}>
          {score.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function DashboardView() {
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // ── Queries ──
  const { data: syncStatus, refetch: checkSync } = useQuery({
    queryKey: ["syncStatus"],
    queryFn: api.getSyncStatus,
    refetchInterval: (query: any) => (query.state.data?.ready ? false : 3000),
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: api.getDashboardSummary,
    enabled: !!syncStatus?.ready,
  });

  const { data: readiness } = useQuery({
    queryKey: ["interviewReadiness"],
    queryFn: api.getInterviewReadiness,
    enabled: !!syncStatus?.ready,
  });

  const { data: submissionsData } = useQuery({
    queryKey: ["submissions", { limit: 5 }],
    queryFn: () => api.listSubmissions({ limit: 5 }),
    enabled: !!syncStatus?.ready,
  });

  const { data: revisionSession, refetch: refetchRevision } = useQuery({
    queryKey: ["revisionToday"],
    queryFn: api.getRevisionToday,
    enabled: !!syncStatus?.ready,
  });

  // ── Mutations ──
  const initialSyncMutation = useMutation({
    mutationFn: api.triggerInitialSync,
    onSuccess: () => checkSync(),
  });

  const skipSyncMutation = useMutation({
    mutationFn: api.skipInitialSync,
    onSuccess: () => checkSync(),
  });

  const completeRevisionMutation = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) =>
      api.completeRevision(id, quality, "accepted"),
    onSuccess: () => {
      refetchRevision();
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Filter items due today for Revision Alerts
  const dueToday = revisionSession?.items?.filter((i: any) => {
    const d = formatDueDate(i.next_due);
    return d.type === "today";
  }) || [];

  // Onboarding gate
  if (syncStatus && !syncStatus.ready) {
    const isSyncing = syncStatus.sync_status === "in_progress" || initialSyncMutation.isPending;
    const hasSession = !!syncStatus.has_leetcode_session;

    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <PremiumCard glow variant="accent">
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/10 blur-md" />
                <div className="w-14 h-14 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center relative z-10">
                  <Brain size={24} className="text-[var(--accent)] animate-pulse" />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-[17px] font-semibold text-[var(--foreground)] font-display tracking-tight mb-2">
                  {hasSession ? "Initialize Integration" : "Connect LeetCode Account"}
                </h2>
                <p className="text-[12px] text-[var(--foreground-muted)] leading-relaxed px-2">
                  {hasSession
                    ? "Sync your code history to build your AI performance maps, error profiles, and personalized revision queues."
                    : "Use the CodeMirror Chrome extension to capture your login session cookie. Waiting for sync token..."}
                </p>
              </div>

              {hasSession && !isSyncing && syncStatus.last_sync_error && (
                <div className="w-full rounded-lg border border-[var(--error)]/20 bg-[var(--error)]/[0.04] p-3 text-[11px] text-[var(--error)] font-mono">
                  {syncStatus.last_sync_error}
                </div>
              )}

              {hasSession && (
                isSyncing ? (
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 text-[var(--accent)] text-[12px] font-mono">
                      <Database size={13} className="animate-pulse" />
                      Parsing submissions...
                    </div>
                    <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-green)] rounded-full w-1/3"
                        animate={{ x: ["-100%", "400%"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 w-full mt-2">
                    <button
                      onClick={() => initialSyncMutation.mutate()}
                      disabled={initialSyncMutation.isPending || skipSyncMutation.isPending}
                      className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity hover:shadow-glow"
                    >
                      <Database size={12} />
                      Sync All
                    </button>
                    <button
                      onClick={() => skipSyncMutation.mutate()}
                      disabled={initialSyncMutation.isPending || skipSyncMutation.isPending}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white/[0.02] px-4 py-2.5 text-[12px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--hover-bg)] disabled:opacity-50 transition-all"
                    >
                      <Clock size={12} />
                      Skip
                    </button>
                  </div>
                )
              )}

              {!hasSession && (
                <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-green)] rounded-full w-1/3"
                    animate={{ x: ["-100%", "400%"] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                </div>
              )}
            </div>
          </PremiumCard>
        </motion.div>
      </div>
    );
  }

  const coachRec = revisionSession?.plan?.recommendation || "Prioritize reinforcement reviews on high-friction topics like Dynamic Programming to clear error logs.";

  return (
    <div className="flex flex-col gap-8 w-full relative">
      {/* ── Metric Card Row ── */}
      {isLoadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 skeleton animate-pulse" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Weekly Attempts"
            value={summary.weekly_total}
            subtitle="Attempts logged this week"
            icon={Code2}
            color="text-[var(--accent-blue)]"
            bg="bg-white/[0.02]"
            border="border-[var(--border)]"
            dotColor="var(--accent-blue)"
            delay={0.03}
          />
          <MetricCard
            title="Acceptance Rate"
            value={`${summary.acceptance_rate?.toFixed(1) ?? 0}%`}
            subtitle="Average solution score"
            icon={Target}
            color="text-[var(--accent)]"
            bg="bg-white/[0.02]"
            border="border-[var(--border)]"
            dotColor="var(--accent)"
            delay={0.06}
          />
          <MetricCard
            title="Accepted Log"
            value={summary.weekly_accepted}
            subtitle="reinforcements resolved"
            icon={CheckCircle2}
            color="text-[var(--accent-green)]"
            bg="bg-white/[0.02]"
            border="border-[var(--border)]"
            dotColor="var(--accent-green)"
            delay={0.09}
          />
          <MetricCard
            title="Friction Rate"
            value={summary.weekly_failed}
            subtitle="Unresolved error inputs"
            icon={XCircle}
            color="text-[var(--error)]"
            bg="bg-white/[0.02]"
            border="border-[var(--border)]"
            dotColor="var(--error)"
            delay={0.12}
          />
        </div>
      ) : null}

      {/* ── Asymmetric Layout 7:5 split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side (7/12 width) */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* AI Coach Daily Recommendation */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard variant="accent" glow className="p-0">
              <div className="px-8 py-4 border-b border-[var(--border)] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[var(--accent)] animate-pulse" />
                  <span className="text-[10px] font-mono font-semibold text-[var(--foreground)] uppercase tracking-[0.08em]">
                    AI Strategy Roadmap
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[var(--foreground-muted)]">
                  <span>Streak status:</span>
                  <span className="text-[var(--accent-green)] font-semibold">{revisionSession?.plan?.streak_status || "ACTIVE"}</span>
                </div>
              </div>
              <div className="p-8 flex flex-col gap-4">
                <p className="text-[13.5px] text-[var(--foreground-muted)] italic leading-relaxed font-sans">
                  "{coachRec}"
                </p>
                <div className="flex justify-end">
                  <a
                    href="/chat"
                    className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[var(--accent)] hover:text-[var(--accent-alt)] transition-colors hover:text-glow"
                  >
                    Discuss with Coach <ArrowUpRight size={12} />
                  </a>
                </div>
              </div>
            </PremiumCard>
          </motion.div>

          {/* Cognitive Topic Map */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard variant="elevated" className="p-0">
              <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--border)] bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                    <Brain size={13} className="text-[var(--accent)]" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold text-[var(--foreground)] font-display tracking-tight">Cognitive Topic Map</h2>
                    <p className="text-[10px] text-[var(--foreground-muted)] font-mono mt-0.5">Strength parameters across sync matrices</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {summary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Weak Topics */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                        <AlertTriangle size={11} className="text-[var(--error)]" />
                        <span className="text-[9px] font-mono font-semibold text-[var(--error)] uppercase tracking-wider">Critical Gaps</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {summary.weakest_topics?.length > 0 ? (
                          summary.weakest_topics.map((t: any) => (
                            <TopicBar key={t.topic} topic={t.topic} score={t.strength_score ?? t.score ?? 0} isWeak />
                          ))
                        ) : (
                          <div className="py-6 text-center text-[11px] text-[var(--foreground-muted)]/40 font-mono border border-dashed border-[var(--border)] rounded-lg">
                            No active gaps recorded
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Strong Topics */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                        <TrendingUp size={11} className="text-[var(--accent-green)]" />
                        <span className="text-[9px] font-mono font-semibold text-[var(--accent-green)] uppercase tracking-wider">Verified Masteries</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {summary.strongest_topics?.length > 0 ? (
                          summary.strongest_topics.map((t: any) => (
                            <TopicBar key={t.topic} topic={t.topic} score={t.strength_score ?? t.score ?? 0} />
                          ))
                        ) : (
                          <div className="py-6 text-center text-[11px] text-[var(--foreground-muted)]/40 font-mono border border-dashed border-[var(--border)] rounded-lg">
                            Solve more problems to compute masteries
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-[var(--foreground-muted)]/30">
                      <BarChart3 size={28} />
                      <span className="text-[11px] font-mono">Awaiting data parsing...</span>
                    </div>
                  </div>
                )}

                {/* All Topics List */}
                {summary && summary.topic_strengths && summary.topic_strengths.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-[var(--border)]">
                    <span className="text-[9.5px] font-mono text-[var(--foreground-muted)] uppercase tracking-wider block mb-4">Strength Profiles</span>
                    <div className="flex flex-col gap-3">
                      {summary.topic_strengths.slice(0, 6).map((t: any) => (
                        <TopicBar
                          key={t.topic}
                          topic={t.topic}
                          score={t.strength_score ?? t.score ?? 0}
                          isWeak={(t.strength_score ?? t.score ?? 0) < 50}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PremiumCard>
          </motion.div>

          {/* Recent Submissions */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard variant="elevated" className="p-0">
              <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--border)] bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center">
                    <Code2 size={13} className="text-[var(--accent-blue)]" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold text-[var(--foreground)] font-display tracking-tight">Recent Submissions</h2>
                    <p className="text-[10px] text-[var(--foreground-muted)] font-mono mt-0.5">Your latest problem-solving attempts</p>
                  </div>
                </div>
              </div>

              <div className="p-8 flex flex-col gap-3">
                {submissionsData?.items && submissionsData.items.length > 0 ? (
                  submissionsData.items.map((sub: any, idx: number) => (
                    <motion.div
                      key={sub.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={clsx(
                        "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-[var(--border)] transition-all gap-4 group",
                        idx % 2 === 0 ? "bg-white/[0.01]" : "bg-transparent",
                        "hover:bg-[var(--hover-bg)] hover:border-[var(--accent)]/30"
                      )}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={clsx(
                          "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
                          sub.verdict === "accepted"
                            ? "bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]"
                            : "bg-[var(--error)]/10 border-[var(--error)]/25 text-[var(--error)]"
                        )}>
                          {sub.verdict === "accepted" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-semibold text-[var(--foreground)] truncate leading-snug">{sub.problem_title}</h3>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-[var(--foreground-muted)]">
                            <span className="uppercase">{sub.language}</span>
                            <span>•</span>
                            <span>
                              {new Date(sub.submitted_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-end shrink-0">
                        <span className={clsx(
                          "text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider leading-none",
                          sub.verdict === "accepted"
                            ? "text-[var(--success)] border-[var(--success)]/20 bg-[var(--success)]/5"
                            : "text-[var(--error)] border-[var(--error)]/20 bg-[var(--error)]/5"
                        )}>
                          {sub.verdict.replace("_", " ")}
                        </span>
                        
                        {sub.analysed ? (
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)] hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/40 text-[10.5px] font-semibold transition-all hover:shadow-glow"
                          >
                            <Eye size={11} />
                            Diagnosis
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--foreground-muted)]/40 font-mono italic animate-pulse">Analyzing...</span>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-10 text-center text-[11px] text-[var(--foreground-muted)]/40 font-mono border border-dashed border-[var(--border)] rounded-lg">
                    No submissions logged. Click sync to retrieve history.
                  </div>
                )}
              </div>
            </PremiumCard>
          </motion.div>

        </div>

        {/* Right Side (5/12 width) */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* Interview Readiness */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard variant="elevated" className="p-0">
              <div className="flex items-center gap-3 px-8 py-5 border-b border-[var(--border)] bg-white/[0.01]">
                <div className="w-7 h-7 rounded-lg bg-[var(--accent-alt)]/10 border border-[var(--accent-alt)]/20 flex items-center justify-center">
                  <Shield size={13} className="text-[var(--accent-alt)]" />
                </div>
                <div>
                  <h2 className="text-[13px] font-semibold text-[var(--foreground)] font-display tracking-tight">Interview Readiness</h2>
                  <p className="text-[10px] text-[var(--foreground-muted)] font-mono mt-0.5">Composite capability estimation score</p>
                </div>
              </div>

              <div className="p-8 flex flex-col gap-6">
                {readiness && readiness.status !== "not_assessed" ? (
                  <>
                    {/* Ring score wrapper */}
                    <div className="flex items-center justify-center py-2">
                      <div className="relative w-32 h-32">
                        <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 144 144">
                          <circle cx="72" cy="72" r="60" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="none" />
                          <motion.circle
                            cx="72" cy="72" r="60"
                            stroke="var(--accent)"
                            strokeWidth="8"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 60}`}
                            initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - (readiness.overall_score ?? 0) / 100) }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[32px] font-bold text-[var(--foreground)] leading-none font-mono">
                            <CountUp value={readiness.overall_score ?? 0} />
                          </span>
                          <span className="text-[9px] text-[var(--foreground-muted)] font-mono uppercase tracking-widest mt-1">/ 100</span>
                        </div>
                      </div>
                    </div>

                    {/* Target and Est Ready */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.01] border border-[var(--border)]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-[var(--foreground-muted)] font-mono uppercase tracking-wider">Target Profile</span>
                        <span className="text-[13px] font-semibold text-[var(--foreground)]">{readiness.target_company || "FAANG"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-[9px] text-[var(--foreground-muted)] font-mono uppercase tracking-wider">Estimated Gap</span>
                        <span className="text-[13px] font-semibold text-[var(--accent)]">
                          {readiness.estimated_days_to_ready ?? "?"} Days
                        </span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: "Easy", score: readiness.easy_score ?? 0, color: "var(--success)" },
                        { label: "Medium", score: readiness.medium_score ?? 0, color: "var(--warning)" },
                        { label: "Hard", score: readiness.hard_score ?? 0, color: "var(--error)" },
                      ].map(({ label, score, color }) => (
                        <div key={label} className="flex flex-col gap-2 p-3 rounded-lg bg-white/[0.01] border border-[var(--border)]">
                          <span className="text-[9px] font-mono text-[var(--foreground-muted)] uppercase tracking-wider">{label}</span>
                          <span className="text-[16px] font-bold font-mono" style={{ color }}>{score.toFixed(0)}%</span>
                          <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 1, delay: 0.5 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-alt)]/10 border border-[var(--accent-alt)]/20 flex items-center justify-center">
                      <Calendar size={16} className="text-[var(--accent-alt)]/50 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[12px] text-[var(--foreground-muted)] font-medium">Ready Mapping Pending</p>
                      <p className="text-[10px] text-[var(--foreground-muted)]/40 font-mono mt-1 uppercase tracking-wider">Compute 10+ submissions to unlock</p>
                    </div>
                  </div>
                )}
              </div>
            </PremiumCard>
          </motion.div>

          {/* Revision Alerts */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {dueToday.length > 0 ? (
              <PremiumCard variant="accent" glow className="p-0 border-[var(--error)]/30">
                <div className="px-8 py-4 border-b border-[var(--error)]/20 flex items-center gap-3 bg-[var(--error)]/[0.02]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--error)] shadow-[0_0_8px_var(--error)] animate-pulse" />
                  <span className="text-[10px] font-mono font-semibold text-[var(--foreground)] uppercase tracking-wider">Revision Queue ({dueToday.length})</span>
                </div>
                <div className="p-8 flex flex-col gap-3">
                  {dueToday.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.01] border border-[var(--border)] hover:border-white/[0.1] transition-all">
                      <div className="flex-1 min-w-0 pr-3">
                        <h4 className="text-[12.5px] font-semibold text-[var(--foreground)] truncate">{item.problem_title}</h4>
                        <span className="text-[9px] font-mono text-[var(--foreground-muted)] uppercase tracking-wider mt-0.5 block">Spaced repetition reinforcement</span>
                      </div>
                      <button
                        onClick={() => completeRevisionMutation.mutate({ id: item.id, quality: 5 })}
                        disabled={completeRevisionMutation.isPending}
                        className="flex items-center justify-center w-6 h-6 rounded bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/20 hover:bg-[var(--accent-green)]/20 transition-all shrink-0 hover:shadow-[0_0_12px_rgba(16,217,134,0.3)]"
                        title="Reinforce completed"
                      >
                        <Check size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  {dueToday.length > 3 && (
                    <a href="/revision" className="text-center text-[10.5px] text-[var(--accent)] hover:text-[var(--accent-alt)] font-mono mt-2 flex items-center justify-center gap-1">
                      + {dueToday.length - 3} more reinforcement logs <Clock size={10} />
                    </a>
                  )}
                </div>
              </PremiumCard>
            ) : (
              <PremiumCard variant="flat" className="p-0">
                <div className="px-8 py-4 border-b border-[var(--border)] flex items-center gap-2 bg-white/[0.01]">
                  <Zap size={12} className="text-[var(--foreground-muted)]/40" />
                  <span className="text-[10px] font-mono font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Reinforcement Practice</span>
                </div>
                <div className="p-8 flex flex-col items-center justify-center text-center gap-4 py-10">
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 flex items-center justify-center text-[var(--accent-green)] shadow-[0_0_12px_rgba(16,217,134,0.15)]">
                    <Check size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--foreground)]">Practice Queue Clear</h4>
                    <p className="text-[9.5px] text-[var(--foreground-muted)]/50 font-mono mt-1 uppercase tracking-wider">All scheduled intervals reinforced</p>
                  </div>
                </div>
              </PremiumCard>
            )}
          </motion.div>

          {/* Engine Status */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <PremiumCard variant="flat" className="p-0">
              <div className="px-8 py-4 border-b border-[var(--border)] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-[var(--accent)]" />
                  <span className="text-[10px] font-mono font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Background Services</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-[var(--accent-green)] shadow-[0_0_6px_var(--accent-green)] animate-pulse" />
                  <span className="text-[8.5px] font-mono text-[var(--accent-green)] uppercase tracking-wider">Connected</span>
                </div>
              </div>
              <div className="p-8 flex flex-col gap-4">
                {[
                  { label: "Cognitive AI Profiler", status: "active", icon: Brain, color: "var(--accent)" },
                  { label: "LeetCode Scraping Matrix", status: syncStatus?.sync_status === "in_progress" ? "syncing" : "active", icon: Database, color: "var(--accent-green)" },
                  { label: "SuperMemo-2 Scheduler", status: "active", icon: Zap, color: "var(--warning)" },
                ].map(({ label, status, icon: Icon, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-white/[0.02] border border-[var(--border)]">
                      <Icon size={11} style={{ color }} />
                    </div>
                    <span className="flex-1 text-[12px] text-[var(--foreground-muted)]">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1 h-1 rounded-full shrink-0"
                        style={{
                          backgroundColor: status === "active" ? "var(--success)" : status === "syncing" ? "var(--accent-blue)" : "rgba(255,255,255,0.1)",
                          boxShadow: status === "active" ? "0 0 6px var(--success)" : status === "syncing" ? "0 0 6px var(--accent-blue)" : "none"
                        }}
                      />
                      <span className={clsx(
                        "text-[9px] font-mono uppercase tracking-wider",
                        status === "active" ? "text-[var(--success)]" : status === "syncing" ? "text-[var(--accent-blue)] animate-pulse" : "text-[var(--foreground-muted)]/30"
                      )}>
                        {status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </PremiumCard>
          </motion.div>

        </div>
      </div>

      {/* ── AI Diagnosis Modal ── */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="absolute inset-0" onClick={() => setSelectedSubmission(null)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-[var(--bg-secondary)]/95 border border-[var(--border)] shadow-premium flex flex-col relative z-10 font-sans"
            >
              <div className="absolute -top-[10%] left-[10%] w-[80%] h-[20%] bg-[var(--accent)]/[0.04] rounded-full blur-[40px] pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-start justify-between px-8 py-6 border-b border-[var(--border)] relative shrink-0">
                <div className="min-w-0 pr-6">
                  <span className={clsx(
                    "text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest",
                    selectedSubmission.verdict === "accepted"
                      ? "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20"
                      : "text-[var(--error)] bg-[var(--error)]/10 border-[var(--error)]/25"
                  )}>
                    {selectedSubmission.verdict.replace("_", " ")}
                  </span>
                  <h3 className="text-[16px] font-semibold text-[var(--foreground)] mt-2 font-display tracking-tight leading-tight truncate">
                    {selectedSubmission.problem_title}
                  </h3>
                  <p className="text-[10px] text-[var(--foreground-muted)] font-mono mt-0.5 uppercase tracking-wider">
                    {selectedSubmission.language} • synced on leetcode
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="w-7 h-7 rounded-lg bg-white/[0.02] border border-[var(--border)] hover:bg-white/[0.06] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all cursor-pointer text-lg font-light shrink-0"
                >
                  &times;
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                {/* Diagnosis */}
                <div className="flex flex-col gap-2">
                  <span className="text-[9.5px] font-mono text-[var(--error)] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={11} />
                    Cognitive Error Profiler
                  </span>
                  <div className="p-5 rounded-lg bg-white/[0.01] border border-[var(--border)]">
                    <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed font-mono whitespace-pre-wrap">
                      {selectedSubmission.ai_analysis?.root_cause || (selectedSubmission.ai_analysis as any)?.logical_mistakes?.[0]?.description || "Error vectors parsed during sync. Discuss resolution path with AI Coach below."}
                    </p>
                  </div>
                </div>

                {/* Category */}
                {selectedSubmission.ai_analysis?.failure_category && (
                  <div className="flex items-center gap-3 p-3.5 rounded-lg bg-white/[0.01] border border-[var(--border)] w-fit">
                    <span className="text-[9.5px] font-mono text-[var(--foreground-muted)] uppercase tracking-wider">Failure Class</span>
                    <span className="text-[11px] font-mono text-[var(--accent)] uppercase tracking-wider font-semibold">
                      {selectedSubmission.ai_analysis.failure_category.replace(/_/g, " ")}
                    </span>
                  </div>
                )}

                {/* Resolution */}
                <div className="flex flex-col gap-2">
                  <span className="text-[9.5px] font-mono text-[var(--accent-green)] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={11} />
                    Recommended Correction
                  </span>
                  <div className="p-5 rounded-lg bg-white/[0.01] border border-[var(--border)]">
                    <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.ai_analysis?.fix_direction || (selectedSubmission.ai_analysis as any)?.better_approach || "Refine standard logic. Review test cases for runtime bounds."}
                    </p>
                  </div>
                </div>

                {/* Repair Exercise */}
                {(selectedSubmission.ai_analysis?.repair_exercise || (selectedSubmission.ai_analysis as any)?.optimization_suggestions?.repair_exercise) && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[9.5px] font-mono text-[var(--warning)] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Zap size={11} />
                      Practice Reinforcement Exercise
                    </span>
                    <div className="p-5 rounded-lg bg-white/[0.01] border border-[var(--border)]">
                      <p className="text-[12.5px] text-[var(--foreground-muted)] leading-relaxed italic">
                        "{selectedSubmission.ai_analysis?.repair_exercise || (selectedSubmission.ai_analysis as any)?.optimization_suggestions?.repair_exercise}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-8 py-4 border-t border-[var(--border)] bg-white/[0.01] shrink-0">
                <span className="text-[9.5px] text-[var(--foreground-muted)]/40 font-mono">
                  LOG: {selectedSubmission.id.substring(0, 8)}
                </span>
                <a
                  href={`/chat?problem=${selectedSubmission.problem_slug}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:opacity-90 text-[12px] font-semibold text-white transition-all shadow-glow cursor-pointer"
                >
                  Discuss with Coach <ArrowUpRight size={11} />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
