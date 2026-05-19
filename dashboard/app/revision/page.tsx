"use client";

import clsx from "clsx";
import { Check, Calendar, Activity, Zap, Info } from "lucide-react";
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
  if (diffDays === 1) return { label: "Due Tomorrow", type: "tomorrow" };
  return { label: `Due in ${diffDays}d`, type: "future" };
}

export default function RevisionQueueView() {
  const { data: session, isLoading, isError, refetch } = useQuery({
    queryKey: ["revisionToday"],
    queryFn: api.getRevisionToday,
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) => 
      api.completeRevision(id, quality, "accepted"),
    onSuccess: () => {
      refetch();
    },
  });

  const items = session?.items || [];

  const handleComplete = (id: string) => {
    completeMutation.mutate({ id, quality: 5 });
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Revision Queue
          </h1>
          <p className="text-foreground/40 text-sm font-mono tracking-wide">
            Spaced repetition for neural reinforcement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white/[0.03] border border-white/5 rounded-xl flex items-center gap-3">
            <Activity size={14} className="text-accent" />
            <span className="font-mono text-[11px] text-foreground/60 uppercase tracking-widest">{items.length} Pending Units</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <PremiumCard className="border-error/20 bg-error/5 py-10">
           <div className="text-error font-mono text-sm text-center flex items-center justify-center gap-2">
             <Info size={16} />
             System failure while retrieving revision telemetry.
           </div>
        </PremiumCard>
      )}

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {items.map((item, index) => {
              const due = formatDueDate(item.next_due);
              const difficulty = item.id.length % 3 === 0 ? "red" : item.id.length % 2 === 0 ? "amber" : "green";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <PremiumCard className="py-4 px-6 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleComplete(item.id)}
                          disabled={completeMutation.isPending}
                          className="w-6 h-6 rounded-lg border-2 border-white/10 bg-white/5 flex items-center justify-center text-transparent hover:border-accent hover:text-accent transition-all duration-300 disabled:opacity-50"
                        >
                          <Check size={14} strokeWidth={3} className={clsx(completeMutation.isPending && "animate-pulse")} />
                        </motion.button>
                        
                        <div className="flex items-center gap-4">
                          <div 
                            className={clsx(
                              "w-2 h-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                              difficulty === "green" && "bg-accent shadow-accent/20",
                              difficulty === "amber" && "bg-orange-400 shadow-orange-400/20",
                              difficulty === "red" && "bg-error shadow-error/20"
                            )} 
                          />
                          <span className="text-[16px] font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                            {item.problem_title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-widest transition-all duration-500",
                          due.type === "today" 
                            ? "bg-error/10 text-error border-error/20 shadow-[0_0_15px_rgba(255,77,77,0.1)]" 
                            : "bg-white/[0.03] text-foreground/30 border-white/5"
                        )}>
                          <Calendar size={12} />
                          {due.label}
                        </div>
                      </div>
                    </div>
                  </PremiumCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        !isLoading && (
          <PremiumCard className="flex flex-col items-center justify-center py-20 border-dashed border-2 border-white/5 bg-transparent">
            <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-6">
              <Zap size={32} className="fill-accent/20" />
            </div>
            <span className="text-foreground/80 font-medium text-lg">Queue Synchronized</span>
            <span className="text-foreground/30 font-mono text-xs uppercase tracking-[0.3em] mt-2">Neural reinforcement complete</span>
            
            {session?.plan?.recommendation && (
              <div className="mt-10 max-w-lg p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                <span className="text-[10px] font-mono text-accent uppercase tracking-[0.2em] block mb-3">Coach Recommendation</span>
                <p className="text-foreground/60 text-sm leading-relaxed italic">
                  "{session.plan.recommendation}"
                </p>
              </div>
            )}
          </PremiumCard>
        )
      )}
    </div>
  );
}
