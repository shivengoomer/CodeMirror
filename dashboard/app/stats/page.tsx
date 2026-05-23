"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";
import { TrendingUp, Award, AlertCircle, Hash } from "lucide-react";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass shadow-premium rounded-xl px-4 py-3 text-[12px] min-w-[140px]">
      <p className="text-[var(--text-muted)] font-mono uppercase tracking-wider text-[10px] mb-2">{label}</p>
      <div className="flex flex-col gap-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-[var(--text-muted)] capitalize">{p.dataKey}</span>
            </div>
            <span className="font-mono font-semibold text-[var(--text-primary)]">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const mockWeeklyData = [
  { name: "Mon", accepted: 4, failed: 1 },
  { name: "Tue", accepted: 6, failed: 3 },
  { name: "Wed", accepted: 3, failed: 0 },
  { name: "Thu", accepted: 8, failed: 4 },
  { name: "Fri", accepted: 5, failed: 2 },
  { name: "Sat", accepted: 9, failed: 2 },
  { name: "Sun", accepted: 7, failed: 1 },
];

export default function StatsView() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });

  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ["patterns"],
    queryFn: api.getPatterns,
  });

  const { data: trends } = useQuery({
    queryKey: ["trends"],
    queryFn: () => api.getTrends(14),
  });

  const failureRate = stats ? stats.failure_rate.toFixed(1) + "%" : "0%";
  const trendData = trends?.length
    ? trends.map((t: any) => ({ name: t.date?.slice(5), accepted: t.accepted, failed: t.failed }))
    : mockWeeklyData;

  const tagCloud = patterns?.map((p: any) => {
    let size = "text-xs";
    if (p.occurrence_count > 10) size = "text-2xl";
    else if (p.occurrence_count > 5) size = "text-xl";
    else if (p.occurrence_count > 2) size = "text-base";
    return { name: p.tag || p.title, count: p.occurrence_count, size };
  }) || [];

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Failure Rate",
            value: statsLoading ? "..." : failureRate,
            sub: "Of weekly attempts",
            icon: TrendingUp,
            colorClass: "text-[var(--error)]",
            bgClass: "bg-[var(--error)]/10",
            borderClass: "border-[var(--error)]/20",
            barColor: "var(--error)",
          },
          {
            label: "Weekly Success",
            value: statsLoading ? "..." : `${stats?.weekly_accepted ?? 0}`,
            sub: `out of ${stats?.weekly_total ?? 0} attempts`,
            icon: Award,
            colorClass: "text-[var(--accent)]",
            bgClass: "bg-[var(--accent)]/10",
            borderClass: "border-[var(--accent)]/20",
            barColor: "var(--accent)",
          },
          {
            label: "Error Patterns",
            value: patternsLoading ? "..." : `${patterns?.length ?? 0}`,
            sub: "Identified mistake vectors",
            icon: AlertCircle,
            colorClass: "text-[var(--warning)]",
            bgClass: "bg-[var(--warning)]/10",
            borderClass: "border-[var(--warning)]/20",
            barColor: "var(--warning)",
          },
        ].map(({ label, value, sub, icon: Icon, colorClass, bgClass, borderClass, barColor }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <PremiumCard variant="elevated" className="p-0 overflow-hidden">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center border", bgClass, borderClass)}>
                    <Icon size={16} className={colorClass} />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
                </div>
                <div>
                  <span className="text-[32px] font-bold text-[var(--text-primary)] leading-none block font-mono">
                    {statsLoading ? (
                      "..."
                    ) : label === "Failure Rate" ? (
                      <CountUp value={parseFloat(value)} suffix="%" />
                    ) : (
                      <CountUp value={parseInt(value) || 0} />
                    )}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono mt-1.5 block">{sub}</span>
                </div>
              </div>
              <div className="h-0.5 mt-4 -mx-8 -mb-8 rounded-full" style={{ background: `linear-gradient(90deg, ${barColor}60, transparent)` }} />
            </PremiumCard>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Area Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <PremiumCard variant="elevated" className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Submission Trends</h2>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">Accepted vs Failed over time</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                  Accepted
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--error)]" />
                  Failed
                </div>
              </div>
            </div>
            <div className="p-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAccepted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--error)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--error)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--border)"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    className="font-mono"
                  />
                  <YAxis
                    stroke="var(--border)"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    className="font-mono"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="accepted" stroke="var(--success)" strokeWidth={2} fill="url(#gradAccepted)" />
                  <Area type="monotone" dataKey="failed" stroke="var(--error)" strokeWidth={2} fill="url(#gradFailed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>
        </motion.div>

        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <PremiumCard variant="elevated" className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Weekly Breakdown</h2>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">Daily problem distribution</p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[9px] font-mono text-[var(--accent)] uppercase tracking-wider font-semibold">
                7d
              </div>
            </div>
            <div className="p-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockWeeklyData} barGap={4} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--border)"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    className="font-mono"
                  />
                  <YAxis
                    stroke="var(--border)"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    className="font-mono"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="accepted" radius={[4, 4, 0, 0]} barSize={16} fill="var(--success)" fillOpacity={0.7} />
                  <Bar dataKey="failed" radius={[4, 4, 0, 0]} barSize={16} fill="var(--error)" fillOpacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>
        </motion.div>
      </div>

      {/* ── Pattern Tag Cloud ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
        <PremiumCard variant="elevated" className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 flex items-center justify-center">
              <Hash size={13} className="text-[var(--warning)]" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Categorical Error Analysis</h2>
              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">Mistake vectors by frequency — size indicates recurrence</p>
            </div>
          </div>
          <div className="p-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 min-h-[140px]">
            {patternsLoading ? (
              <span className="text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-widest animate-pulse">Analyzing patterns...</span>
            ) : tagCloud.length > 0 ? (
              tagCloud.map((tag) => (
                <motion.span
                  whileHover={{ scale: 1.12, color: "var(--accent)" }}
                  key={tag.name}
                  className={clsx(
                    "font-mono cursor-default transition-all duration-300 select-none",
                    tag.size,
                    tag.count > 5 ? "text-[var(--text-primary)] font-bold" : tag.count > 2 ? "text-[var(--text-muted)] font-medium" : "text-[var(--text-muted)]/30"
                  )}
                  title={`${tag.count} occurrences`}
                >
                  {tag.name}
                </motion.span>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 opacity-20">
                <AlertCircle size={24} />
                <span className="text-[11px] font-mono uppercase tracking-widest">No patterns identified yet</span>
              </div>
            )}
          </div>
        </PremiumCard>
      </motion.div>
    </div>
  );
}

