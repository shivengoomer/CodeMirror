"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Code2, CheckCircle2, XCircle, Search,
  AlertTriangle, ChevronDown, Brain, Terminal, Clock,
  Filter, SlidersHorizontal, Layers, Play, Pause, RotateCcw,
  Sparkles, Zap, Cpu, RefreshCw
} from "lucide-react";

const VERDICT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  accepted:      { color: "#10D986", bg: "rgba(16,217,134,0.08)",  border: "rgba(16,217,134,0.2)",  icon: CheckCircle2 },
  wrong_answer:  { color: "#FF5058", bg: "rgba(255,80,88,0.08)",   border: "rgba(255,80,88,0.2)",   icon: XCircle },
  runtime_error: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)",  icon: AlertTriangle },
  compile_error: { color: "#8B5CF6", bg: "rgba(139,92,246,0.08)",  border: "rgba(139,92,246,0.2)",  icon: Terminal },
  tle:           { color: "#3B82F6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)",  icon: Clock },
};

function VerdictPill({ verdict }: { verdict: string }) {
  const cfg = VERDICT_CONFIG[verdict.toLowerCase()] ?? {
    color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", icon: Code2,
  };
  const Icon = cfg.icon;
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <Icon size={10} />
      {verdict.replace(/_/g, " ")}
    </span>
  );
}

function LangBadge({ lang }: { lang: string }) {
  const colors: Record<string, string> = {
    python3: "#3B82F6", java: "#F59E0B", cpp: "#8B5CF6",
    javascript: "#EAB308", typescript: "#3B82F6", go: "#10D986", rust: "#F97316",
  };
  const color = colors[lang?.toLowerCase()] ?? "rgba(255,255,255,0.3)";
  return (
    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
      {lang}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ErrorTraceAnimator: Steps through error trace with Framer Motion animations
   ───────────────────────────────────────────────────────────────────────────── */
interface ErrorTraceAnimatorProps {
  errorMessage: string;
  failingTestCases: any[];
}

function ErrorTraceAnimator({ errorMessage, failingTestCases }: ErrorTraceAnimatorProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { label: "Parse Input", desc: "Analyzing inputs and initial parameters" },
    { label: "Trace Logic", desc: "Simulating execution steps on failing cases" },
    { label: "Exception Halt", desc: "Encountered runtime crash or mismatch" }
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="bg-[#0b0b14] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#F59E0B]/5 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
        <span className="text-[10px] font-mono font-semibold text-[#F59E0B] uppercase tracking-widest flex items-center gap-1.5">
          <Terminal size={10} /> Runtime Exception Trace
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            title={isPlaying ? "Pause Trace" : "Play Trace"}
          >
            {isPlaying ? <Pause size={10} /> : <Play size={10} />}
          </button>
          <button
            onClick={() => { setCurrentStep(0); setIsPlaying(true); }}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            title="Reset"
          >
            <RotateCcw size={10} />
          </button>
        </div>
      </div>

      {/* Visual Stepper */}
      <div className="flex justify-between items-center gap-2 px-1 py-1">
        {steps.map((s, idx) => {
          const isActive = currentStep === idx;
          const isCompleted = currentStep > idx;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={clsx(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border transition-all duration-300",
                  isActive ? "bg-[#F59E0B] border-[#F59E0B] text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                  isCompleted ? "bg-[#10D986] border-[#10D986] text-black" :
                  "bg-white/5 border-white/10 text-white/30"
                )}
              >
                {idx + 1}
              </div>
              <span className={clsx("text-[8px] font-mono uppercase tracking-wider", isActive ? "text-[#F59E0B] font-bold animate-pulse" : "text-white/30")}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="bg-black/40 border border-white/[0.04] rounded-lg p-3 text-[11px] font-mono min-h-[72px] flex flex-col justify-center leading-relaxed"
        >
          {currentStep === 0 && (
            <div>
              <span className="text-[#F59E0B] font-bold block mb-1">Step 1: Input Ingestion</span>
              {failingTestCases && failingTestCases.length > 0 ? (
                <div className="text-white/60 space-y-0.5">
                  <div>Input: <span className="text-white/90">{JSON.stringify(failingTestCases[0].input)}</span></div>
                  <div>Expected: <span className="text-[#10D986]/80">{failingTestCases[0].expected || "None"}</span></div>
                </div>
              ) : (
                <div className="text-white/40">Initial test arguments processed. Checking execution variables.</div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-0.5">
              <span className="text-[#F59E0B] font-bold block">Step 2: Execution Path Trace</span>
              <span className="text-white/70 animate-pulse block">⚡ Scanning recursive/iterative call stack...</span>
              <span className="text-white/40">Variables loaded. Analyzing mismatch invariant.</span>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <span className="text-rose-500 font-bold flex items-center gap-1 mb-1">❌ Step 3: Diagnostic Exception Halt</span>
              <pre className="text-rose-400 bg-rose-950/20 border border-rose-900/30 p-2 rounded max-h-24 overflow-y-auto text-[10px] leading-4 whitespace-pre-wrap">
                {errorMessage}
              </pre>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MentalModelComparer: Renders Assumption vs Reality side-by-side
   ───────────────────────────────────────────────────────────────────────────── */
interface MentalModelComparerProps {
  whatTheyThought: string;
  whatIsActuallyTrue: string;
}

function MentalModelComparer({ whatTheyThought, whatIsActuallyTrue }: MentalModelComparerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-[#6C63FF]/15 border border-[#6C63FF]/25 flex items-center justify-center">
          <Brain size={11} className="text-[#6C63FF]" />
        </div>
        <span className="text-[10px] font-mono font-semibold text-[#6C63FF] uppercase tracking-widest">
          Cognitive Model Analysis
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Assumption */}
        <div className="relative group rounded-xl bg-[#FF5058]/[0.02] border border-[#FF5058]/[0.08] hover:border-[#FF5058]/[0.2] p-3.5 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF5058]/[0.01] rounded-full blur-xl group-hover:bg-[#FF5058]/[0.03] transition-all duration-300" />
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#FF5058] uppercase tracking-widest font-bold mb-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
            </span>
            What You Thought
          </div>
          <p className="text-[11.5px] leading-relaxed text-white/70">
            {whatTheyThought || "Implicit assumption that the standard code structure or variables were meeting invariants without edge case handling."}
          </p>
        </div>

        {/* Reality */}
        <div className="relative group rounded-xl bg-[#10D986]/[0.02] border border-[#10D986]/[0.08] hover:border-[#10D986]/[0.2] p-3.5 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#10D986]/[0.01] rounded-full blur-xl group-hover:bg-[#10D986]/[0.03] transition-all duration-300" />
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#10D986] uppercase tracking-widest font-bold mb-1.5">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            What is Actually True
          </div>
          <p className="text-[11.5px] leading-relaxed text-white/70">
            {whatIsActuallyTrue || "The actual program invariant demands handling specific bounds, time complexity constraints, or data types explicitly."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CodeComparisonView: Shows current vs optimal code in a beautiful layout
   ───────────────────────────────────────────────────────────────────────────── */
interface CodeComparisonViewProps {
  submissionId: string;
  wrongCode: string;
  refactoredCode: string | null;
  language: string;
  problemSlug: string;
  onGenerate: () => void;
  isGenerating: boolean;
}

function CodeComparisonView({
  submissionId,
  wrongCode,
  refactoredCode,
  language,
  problemSlug,
  onGenerate,
  isGenerating
}: CodeComparisonViewProps) {
  const [activeTab, setActiveTab] = useState<"current" | "optimal">("current");

  const ext = language === "python3" ? "py" : language === "java" ? "java" : language === "cpp" ? "cpp" : "js";

  return (
    <div className="flex flex-col h-full">
      {/* IDE-like header with Tab bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.02] gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <span className="ml-2 text-[11px] font-mono text-white/35">
            {problemSlug}.{ext}
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-[#0d0d18] border border-white/[0.08] rounded-lg p-0.5 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("current")}
            className={clsx(
              "px-3 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all",
              activeTab === "current" ? "bg-[#FF5058]/10 text-[#FF5058] border border-[#FF5058]/20" : "text-white/40 hover:text-white/60"
            )}
          >
            Your Code
          </button>
          <button
            onClick={() => setActiveTab("optimal")}
            className={clsx(
              "px-3 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all",
              activeTab === "optimal" ? "bg-[#10D986]/10 text-[#10D986] border border-[#10D986]/20" : "text-white/40 hover:text-white/60"
            )}
          >
            Optimal Code
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-auto max-h-[380px] custom-scrollbar bg-[#08080f]/80 p-5 font-mono text-[12px] leading-6 whitespace-pre min-w-0">
        {activeTab === "current" ? (
          wrongCode ? (
            <pre className="text-white/65 overflow-x-auto">
              <code>{wrongCode}</code>
            </pre>
          ) : (
            <div className="flex items-center justify-center h-32 text-white/20">No code snapshot available</div>
          )
        ) : refactoredCode ? (
          <pre className="text-emerald-400/80 overflow-x-auto">
            <code>{refactoredCode}</code>
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4 border border-dashed border-white/[0.06] rounded-xl m-2 bg-white/[0.01]">
            <div className="w-10 h-10 rounded-full bg-[#6C63FF]/10 flex items-center justify-center text-[#6C63FF]">
              <Cpu size={18} className={isGenerating ? "animate-spin" : ""} />
            </div>
            <div className="max-w-[280px] space-y-1">
              <p className="text-[12px] font-semibold text-white/80">Generate Optimal Refactoring</p>
              <p className="text-[10px] text-white/35 leading-relaxed">Let AI build a clean, benchmark-optimized version of your submission.</p>
            </div>
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6C63FF]/15 border border-[#6C63FF]/30 hover:bg-[#6C63FF]/25 text-[#6C63FF] text-[11px] font-mono uppercase tracking-widest font-semibold transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={11} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap size={11} />
                  Analyze & Refactor
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Visualizer Link Footer */}
      <div className="p-3 border-t border-white/[0.05] bg-[#07070b]/60 flex justify-end shrink-0">
        <a
          href={`/visualizer?subId=${submissionId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)]/30 hover:bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-mono uppercase tracking-wider font-semibold transition-all shadow"
        >
          <Code2 size={11} /> Visualize Execution Trace
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Submissions Page Component
   ───────────────────────────────────────────────────────────────────────────── */
export default function SubmissionsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState(15);
  const queryClient = useQueryClient();
  const [localAnalyzingId, setLocalAnalyzingId] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["submissions", pageSize],
    queryFn: () => api.listSubmissions({ limit: pageSize }),
  });

  const submissions = data?.items ?? [];
  const totalSubmissions = data?.total ?? 0;

  const filtered = submissions.filter((s: any) => {
    const matchSearch = !searchQuery || s.problem_title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchVerdict = verdictFilter === "all" || s.verdict?.toLowerCase() === verdictFilter;
    return matchSearch && matchVerdict;
  });

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const handleGenerateAnalysis = async (subId: string) => {
    setLocalAnalyzingId(subId);
    try {
      await api.getAnalysisV2(subId);
      // Invalidate query to refetch submissions and load analysis
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    } catch (err) {
      console.error(err);
    } finally {
      setLocalAnalyzingId(null);
    }
  };

  const handleBackfillCode = async () => {
    setIsBackfilling(true);
    setBackfillMsg(null);
    try {
      const result = await api.backfillCode();
      if (result.status === "nothing_to_backfill") {
        setBackfillMsg("All submissions already have code ✓");
      } else {
        setBackfillMsg(`Fetching code for ${result.pending_count} submission${result.pending_count !== 1 ? "s" : ""} in background…`);
        // Refresh after a delay to show updated code
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["submissions"] });
          setBackfillMsg(null);
        }, 8000);
      }
    } catch (err: any) {
      setBackfillMsg(`Failed: ${err.message}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  // Count submissions with empty code
  const missingCodeCount = submissions.filter((s: any) => !s.code_snapshot).length;

  const verdictCounts = submissions.reduce((acc: any, s: any) => {
    const v = s.verdict?.toLowerCase() ?? "unknown";
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Header Controls ── */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" size={15} />
          <input
            type="text"
            placeholder="Search by problem title..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d0d18]/80 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-[13px] text-white/80 focus:outline-none focus:border-[#6C63FF]/40 focus:bg-[#0d0d18] placeholder:text-white/20 transition-all font-sans"
          />
        </div>

        {/* Verdict Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#0d0d18]/60 border border-white/[0.07] rounded-xl p-1 overflow-x-auto scrollbar-none shrink-0">
          {["all", "accepted", "wrong_answer", "runtime_error", "tle"].map(v => {
            return (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all duration-150 whitespace-nowrap",
                  verdictFilter === v
                    ? "bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/25"
                    : "text-white/25 hover:text-white/50"
                )}
              >
                {v === "all" ? `All ${totalSubmissions}` : `${v.replace(/_/g, " ")} ${verdictCounts[v] ?? 0}`}
              </button>
            );
          })}
        </div>

        {/* Backfill Code Button — shown when submissions have missing code */}
        {missingCodeCount > 0 && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              id="backfill-code-btn"
              onClick={handleBackfillCode}
              disabled={isBackfilling}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] hover:bg-[#F59E0B]/[0.12] text-[#F59E0B] text-[11px] font-mono uppercase tracking-widest font-semibold transition-all disabled:opacity-50 whitespace-nowrap"
              title={`${missingCodeCount} submission(s) are missing code. Click to fetch from LeetCode.`}
            >
              {isBackfilling ? (
                <><RefreshCw size={12} className="animate-spin" /> Fetching Code…</>
              ) : (
                <><Code2 size={12} /> Fetch Missing Code ({missingCodeCount})</>
              )}
            </button>
            {backfillMsg && (
              <p className="text-[10px] text-[#F59E0B]/70 font-mono px-1">{backfillMsg}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 skeleton rounded-2xl animate-pulse bg-white/[0.02]" />)}
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <PremiumCard variant="flat">
          <div className="py-6 text-center text-[13px] text-[#FF5058] font-mono">
            Failed to load submissions. Check your session.
          </div>
        </PremiumCard>
      )}

      {/* ── Submissions List ── */}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PremiumCard variant="flat" className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Layers size={28} className="text-white/15" />
                    <p className="text-[13px] text-white/30 font-mono">No submissions match your filter</p>
                  </div>
                </PremiumCard>
              </motion.div>
            ) : (
              filtered.map((sub: any, idx: number) => {
                const isOpen = expandedId === sub.id;
                const cfg = VERDICT_CONFIG[sub.verdict?.toLowerCase()] ?? VERDICT_CONFIG["wrong_answer"];
                const hasAnalysis = !!sub.ai_analysis && sub.analysed;
                const hasError = !!sub.error_message;
                const isAnalyzing = localAnalyzingId === sub.id;

                return (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.025, 0.4) }}
                  >
                    {/* ── Row ── */}
                    <div
                      className={clsx(
                        "rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer",
                        isOpen
                          ? "border-[#6C63FF]/30 bg-[#0f0f1e]"
                          : "border-white/[0.06] bg-[#0d0d18]/60 hover:border-white/[0.12] hover:bg-[#0d0d18]/90"
                      )}
                      onClick={() => toggle(sub.id)}
                    >
                      <div className="flex items-center gap-4 px-5 py-4">
                        {/* Left accent bar */}
                        <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: cfg.color, opacity: 0.6 }} />

                        {/* Problem info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[14px] font-semibold text-white/90 truncate">{sub.problem_title}</span>
                            {sub.problem_slug && (
                              <span className="text-[10px] font-mono text-white/20">#{sub.problem_slug}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {sub.language && <LangBadge lang={sub.language} />}
                            {hasAnalysis && (
                              <span className="flex items-center gap-1 text-[9px] font-mono text-[#6C63FF] uppercase tracking-widest">
                                <Brain size={9} /> AI Analysis
                              </span>
                            )}
                            {hasError && (
                              <span className="flex items-center gap-1 text-[9px] font-mono text-[#F59E0B] uppercase tracking-widest">
                                <Terminal size={9} /> Diagnostic
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-3 shrink-0">
                          <VerdictPill verdict={sub.verdict ?? "unknown"} />
                          {sub.submitted_at && (
                            <span className="text-[10px] font-mono text-white/20 hidden md:block">
                              {new Date(sub.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={15} className="text-white/25" />
                          </motion.div>
                        </div>
                      </div>

                      {/* ── Expanded Panel ── */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden border-t border-white/[0.05]"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="grid grid-cols-1 lg:grid-cols-5 min-h-0">

                              {/* ── Left: Analysis & Diagnostics ── */}
                              <div className="lg:col-span-2 p-5 flex flex-col gap-5 border-r border-white/[0.05]">
                                
                                {/* Trigger Analysis Inline if Not Analyzed */}
                                {!hasAnalysis && (
                                  <div className="flex flex-col gap-3 p-4 rounded-xl border border-dashed border-[#6C63FF]/30 bg-[#6C63FF]/[0.02] text-center items-center py-6">
                                    <div className="w-9 h-9 rounded-lg bg-[#6C63FF]/15 flex items-center justify-center text-[#6C63FF] mb-1">
                                      <Brain size={16} className={isAnalyzing ? "animate-pulse" : ""} />
                                    </div>
                                    <p className="text-[12px] font-medium text-white/80">AI Insight Pending</p>
                                    <p className="text-[10px] text-white/35 max-w-[220px] leading-relaxed">Retrieve recursive diagnostic reports, mental model comparisons, and code corrections.</p>
                                    <button
                                      onClick={() => handleGenerateAnalysis(sub.id)}
                                      disabled={isAnalyzing}
                                      className="flex items-center gap-1.5 px-4.5 py-1.5 rounded-lg bg-[#6C63FF] hover:bg-[#6C63FF]/90 text-white text-[10px] font-mono uppercase tracking-widest font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_12px_rgba(108,99,255,0.2)] mt-2"
                                    >
                                      {isAnalyzing ? (
                                        <>
                                          <RefreshCw size={11} className="animate-spin" />
                                          Processing...
                                        </>
                                      ) : (
                                        "Generate Insight"
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* AI Analysis Details */}
                                {hasAnalysis && (
                                  <div className="flex flex-col gap-5">
                                    {/* Headline & Mistake Class */}
                                    <div className="flex flex-col gap-2">
                                      <span className="text-[9px] font-mono text-[#6C63FF] uppercase tracking-widest block font-semibold">Root Cause Invariant</span>
                                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[12px] leading-relaxed text-white/80">
                                        <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">
                                          Category: {sub.ai_analysis.failure_category?.replace(/_/g, " ")}
                                        </div>
                                        {sub.ai_analysis.root_cause}
                                      </div>
                                    </div>

                                    {/* Assumption vs Reality (Error compare mistake) */}
                                    <MentalModelComparer
                                      whatTheyThought={sub.ai_analysis.what_they_thought}
                                      whatIsActuallyTrue={sub.ai_analysis.what_is_actually_true}
                                    />

                                    {/* Fix Direction / Spaced Repetition */}
                                    <div className="p-3.5 rounded-xl bg-[#10D986]/[0.03] border border-[#10D986]/[0.1] flex flex-col gap-1.5">
                                      <span className="text-[9px] font-mono text-[#10D986] uppercase tracking-widest font-bold flex items-center gap-1">
                                        <Sparkles size={10} /> Correction Strategy
                                      </span>
                                      <p className="text-[12px] leading-relaxed text-white/70">
                                        {sub.ai_analysis.fix_direction}
                                      </p>
                                      {sub.ai_analysis.repair_exercise && (
                                        <div className="border-t border-[#10D986]/10 pt-2 mt-1">
                                          <span className="text-[9px] font-mono text-[#10D986]/60 uppercase tracking-wider block font-medium">Practice Drill</span>
                                          <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">{sub.ai_analysis.repair_exercise}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Error/Diagnostics Callstack Animator */}
                                {hasError && (
                                  <ErrorTraceAnimator
                                    errorMessage={sub.error_message}
                                    failingTestCases={sub.failing_test_cases}
                                  />
                                )}
                              </div>

                              {/* ── Right: Code Comparison Panel ── */}
                              <div className="lg:col-span-3 flex flex-col">
                                <CodeComparisonView
                                  submissionId={sub.id}
                                  wrongCode={sub.code_snapshot}
                                  refactoredCode={sub.ai_analysis?.refactored_code || null}
                                  language={sub.language ?? "python3"}
                                  problemSlug={sub.problem_slug}
                                  onGenerate={() => handleGenerateAnalysis(sub.id)}
                                  isGenerating={isAnalyzing}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pagination / Load More ── */}
      {!isLoading && !isError && totalSubmissions > submissions.length && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setPageSize(prev => prev + 15)}
            disabled={isFetching}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/[0.08] bg-[#0d0d18]/60 hover:bg-[#0d0d18] text-white/60 hover:text-white text-[12px] font-mono uppercase tracking-widest font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            {isFetching ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                Loading submissions...
              </>
            ) : (
              "Load More Submissions"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
