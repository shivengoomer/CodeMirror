"use client";

import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";
import { Calendar, Code2, CheckCircle2, XCircle, Search } from "lucide-react";

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    LeetCode: "bg-[#FFA116]/10 text-[#FFA116] border-[#FFA116]/20",
    GFG: "bg-[#2F8D46]/10 text-[#2F8D46] border-[#2F8D46]/20",
    HackerRank: "bg-[#00EA64]/10 text-[#00EA64] border-[#00EA64]/20",
  };

  return (
    <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border", colors[platform] || "bg-white/5 text-foreground/40 border-white/10")}>
      {platform}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const isAccepted = verdict.toLowerCase() === "accepted";
  return (
    <div className={clsx(
      "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      isAccepted
        ? "bg-accent/10 text-accent border-accent/20"
        : "bg-error/10 text-error border-error/20"
    )}>
      {isAccepted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {verdict}
    </div>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function SubmissionsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["submissions"],
    queryFn: () => api.listSubmissions({ limit: 50 }),
  });

  return (
    <div className="w-9xl flex flex-col gap-10">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Archive Explorer
          </h1>
          <p className="text-foreground/40 text-sm font-mono tracking-wide">
            Historical submission telemetry
          </p>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-accent transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search problems..."
            className="bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/30 transition-all w-64 font-sans placeholder:text-foreground/20"
          />
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <PremiumCard className="border-error/20 bg-error/5">
          <div className="text-error font-mono text-sm flex items-center gap-2">
            Failed to retrieve submission history.
          </div>
        </PremiumCard>
      )}

      {data && data.items && data.items.length > 0 ? (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-4"
        >
          {data.items.map((sub: any) => (
            <motion.div key={sub.id} variants={item}>
              <PremiumCard className="group">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-4 flex-1">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-medium text-foreground/90 group-hover:text-accent transition-colors">
                        {sub.problem_title || sub.problem_slug}
                      </h3>
                      <PlatformBadge platform={sub.platform || "LeetCode"} />
                      <VerdictBadge verdict={sub.verdict} />
                    </div>

                    <div className="flex items-center gap-6 text-[11px] font-mono text-foreground/30 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Code2 size={14} className="text-foreground/20" />
                        {sub.language || "N/A"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-foreground/20" />
                        {new Date(sub.submitted_at).toLocaleDateString()}
                      </div>
                      {sub.analysed ? (
                        <div className="flex items-center gap-1.5 text-accent/60">
                          <CheckCircle2 size={14} />
                          Analysed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 opacity-50">
                          <XCircle size={14} />
                          Not Analysed
                        </div>
                      )}
                    </div>

                    {sub.ai_analysis && (
                      <div className="mt-2 p-5 bg-white/[0.02] border border-white/5 rounded-xl group-hover:bg-accent/[0.01] group-hover:border-accent/10 transition-colors">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-mono text-accent/60 uppercase tracking-[0.2em]">Cognitive Root Cause</span>
                            <p className="text-foreground/70 text-[13px] leading-relaxed line-clamp-2">{sub.ai_analysis.root_cause}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </PremiumCard>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        !isLoading && (
          <PremiumCard className="flex items-center justify-center py-20 border-dashed border-2 border-white/5 bg-transparent">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-foreground/20">
                <Search size={24} />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-foreground/60 font-medium">No telemetry found</p>
                <p className="text-foreground/30 text-xs font-mono">Archive is currently empty.</p>
              </div>
            </div>
          </PremiumCard>
        )
      )}
    </div>
  );
}
