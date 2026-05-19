"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";
import { ExternalLink, Search, ListFilter, FileText } from "lucide-react";

export default function ProblemsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["problems"],
    queryFn: api.getProblems,
  });

  const problems = data?.problems || [];

  return (
    <div className="w-full flex flex-col gap-10">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Problem Index
          </h1>
          <p className="text-foreground/40 text-sm font-mono tracking-wide">
            Synchronized repository of resolved challenges
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-accent transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filter by title..."
              className="bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent/30 transition-all w-64 font-sans placeholder:text-foreground/20"
            />
          </div>
          <button className="p-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-foreground/40 hover:text-foreground transition-all">
            <ListFilter size={18} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <PremiumCard className="border-error/20 bg-error/5 py-10">
          <div className="text-error font-mono text-sm text-center">
            Failed to synchronize problem index. Ensure LeetCode session is active.
          </div>
        </PremiumCard>
      )}

      {problems.length === 0 ? (
        !isLoading && (
          <PremiumCard className="flex items-center justify-center py-20 border-dashed border-2 border-white/5 bg-transparent">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-foreground/20">
                <FileText size={24} />
              </div>
              <p className="text-foreground/60 font-medium">Index is empty</p>
              <p className="text-foreground/30 text-xs font-mono">Trigger a system sync to populate the repository.</p>
            </div>
          </PremiumCard>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {problems.map((problem: any, index: number) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              key={problem.titleSlug}
            >
              <a
                href={`https://leetcode.com/problems/${problem.titleSlug}/`}
                target="_blank"
                rel="noreferrer"
                className="block group"
              >
                <PremiumCard className="h-full py-5 px-6 group-hover:border-accent/30 transition-all">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-2">
                      <h3 className="font-medium text-foreground/90 group-hover:text-accent transition-colors line-clamp-1">{problem.title}</h3>
                      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-foreground/30">
                        <span>{problem.lang || "Logic"}</span>
                        {problem.statusDisplay && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-foreground/10" />
                            <span className="text-accent/60">{problem.statusDisplay}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 text-foreground/20 group-hover:text-accent group-hover:bg-accent/5 transition-all">
                      <ExternalLink size={14} />
                    </div>
                  </div>
                </PremiumCard>
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
