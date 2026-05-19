"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";
import { Activity, Brain, Target, TrendingUp, AlertTriangle, CheckCircle2, Shield, Calendar, XCircle, Code2, Database, Clock } from "lucide-react";
import clsx from "clsx";

function MetricCard({ title, value, subtitle, icon: Icon, color, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <PremiumCard className="flex flex-col gap-4 overflow-hidden group">
        <div className="flex items-center justify-between z-10">
          <span className="text-foreground/50 font-mono text-xs uppercase tracking-wider">{title}</span>
          <div className={clsx("p-2 rounded-xl bg-white/[0.03] border border-white/5", color)}>
            <Icon size={16} />
          </div>
        </div>
        <div className="flex flex-col gap-1 z-10">
          <span className="text-4xl font-semibold tracking-tight">{value}</span>
          <span className="text-foreground/40 text-xs font-mono">{subtitle}</span>
        </div>
        
        {/* Background gradient effect */}
        <div className={clsx("absolute -bottom-10 -right-10 w-32 h-32 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500 rounded-full", color.replace("text-", "bg-"))} />
      </PremiumCard>
    </motion.div>
  );
}

function TopicStrengthItem({ topic, score, isWeak = false }: { topic: string, score: number, isWeak?: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-foreground/90">{topic}</span>
        <span className={clsx("font-mono text-xs", isWeak ? "text-error" : "text-accent")}>{score.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={clsx("h-full rounded-full", isWeak ? "bg-error" : "bg-accent")}
        />
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { data: syncStatus, refetch: checkSync } = useQuery({
    queryKey: ["syncStatus"],
    queryFn: api.getSyncStatus,
    refetchInterval: (query: any) => (query.state.data?.ready ? false : 3000),
  });

  const initialSyncMutation = useMutation({
    mutationFn: api.triggerInitialSync,
    onSuccess: () => checkSync(),
  });

  const skipSyncMutation = useMutation({
    mutationFn: api.skipInitialSync,
    onSuccess: () => checkSync(),
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: api.getDashboardSummary,
    enabled: !!syncStatus?.ready,
  });

  const { data: readiness, isLoading: isLoadingReadiness } = useQuery({
    queryKey: ["interviewReadiness"],
    queryFn: api.getInterviewReadiness,
    enabled: !!syncStatus?.ready,
  });

  if (syncStatus && !syncStatus.ready) {
    const isSyncing = syncStatus.sync_status === "in_progress" || initialSyncMutation.isPending;
    const hasSession = !!syncStatus.has_leetcode_session;

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 p-8 max-w-md w-full"
        >
          <PremiumCard glow className="w-full text-center py-10 flex flex-col items-center justify-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-accent/20 blur-xl"></div>
              <Brain size={48} className="text-accent animate-pulse relative z-10" />
            </div>
            <h2 className="text-xl font-semibold mt-4">
              {hasSession ? "LeetCode Connected" : "Initializing Neural Core..."}
            </h2>
            {hasSession ? (
              <>
                <p className="text-foreground/50 text-sm font-mono text-center">
                  Import your full LeetCode history now so CodeMirror can build your dashboard, patterns, revision queue, and readiness signals from real submissions.
                </p>
                {syncStatus.last_sync_error && (
                  <div className="w-full rounded-lg border border-error/20 bg-error/10 p-3 text-xs text-error font-mono text-left">
                    {syncStatus.last_sync_error}
                  </div>
                )}
                {isSyncing ? (
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 text-accent text-sm font-mono">
                      <Database size={16} className="animate-pulse" />
                      Syncing all LeetCode submissions...
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                      <motion.div
                        className="absolute top-0 left-0 h-full bg-accent w-1/3 rounded-full"
                        animate={{ x: ["-100%", "300%"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-2">
                    <button
                      onClick={() => initialSyncMutation.mutate()}
                      disabled={initialSyncMutation.isPending || skipSyncMutation.isPending}
                      className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <Database size={16} />
                      Sync all data
                    </button>
                    <button
                      onClick={() => skipSyncMutation.mutate()}
                      disabled={initialSyncMutation.isPending || skipSyncMutation.isPending}
                      className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-foreground/70 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      <Clock size={16} />
                      Later
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-foreground/50 text-sm font-mono text-center">
                  Please click the CodeMirror extension icon to authenticate with LeetCode. We are waiting for your session token.
                </p>
                <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden relative">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-accent w-1/3 rounded-full"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                </div>
              </>
            )}
          </PremiumCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Intelligence Overview
          </h1>
          <p className="text-foreground/40 text-sm font-mono tracking-wide flex items-center gap-2">
            <Activity size={14} className="text-accent animate-pulse" />
            Neural metrics active
          </p>
        </div>
      </div>

      {(isLoadingSummary || isLoadingReadiness) && (
        <div className="flex items-center gap-3 text-foreground/40 font-mono text-xs animate-pulse p-4">
          <div className="w-2 h-2 rounded-full bg-accent" />
          Synchronizing metrics...
        </div>
      )}

      {/* Top Metrics Row */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard 
            title="Weekly Activity" 
            value={summary.weekly_total} 
            subtitle="Problems attempted" 
            icon={Code2} 
            color="text-blue-400"
            delay={0.1}
          />
          <MetricCard 
            title="Success Rate" 
            value={`${summary.acceptance_rate.toFixed(0)}%`} 
            subtitle="Accepted submissions" 
            icon={Target} 
            color="text-accent"
            delay={0.2}
          />
          <MetricCard 
            title="Clear" 
            value={summary.weekly_accepted} 
            subtitle="Accepted this week" 
            icon={CheckCircle2} 
            color="text-green-400"
            delay={0.3}
          />
          <MetricCard 
            title="Friction" 
            value={summary.weekly_failed} 
            subtitle="Failed this week" 
            icon={XCircle} 
            color="text-error"
            delay={0.4}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Topic Intelligence */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <PremiumCard glow>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg text-accent">
                      <Brain size={18} />
                    </div>
                    <h2 className="text-lg font-medium text-foreground/90">Cognitive Topic Map</h2>
                  </div>
                </div>

                {summary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Weak Topics */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-error font-mono text-xs uppercase tracking-widest">
                        <AlertTriangle size={14} /> Critical Weaknesses
                      </div>
                      <div className="flex flex-col gap-3">
                        {summary.weakest_topics?.length > 0 ? (
                          summary.weakest_topics.map((t: any) => (
                            <TopicStrengthItem key={t.topic} topic={t.topic} score={t.strength_score} isWeak={true} />
                          ))
                        ) : (
                          <div className="text-foreground/40 text-sm font-mono p-4 border border-white/5 rounded-xl text-center">No critical weaknesses detected</div>
                        )}
                      </div>
                    </div>

                    {/* Strong Topics */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-accent font-mono text-xs uppercase tracking-widest">
                        <TrendingUp size={14} /> Verified Masteries
                      </div>
                      <div className="flex flex-col gap-3">
                        {summary.strongest_topics?.length > 0 ? (
                          summary.strongest_topics.map((t: any) => (
                            <TopicStrengthItem key={t.topic} topic={t.topic} score={t.strength_score} isWeak={false} />
                          ))
                        ) : (
                          <div className="text-foreground/40 text-sm font-mono p-4 border border-white/5 rounded-xl text-center">Not enough data for masteries</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-foreground/30 font-mono text-sm">Waiting for data...</div>
                )}
              </div>
            </PremiumCard>
          </motion.div>
        </div>

        {/* Right Column: Interview Readiness */}
        <div className="flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
            <PremiumCard className="border-l-4 border-l-purple-500 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="flex flex-col gap-8 relative z-10">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                    <Shield size={18} />
                  </div>
                  <h2 className="text-lg font-medium text-foreground/90">Interview Readiness</h2>
                </div>

                {readiness && readiness.status !== "not_assessed" ? (
                  <div className="flex flex-col gap-8 items-center pt-4">
                    {/* Score Ring */}
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="absolute w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/5" />
                        <circle 
                          cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" 
                          strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * readiness.overall_score) / 100}
                          className="text-purple-500 transition-all duration-1000 ease-out" 
                        />
                      </svg>
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold text-foreground">{readiness.overall_score.toFixed(0)}</span>
                        <span className="text-[10px] text-foreground/40 font-mono uppercase tracking-widest">/ 100</span>
                      </div>
                    </div>

                    <div className="w-full flex flex-col gap-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground/60">Target: {readiness.target_company || "FAANG"}</span>
                        <span className="text-purple-400 font-mono">{readiness.estimated_days_to_ready || "?"} days</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
                          <span className="text-foreground/40">Easy</span>
                          <span className="text-green-400">{(readiness.easy_score || 0).toFixed(0)}%</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
                          <span className="text-foreground/40">Med</span>
                          <span className="text-yellow-400">{(readiness.medium_score || 0).toFixed(0)}%</span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
                          <span className="text-foreground/40">Hard</span>
                          <span className="text-error">{(readiness.hard_score || 0).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                    <Calendar className="text-foreground/20" size={24} />
                    <span className="text-foreground/40 text-sm font-mono max-w-[200px]">Solve more problems to unlock readiness assessment</span>
                  </div>
                )}
              </div>
            </PremiumCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
