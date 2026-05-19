"use client";

import clsx from "clsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";
import { TrendingUp, Award, AlertCircle, Hash } from "lucide-react";

const mockWeeklyData = [
  { name: "Mon", attempts: 4, failures: 1 },
  { name: "Tue", attempts: 6, failures: 3 },
  { name: "Wed", attempts: 3, failures: 0 },
  { name: "Thu", attempts: 8, failures: 4 },
  { name: "Fri", attempts: 5, failures: 2 },
  { name: "Sat", attempts: 9, failures: 2 },
  { name: "Sun", attempts: 7, failures: 1 },
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

  const failureRate = stats ? stats.failure_rate.toFixed(1) + "%" : "0%";
  
  const tagCloud = patterns?.map(p => {
    let size = "text-xs";
    if (p.occurrence_count > 10) size = "text-2xl";
    else if (p.occurrence_count > 5) size = "text-xl";
    else if (p.occurrence_count > 2) size = "text-base";
    
    return {
      name: p.tag || p.title,
      count: p.occurrence_count,
      size,
    };
  }) || [];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
          Performance Metrics
        </h1>
        <p className="text-foreground/40 text-sm font-mono tracking-wide">
          Statistical breakdown of cognitive performance
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-6">
        <PremiumCard glow className="relative overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-foreground/40 font-mono text-[10px] uppercase tracking-[0.2em]">
              <TrendingUp size={14} className="text-accent" />
              Failure Rate
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-medium tracking-tight text-foreground/90">
                {statsLoading ? "..." : failureRate}
              </span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: failureRate }}
                className="h-full bg-accent"
              />
            </div>
          </div>
        </PremiumCard>

        <PremiumCard glow>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-foreground/40 font-mono text-[10px] uppercase tracking-[0.2em]">
              <Award size={14} className="text-purple-400" />
              Weekly Success
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-medium tracking-tight text-foreground/90">
                {statsLoading ? "..." : stats?.weekly_accepted || 0}
              </span>
              <span className="text-sm font-mono text-foreground/30">/ {stats?.weekly_total || 0}</span>
            </div>
            <p className="text-[10px] text-foreground/30 font-mono uppercase tracking-widest">
              Total system attempts
            </p>
          </div>
        </PremiumCard>

        <PremiumCard glow>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-foreground/40 font-mono text-[10px] uppercase tracking-[0.2em]">
              <AlertCircle size={14} className="text-orange-400" />
              Active Patterns
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-medium tracking-tight text-foreground/90">
                {patternsLoading ? "..." : patterns?.length || 0}
              </span>
            </div>
            <p className="text-[10px] text-foreground/30 font-mono uppercase tracking-widest">
              Identified mistake vectors
            </p>
          </div>
        </PremiumCard>
      </div>

      {/* Chart */}
      <PremiumCard className="p-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium text-foreground/90 tracking-tight">System Telemetry</h2>
            <p className="text-xs text-foreground/40 font-mono uppercase tracking-widest">Attempts vs Failures (This Week)</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-white/10" />
               <span className="text-[10px] font-mono text-foreground/40 uppercase tracking-widest">Total</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-accent" />
               <span className="text-[10px] font-mono text-foreground/40 uppercase tracking-widest">Failures</span>
             </div>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockWeeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255,255,255,0.2)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={15}
                className="font-mono uppercase tracking-widest"
              />
              <YAxis 
                stroke="rgba(255,255,255,0.2)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                className="font-mono"
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                contentStyle={{
                  backgroundColor: 'rgba(13,13,15,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                  padding: '12px'
                }}
                itemStyle={{ fontSize: '11px', fontWeight: '500', fontFamily: 'var(--font-geist-mono)' }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              />
              <Bar dataKey="attempts" radius={[6, 6, 0, 0]} barSize={40}>
                {mockWeeklyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="rgba(255,255,255,0.05)" />
                ))}
              </Bar>
              <Bar dataKey="failures" radius={[6, 6, 0, 0]} barSize={40}>
                {mockWeeklyData.map((entry, index) => (
                  <Cell key={`cell-f-${index}`} fill="var(--accent)" fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      {/* Tag Cloud */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-accent" />
          <h2 className="text-lg font-medium text-foreground/90 tracking-tight">Categorical Analysis</h2>
        </div>
        <PremiumCard className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 p-12 text-center min-h-[160px] bg-mesh opacity-90">
          {patternsLoading ? (
            <span className="text-foreground/20 font-mono text-[10px] uppercase tracking-widest animate-pulse">Synchronizing categories...</span>
          ) : tagCloud.length > 0 ? (
            tagCloud.map((tag) => (
              <motion.span
                whileHover={{ scale: 1.1, color: "var(--accent)" }}
                key={tag.name}
                className={clsx(
                  "font-mono transition-all duration-300 cursor-default",
                  tag.size,
                  tag.count > 5 ? "text-foreground font-bold" : tag.count > 2 ? "text-foreground/60" : "text-foreground/30",
                )}
                title={`${tag.count} occurrences`}
              >
                {tag.name}
              </motion.span>
            ))
          ) : (
            <div className="flex flex-col gap-2 items-center opacity-20">
              <AlertCircle size={24} />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em]">No vectors identified</span>
            </div>
          )}
        </PremiumCard>
      </div>
    </div>
  );
}
