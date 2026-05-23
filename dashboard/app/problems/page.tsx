"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Search,
  BookOpen,
  Brain,
  Sparkles,
  Filter,
  ChevronDown,
  RotateCcw,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Award,
  Zap,
  Calendar,
  Code2
} from "lucide-react";
import clsx from "clsx";

interface Problem {
  title: string;
  titleSlug: string;
  timestamp: number;
  statusDisplay: string;
  lang: string;
  difficulty: string;
  tags: any[];
  totalAttempts: number;
  failedAttempts: number;
}

const getTagName = (tag: any): string => {
  if (!tag) return "";
  if (typeof tag === "string") return tag;
  if (typeof tag === "object" && tag.name) return tag.name;
  if (typeof tag === "object" && tag.slug) return tag.slug;
  return String(tag);
};

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

export default function MakeYourselfGoodPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "revision" | "friction" | "solved">("all");
  const [sortBy, setSortBy] = useState<"attempts" | "failure_rate" | "recent" | "difficulty">("attempts");

  // ── Queries ──
  const { data: problemsData, isLoading: isLoadingProblems, error: problemsError } = useQuery({
    queryKey: ["problems"],
    queryFn: api.getProblems,
  });

  const { data: strengthsData, isLoading: isLoadingStrengths } = useQuery({
    queryKey: ["topicStrengths"],
    queryFn: api.getTopicStrengths,
  });

  const { data: patternsData } = useQuery({
    queryKey: ["patterns"],
    queryFn: api.getPatterns,
  });

  const { data: revisionData } = useQuery({
    queryKey: ["revisionQueue"],
    queryFn: api.listRevisionQueue,
  });

  const problems = (problemsData?.problems as Problem[]) ?? [];
  const patterns = patternsData ?? [];
  const revisionItems = revisionData ?? [];
  const topicStrengths = strengthsData ?? [];

  // Parse and normalize tags and compute stats dynamically
  const computedTopicStats = useMemo(() => {
    const stats: Record<string, {
      topic: string;
      totalAttempts: number;
      successfulAttempts: number;
      failedAttempts: number;
      strengthScore: number;
      problemsCount: number;
      problems: Problem[];
    }> = {};

    problems.forEach((p) => {
      const tags = p.tags || [];
      tags.forEach((tag: any) => {
        const tagName = getTagName(tag);
        if (!tagName) return;
        // Normalize tag name (e.g. dynamic-programming -> Dynamic Programming)
        const normalized = tagName
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        if (!stats[normalized]) {
          stats[normalized] = {
            topic: normalized,
            totalAttempts: 0,
            successfulAttempts: 0,
            failedAttempts: 0,
            strengthScore: 0,
            problemsCount: 0,
            problems: [],
          };
        }
        stats[normalized].problemsCount += 1;
        stats[normalized].totalAttempts += p.totalAttempts || 1;
        stats[normalized].failedAttempts += p.failedAttempts || 0;
        if (p.statusDisplay === "Accepted") {
          stats[normalized].successfulAttempts += 1;
        }
        stats[normalized].problems.push(p);
      });
    });

    return Object.values(stats).map((stat) => {
      // Find matching strength from backend topicStrengths if available
      const matchingStrength = topicStrengths.find(
        (ts) => ts.topic.toLowerCase() === stat.topic.toLowerCase()
      );

      let strengthScore = 100;
      if (stat.totalAttempts > 0) {
        const successRate = ((stat.totalAttempts - stat.failedAttempts) / stat.totalAttempts) * 100;
        strengthScore = Math.max(0, Math.min(100, successRate));
      }

      if (matchingStrength && matchingStrength.strength_score !== undefined) {
        strengthScore = matchingStrength.strength_score;
      }

      return {
        ...stat,
        strengthScore,
        avoidanceScore: matchingStrength?.avoidance_score ?? 0,
      };
    }).sort((a, b) => a.strengthScore - b.strengthScore); // Weakest topic first
  }, [problems, topicStrengths]);

  // Focus Stacks: Topics with lowest strength score and at least 2 attempts
  const focusStacks = useMemo(() => {
    return computedTopicStats
      .filter((stat) => stat.totalAttempts > 1)
      .slice(0, 3);
  }, [computedTopicStats]);

  // Overall KPIs calculation
  const kpis = useMemo(() => {
    const totalAttempts = problems.reduce((sum, p) => sum + (p.totalAttempts || 1), 0);
    const failedAttempts = problems.reduce((sum, p) => sum + (p.failedAttempts || 0), 0);
    const acceptanceRate = totalAttempts > 0 ? ((totalAttempts - failedAttempts) / totalAttempts) * 100 : 100;

    const revisionCount = revisionItems.length;
    const weakTopicsCount = computedTopicStats.filter((stat) => stat.strengthScore < 60).length;
    const activePatternsCount = patterns.length;

    return {
      totalAttempts,
      acceptanceRate,
      revisionCount,
      weakTopicsCount,
      activePatternsCount,
    };
  }, [problems, revisionItems, computedTopicStats, patterns]);

  // Active AI Insight logic based on selected tag or fallback to worst pattern
  const activeCoachInsight = useMemo(() => {
    if (selectedTag) {
      const matchingPatterns = patterns.filter(
        (p) =>
          p.tag?.toLowerCase() === selectedTag.toLowerCase() ||
          selectedTag.toLowerCase().includes(p.tag?.toLowerCase())
      );
      if (matchingPatterns.length > 0) {
        return matchingPatterns[0];
      }
    }
    return patterns.length > 0 ? patterns[0] : null;
  }, [patterns, selectedTag]);

  // Filters application
  const filteredProblems = useMemo(() => {
    let result = [...problems];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.title?.toLowerCase().includes(q) || p.titleSlug?.toLowerCase().includes(q)
      );
    }

    if (selectedTag) {
      result = result.filter((p) =>
        (p.tags || []).some(
          (t: any) => {
            const tagName = getTagName(t);
            return (
              tagName.toLowerCase() === selectedTag.toLowerCase() ||
              tagName.replace(/-/g, " ").toLowerCase() === selectedTag.toLowerCase()
            );
          }
        )
      );
    }

    if (selectedDifficulty) {
      result = result.filter(
        (p) => p.difficulty?.toLowerCase() === selectedDifficulty.toLowerCase()
      );
    }

    if (filterStatus !== "all") {
      if (filterStatus === "revision") {
        const revSlugs = new Set(revisionItems.map((item) => item.problem_slug));
        result = result.filter((p) => revSlugs.has(p.titleSlug));
      } else if (filterStatus === "friction") {
        result = result.filter((p) => p.failedAttempts > 0);
      } else if (filterStatus === "solved") {
        result = result.filter((p) => p.statusDisplay === "Accepted");
      }
    }

    result.sort((a, b) => {
      if (sortBy === "attempts") {
        return (b.totalAttempts || 1) - (a.totalAttempts || 1);
      }
      if (sortBy === "failure_rate") {
        const rateA = a.totalAttempts > 0 ? a.failedAttempts / a.totalAttempts : 0;
        const rateB = b.totalAttempts > 0 ? b.failedAttempts / b.totalAttempts : 0;
        return rateB - rateA;
      }
      if (sortBy === "recent") {
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
      if (sortBy === "difficulty") {
        const diffWeight: Record<string, number> = { hard: 3, medium: 2, easy: 1 };
        const weightA = diffWeight[a.difficulty?.toLowerCase()] || 0;
        const weightB = diffWeight[b.difficulty?.toLowerCase()] || 0;
        return weightB - weightA;
      }
      return 0;
    });

    return result;
  }, [problems, search, selectedTag, selectedDifficulty, filterStatus, sortBy, revisionItems]);

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    problems.forEach((p) => {
      (p.tags || []).forEach((t: any) => {
        const tagName = getTagName(t);
        if (tagName) {
          tagsSet.add(tagName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      });
    });
    return Array.from(tagsSet).sort();
  }, [problems]);

  const resetFilters = () => {
    setSearch("");
    setSelectedTag(null);
    setSelectedDifficulty(null);
    setFilterStatus("all");
  };

  const hasActiveFilters = search || selectedTag || selectedDifficulty || filterStatus !== "all";

  // Auto-scroll function when tag selected
  const handleSelectTag = (tag: string) => {
    setSelectedTag(tag);
    const element = document.getElementById("problems-list-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-12">
      {/* ── Page Intro Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)]/40 pb-6">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
            <Award className="text-[var(--accent)]" size={22} />
            Make Yourself Good
          </h2>
          <p className="text-[12px] text-[var(--text-muted)] font-mono mt-1">
            Analyze recurring friction patterns. Review weak stacks and space-repetition targets.
          </p>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white/[0.02] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] text-[11px] font-mono transition-all self-start md:self-auto font-semibold"
          >
            <RotateCcw size={12} />
            Reset All Filters
          </button>
        )}
      </div>

      {/* ── Asymmetric Layout: 7:5 Split ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (7/12 width): Filters & Problems Index List */}
        <div className="xl:col-span-7 flex flex-col gap-6" id="problems-list-section">
          
          {/* Filters Toolbar */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-[var(--text-muted)]" />
              <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Filter Problem Index
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]/40" size={14} />
                <input
                  type="text"
                  placeholder="Search problem title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40 placeholder:text-[var(--text-muted)]/30 transition-all font-mono"
                />
              </div>

              {/* Dropdowns & Difficulty selectors grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Topic selector */}
                <div className="relative">
                  <select
                    value={selectedTag || ""}
                    onChange={(e) => setSelectedTag(e.target.value || null)}
                    className="w-full bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl py-2.5 pl-4 pr-10 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40 transition-all appearance-none cursor-pointer font-mono"
                  >
                    <option value="" className="bg-[var(--bg-secondary)]">
                      All Topics
                    </option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag} className="bg-[var(--bg-secondary)]">
                        {tag}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]/40 pointer-events-none" size={14} />
                </div>

                {/* Difficulty selector tabs */}
                <div className="flex bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl p-1">
                  {["All", "Easy", "Medium", "Hard"].map((diff) => {
                    const val = diff === "All" ? null : diff;
                    const active = selectedDifficulty === val;
                    return (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(val)}
                        className={clsx(
                          "flex-1 text-[10px] font-mono py-1 rounded-lg transition-all",
                          active
                            ? "bg-white/[0.08] text-[var(--text-primary)] font-semibold shadow-sm"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]/75"
                        )}
                      >
                        {diff}
                      </button>
                    );
                  })}
                </div>

                {/* Sort selection */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl py-2.5 pl-4 pr-10 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40 transition-all appearance-none cursor-pointer font-mono"
                  >
                    <option value="attempts" className="bg-[var(--bg-secondary)]">
                      Sort by Attempts
                    </option>
                    <option value="failure_rate" className="bg-[var(--bg-secondary)]">
                      Sort by Failure %
                    </option>
                    <option value="recent" className="bg-[var(--bg-secondary)]">
                      Sort by Recent
                    </option>
                    <option value="difficulty" className="bg-[var(--bg-secondary)]">
                      Sort by Hardest
                    </option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]/40 pointer-events-none" size={14} />
                </div>
              </div>

              {/* Status filter tabs */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "All Problems", val: "all", count: problems.length },
                  {
                    label: "Revision Queue",
                    val: "revision",
                    count: revisionItems.length,
                    activeColor: "border-[var(--accent-blue)]/50 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]",
                  },
                  {
                    label: "Needs Improvement",
                    val: "friction",
                    count: problems.filter((p) => p.failedAttempts > 0).length,
                    activeColor: "border-[var(--error)]/50 bg-[var(--error)]/10 text-[var(--error)]",
                  },
                  {
                    label: "Mastered",
                    val: "solved",
                    count: problems.filter((p) => p.statusDisplay === "Accepted").length,
                    activeColor: "border-[var(--success)]/50 bg-[var(--success)]/10 text-[var(--success)]",
                  },
                ].map(({ label, val, count, activeColor }) => {
                  const active = filterStatus === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setFilterStatus(val as any)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono border transition-all",
                        active
                          ? activeColor || "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-white/[0.01] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border)]/85"
                      )}
                    >
                      <span>{label}</span>
                      <span className="px-1 py-0.5 rounded bg-white/[0.04] text-[9px] text-[var(--text-muted)] font-semibold">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Premium Table representation of Problems */}
          {isLoadingProblems ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-[74px] skeleton rounded-xl animate-pulse" />
              ))}
            </div>
          ) : problemsError ? (
            <PremiumCard variant="flat">
              <div className="py-12 text-center text-[12px] text-[var(--error)] font-mono">
                Failed to load problem index. Ensure LeetCode session is active and check backend sync status.
              </div>
            </PremiumCard>
          ) : filteredProblems.length === 0 ? (
            <PremiumCard variant="flat" className="py-20">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-[var(--border)] flex items-center justify-center">
                  <BookOpen size={20} className="text-[var(--text-muted)]/20" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-muted)]">No problems found</p>
                  <p className="text-[11px] text-[var(--text-muted)]/40 font-mono mt-1.5">
                    Try resetting active filter tags or triggering a new data sync.
                  </p>
                </div>
              </div>
            </PremiumCard>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredProblems.map((problem, index) => {
                const hasFriction = problem.failedAttempts > 0;
                const isSolved = problem.statusDisplay === "Accepted";

                // Spaced repetition queue check
                const revisionItem = revisionItems.find((item) => item.problem_slug === problem.titleSlug);
                const isRevisionActive = !!revisionItem;

                // Visual attempts history dots generator
                const totalAttemptsCount = problem.totalAttempts || 1;
                const attemptsDots = [];
                const failedCount = problem.failedAttempts;

                // Red dots representing failures
                for (let i = 0; i < failedCount; i++) {
                  attemptsDots.push({ key: `fail-${i}`, success: false });
                }
                // Green dot representing the accepted solution (if accepted)
                if (isSolved) {
                  attemptsDots.push({ key: "success", success: true });
                } else if (attemptsDots.length < totalAttemptsCount) {
                  const diff = totalAttemptsCount - attemptsDots.length;
                  for (let i = 0; i < diff; i++) {
                    attemptsDots.push({ key: `unresolved-${i}`, success: false });
                  }
                }

                // Cap the visual display at 6 dots
                const displayDots = attemptsDots.slice(0, 6);
                const hiddenCount = attemptsDots.length - displayDots.length;

                const diffColor =
                  problem.difficulty?.toLowerCase() === "easy"
                    ? "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20"
                    : problem.difficulty?.toLowerCase() === "medium"
                    ? "text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/20"
                    : "text-[var(--error)] bg-[var(--error)]/10 border-[var(--error)]/20";

                return (
                  <motion.div
                    key={problem.titleSlug}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.3) }}
                  >
                    <div
                      className={clsx(
                        "relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200",
                        index % 2 === 0
                          ? "bg-[var(--surface)]/10 border-[var(--border)]/40"
                          : "bg-[var(--surface)]/25 border-[var(--border)]/70",
                        "hover:bg-[var(--hover-bg)] hover:border-[var(--accent)]/30",
                        isRevisionActive && "border-[var(--accent-blue)]/30 shadow-sm shadow-[var(--accent-blue)]/5"
                      )}
                    >
                      {/* Left Block: Title, Info line */}
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://leetcode.com/problems/${problem.titleSlug}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[13px] font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors leading-tight truncate"
                            title={problem.title}
                          >
                            {problem.title}
                          </a>
                          <a
                            href={`https://leetcode.com/problems/${problem.titleSlug}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--text-muted)]/30 hover:text-[var(--accent)] transition-colors shrink-0"
                            title="Open LeetCode"
                          >
                            <ExternalLink size={10} />
                          </a>
                        </div>

                        {/* Badges line */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono">
                          <span className={clsx("px-1.5 py-0.5 rounded border uppercase font-semibold", diffColor)}>
                            {problem.difficulty}
                          </span>
                          <span className="px-1.5 py-0.5 rounded border border-[var(--border)] bg-white/[0.02] text-[var(--text-muted)]/80 lowercase">
                            {problem.lang}
                          </span>
                          {isRevisionActive && (
                            <span className="px-1.5 py-0.5 rounded border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center gap-0.5 font-semibold">
                              <Zap size={8} className="animate-pulse" />
                              Revision Active
                            </span>
                          )}
                          {problem.tags && problem.tags.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {problem.tags.slice(0, 1).map((t, idx) => {
                                const tagName = getTagName(t);
                                return (
                                  <span
                                    key={idx}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const norm = tagName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                                      handleSelectTag(norm);
                                    }}
                                    className="text-[9px] font-mono text-[var(--text-muted)]/40 hover:text-[var(--accent)] cursor-pointer transition-colors"
                                  >
                                    #{tagName.replace(/-/g, " ")}
                                  </span>
                                );
                              })}
                              {problem.tags.length > 1 && (
                                <span className="text-[8px] text-[var(--text-muted)]/30">+{problem.tags.length - 1}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle Block: Attempts Timeline dots */}
                      <div className="flex items-center md:justify-center gap-4 shrink-0 md:px-4 border-t md:border-t-0 md:border-x border-[var(--border)]/20 pt-3 md:pt-0">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-mono text-[var(--text-muted)]/60">
                            Attempts ({totalAttemptsCount}):
                          </span>
                          <div className="flex items-center gap-1">
                            {displayDots.map((dot) => (
                              <div
                                key={dot.key}
                                className={clsx(
                                  "w-2.5 h-2.5 rounded-full border transition-all duration-300 relative group/dot",
                                  dot.success
                                    ? "bg-[var(--success)] border-[var(--success)] shadow-[0_0_8px_var(--success)]"
                                    : "bg-transparent border-[var(--error)] border-2"
                                )}
                              >
                                <span className="absolute bottom-5 left-1/2 -translate-x-1/2 scale-0 group-hover/dot:scale-100 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[8px] font-mono font-semibold whitespace-nowrap shadow-2xl transition-all z-20">
                                  {dot.success ? "Accepted Solution" : "Failed Attempt"}
                                </span>
                              </div>
                            ))}
                            {hiddenCount > 0 && (
                              <span className="text-[9px] font-mono text-[var(--text-muted)]/60 font-semibold">
                                +{hiddenCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Actions */}
                      <div className="flex items-center gap-2 justify-end shrink-0 pt-2 md:pt-0">
                        <a
                          href={`/visualizer?slug=${problem.titleSlug}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--accent)]/30 hover:bg-[var(--accent)]/10 text-[var(--accent)] hover:border-[var(--accent)]/50 text-[10px] font-mono font-bold transition-all"
                          title="Visualize Execution"
                        >
                          <Code2 size={10} />
                          Visualize
                        </a>
                        <a
                          href={`/chat?problem=${problem.titleSlug}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 text-[10px] font-mono font-bold transition-all"
                        >
                          <MessageSquare size={10} />
                          Discuss
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (5/12 width): KPIs, Focus Areas, and AI Diagnostics */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* KPI metrics small grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: "Failure Resistance",
                value: `${kpis.acceptanceRate.toFixed(1)}%`,
                desc: "Overall success rate",
                colorClass: "text-[var(--success)]",
                icon: TrendingUp,
                bgClass: "bg-[var(--success)]/10",
                borderClass: "border-[var(--success)]/20",
                barColor: "var(--success)",
              },
              {
                label: "Spaced Revisions",
                value: kpis.revisionCount,
                desc: "Active due items",
                colorClass: "text-[var(--accent-blue)]",
                icon: Calendar,
                bgClass: "bg-[var(--accent-blue)]/10",
                borderClass: "border-[var(--accent-blue)]/20",
                barColor: "var(--accent-blue)",
              },
              {
                label: "Weak Stacks",
                value: kpis.weakTopicsCount,
                desc: "Low success scores",
                colorClass: "text-[var(--error)]",
                icon: TrendingDown,
                bgClass: "bg-[var(--error)]/10",
                borderClass: "border-[var(--error)]/20",
                barColor: "var(--error)",
              },
              {
                label: "AI Patterns",
                value: kpis.activePatternsCount,
                desc: "Friction patterns",
                colorClass: "text-[var(--warning)]",
                icon: Brain,
                bgClass: "bg-[var(--warning)]/10",
                borderClass: "border-[var(--warning)]/20",
                barColor: "var(--warning)",
              },
            ].map(({ label, value, desc, colorClass, icon: Icon, bgClass, borderClass, barColor }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PremiumCard variant="elevated" className="p-0 overflow-hidden">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{label}</span>
                      <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center border", bgClass, borderClass)}>
                        <Icon size={13} className={colorClass} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[24px] font-bold leading-none mb-1 text-[var(--text-primary)] font-mono">
                        {typeof value === "string" && value.includes("%") ? (
                          <CountUp value={parseFloat(value)} suffix="%" />
                        ) : (
                          <CountUp value={value} />
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">{desc}</div>
                    </div>
                  </div>
                  <div className="h-0.5 mt-4 -mx-8 -mb-8" style={{ background: `linear-gradient(90deg, ${barColor}60, transparent)` }} />
                </PremiumCard>
              </motion.div>
            ))}
          </div>

          {/* Focus Stacks Card list */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-[var(--error)]" />
              <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Weak Focus Stacks
              </h3>
            </div>

            {isLoadingProblems || isLoadingStrengths ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 skeleton rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : focusStacks.length > 0 ? (
              <div className="flex flex-col gap-3">
                {focusStacks.map((stack, i) => {
                  const isDP = stack.topic.toLowerCase().includes("dynamic");
                  const isStack = stack.topic.toLowerCase().includes("stack");
                  const cardColor = isDP ? "var(--error)" : isStack ? "var(--accent-blue)" : "var(--warning)";
                  const cardBgClass = isDP ? "bg-[var(--error)]/5 border-[var(--error)]/20" : isStack ? "bg-[var(--accent-blue)]/5 border-[var(--accent-blue)]/20" : "bg-[var(--warning)]/5 border-[var(--warning)]/20";
                  const cardTextColorClass = isDP ? "text-[var(--error)]" : isStack ? "text-[var(--accent-blue)]" : "text-[var(--warning)]";

                  return (
                    <motion.div
                      key={stack.topic}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="cursor-pointer"
                      onClick={() => handleSelectTag(stack.topic)}
                    >
                      <PremiumCard
                        variant="elevated"
                        glow={selectedTag === stack.topic}
                        className={clsx(
                          "p-0 border transition-all duration-200",
                          selectedTag === stack.topic ? "border-[var(--accent)]/50 bg-[var(--accent)]/5" : "border-[var(--border)]"
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-bold text-[var(--text-primary)] truncate max-w-[180px]" title={stack.topic}>
                              {stack.topic}
                            </span>
                            <span className={clsx("text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase", cardTextColorClass, cardBgClass)}>
                              FAIL LOOP
                            </span>
                          </div>
                          
                          {/* Topic Strength Gauge */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end text-[10px] font-mono">
                              <span className="text-[var(--text-muted)]">Topic Strength:</span>
                              <span className="font-semibold" style={{ color: cardColor }}>
                                {stack.strengthScore.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/[0.03] overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${stack.strengthScore}%` }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                style={{ background: cardColor }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-[var(--border)]/40 text-[var(--text-muted)]">
                            <span>Retries count:</span>
                            <span className="text-[var(--text-primary)] font-semibold">{stack.totalAttempts} times</span>
                          </div>
                        </div>
                      </PremiumCard>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <PremiumCard variant="flat" className="py-6 text-center text-[var(--text-muted)]/50 font-mono text-[11px]">
                No weak stacks detected. Great job!
              </PremiumCard>
            )}
          </div>

          {/* AI Coach Insights */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-[var(--warning)]" />
              <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                AI Coach Diagnostics
              </h3>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <PremiumCard
                variant="accent"
                glow
                className="p-0 border-[var(--warning)]/20 bg-gradient-to-br from-[var(--warning)]/5 to-transparent min-h-[176px] flex flex-col overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-[var(--warning)]/10 flex items-center justify-between bg-[var(--warning)]/[0.01]">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-[var(--warning)] animate-pulse" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      {selectedTag ? `${selectedTag} Pattern` : "Worst Pattern Analysis"}
                    </span>
                  </div>
                  {activeCoachInsight && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20 uppercase">
                      {activeCoachInsight.impact || "habit"}
                    </span>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  {activeCoachInsight ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {activeCoachInsight.title}
                        </span>
                        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed italic">
                          "{activeCoachInsight.insight}"
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/40">
                        <span className="text-[9px] font-mono text-[var(--text-muted)]/60">
                          Detected: {activeCoachInsight.occurrence_count} times
                        </span>
                        <a
                          href="/chat"
                          className="text-[10px] font-mono text-[var(--accent)] hover:text-[var(--accent-alt)] flex items-center gap-0.5"
                        >
                          Ask coach how to resolve <MessageSquare size={10} className="ml-1" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-[var(--text-muted)]/30 font-mono text-[11px] gap-2">
                      <BookOpen size={20} className="opacity-40" />
                      <span>No specific friction pattern recorded. Keep practicing.</span>
                    </div>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
