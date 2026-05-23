"use client";

import clsx from "clsx";
import { Check, Calendar, Activity, Zap, Info, Clock, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion, AnimatePresence } from "framer-motion";

function formatDueDate(isoString: string) {
  const date = new Date(isoString);
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { label: "Due Today", type: "today" };
  if (diffDays === 1) return { label: "Tomorrow", type: "tomorrow" };
  return { label: `In ${diffDays}d`, type: "future" };
}

const difficultyColor = (id: string) => {
  const n = id.charCodeAt(0) % 3;
  if (n === 0) return { dot: "#FF5058", glow: "rgba(255,80,88,0.5)", label: "Hard" };
  if (n === 1) return { dot: "#F59E0B", glow: "rgba(245,158,11,0.5)", label: "Medium" };
  return { dot: "#10D986", glow: "rgba(16,217,134,0.5)", label: "Easy" };
};

export default function RevisionQueueView() {
  const { data: session, isLoading, isError, refetch } = useQuery({
    queryKey: ["revisionToday"],
    queryFn: api.getRevisionToday,
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) =>
      api.completeRevision(id, quality, "accepted"),
    onSuccess: () => refetch(),
  });

  const items = session?.items || [];
  const dueToday = items.filter((i: any) => {
    const d = formatDueDate(i.next_due);
    return d.type === "today";
  });
  const upcoming = items.filter((i: any) => {
    const d = formatDueDate(i.next_due);
    return d.type !== "today";
  });

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Due Today", value: dueToday.length, color: "#FF5058", bg: "rgba(255,80,88,0.08)", border: "rgba(255,80,88,0.2)" },
          { label: "Upcoming", value: upcoming.length, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
          { label: "Total Queue", value: items.length, color: "#6C63FF", bg: "rgba(108,99,255,0.08)", border: "rgba(108,99,255,0.2)" },
        ].map(({ label, value, color, bg, border }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <PremiumCard variant="elevated" className="p-0">
              <div className="p-5">
                <div className="text-[28px] font-bold leading-none mb-1" style={{ color }}>{value}</div>
                <div className="text-[11px] text-white/30 font-mono uppercase tracking-widest">{label}</div>
              </div>
              <div className="h-0.5 mx-5 mb-4 rounded-full" style={{ background: `linear-gradient(90deg, ${color}70, transparent)` }} />
            </PremiumCard>
          </motion.div>
        ))}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-2xl" />)}
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <PremiumCard variant="flat">
          <div className="flex items-center gap-3 text-[#FF5058] text-[13px] font-mono py-4 justify-center">
            <Info size={15} />
            Failed to load revision queue
          </div>
        </PremiumCard>
      )}

      {/* ── Due Today ── */}
      {!isLoading && dueToday.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF5058] shadow-[0_0_8px_rgba(255,80,88,0.6)]" />
            <span className="text-[11px] font-mono font-semibold text-[#FF5058] uppercase tracking-widest">Due Today — {dueToday.length} Problems</span>
          </div>
          <AnimatePresence>
            {dueToday.map((item: any, index: number) => {
              const diff = difficultyColor(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <PremiumCard variant="elevated" className="p-0 hover:border-[#FF5058]/20 transition-colors">
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Complete Button */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => completeMutation.mutate({ id: item.id, quality: 5 })}
                        disabled={completeMutation.isPending}
                        className="w-7 h-7 shrink-0 rounded-lg border-2 border-white/10 bg-white/[0.03] flex items-center justify-center text-transparent hover:border-[#10D986] hover:text-[#10D986] hover:bg-[#10D986]/10 transition-all duration-200 disabled:opacity-40"
                      >
                        <Check size={13} strokeWidth={2.5} className={completeMutation.isPending ? "animate-pulse" : ""} />
                      </motion.button>

                      {/* Difficulty dot */}
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: diff.dot, boxShadow: `0 0 8px ${diff.glow}` }} />

                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-medium text-white/85 truncate block">{item.problem_title}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">{diff.label}</span>
                          {item.last_verdict && (
                            <span className={clsx(
                              "text-[9px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-widest",
                              item.last_verdict === "accepted"
                                ? "text-[#10D986] bg-[#10D986]/10 border-[#10D986]/20"
                                : "text-[#FF5058] bg-[#FF5058]/10 border-[#FF5058]/20"
                            )}>
                              {item.last_verdict.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Due badge */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF5058]/10 border border-[#FF5058]/20">
                        <Calendar size={11} className="text-[#FF5058]" />
                        <span className="text-[10px] font-mono font-bold text-[#FF5058] uppercase tracking-widest">Today</span>
                      </div>

                      <ChevronRight size={14} className="text-white/15 shrink-0" />
                    </div>
                  </PremiumCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Upcoming ── */}
      {!isLoading && upcoming.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <span className="text-[11px] font-mono font-semibold text-[#F59E0B] uppercase tracking-widest">Upcoming — {upcoming.length} Problems</span>
          </div>
          {upcoming.map((item: any, index: number) => {
            const due = formatDueDate(item.next_due);
            const diff = difficultyColor(item.id);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
                <PremiumCard variant="flat" className="p-0">
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-2 h-2 rounded-full shrink-0 opacity-50" style={{ background: diff.dot }} />
                    <span className="flex-1 text-[13px] text-white/50 truncate">{item.problem_title}</span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                      <Clock size={10} className="text-white/25" />
                      <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">{due.label}</span>
                    </div>
                  </div>
                </PremiumCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && items.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <PremiumCard variant="accent" className="py-16">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center">
                <Zap size={28} className="text-[#6C63FF]" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-white/80">Queue Synchronized</p>
                <p className="text-[12px] text-white/30 font-mono mt-1.5 uppercase tracking-widest">No pending reviews — neural reinforcement complete</p>
              </div>
              {session?.plan?.recommendation && (
                <div className="max-w-md p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                  <span className="text-[9px] font-mono text-[#6C63FF] uppercase tracking-widest block mb-2">Coach Recommendation</span>
                  <p className="text-[13px] text-white/50 leading-relaxed italic">"{session.plan.recommendation}"</p>
                </div>
              )}
            </div>
          </PremiumCard>
        </motion.div>
      )}
    </div>
  );
}
