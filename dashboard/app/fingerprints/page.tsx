"use client";

import clsx from "clsx";
import { ArrowRight, Fingerprint, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { motion } from "framer-motion";

// Generate 90 days of mock heatmap data since there is no backend endpoint for it yet
const mockHeatmapData = Array.from({ length: 91 }, (_, i) => ({
  id: i,
  level: Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0, // 0 to 3
}));

export default function FingerprintsView() {
  const { data: patterns, isLoading, isError } = useQuery({
    queryKey: ["patterns"],
    queryFn: api.getPatterns,
  });

  return (
    <div className="w-full flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
          Neural Fingerprints
        </h1>
        <p className="text-foreground/40 text-sm font-mono tracking-wide">
          Behavioral frequency matrix (90 days)
        </p>
      </div>

      {/* Heatmap Section */}
      <PremiumCard glow>
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Fingerprint className="text-accent" size={18} />
            <h2 className="text-sm font-medium text-foreground/90 uppercase tracking-widest font-mono">Intensity Matrix</h2>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-foreground/30 uppercase tracking-[0.2em]">
            <span>Low</span>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-white/5 border border-white/5" />
              <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/10" />
              <div className="w-3 h-3 rounded-sm bg-accent/50 border border-accent/20" />
              <div className="w-3 h-3 rounded-sm bg-accent shadow-[0_0_8px_rgba(29,158,117,0.4)]" />
            </div>
            <span>High</span>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-4 custom-scrollbar">
          {Array.from({ length: Math.ceil(91 / 7) }).map((_, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-1.5">
              {mockHeatmapData.slice(colIndex * 7, (colIndex + 1) * 7).map((day) => (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: day.id * 0.002 }}
                  key={day.id}
                  className={clsx(
                    "w-3.5 h-3.5 rounded-[3px] transition-all duration-300 hover:scale-125 hover:z-10",
                    day.level === 0 && "bg-white/[0.03] border border-white/5",
                    day.level === 1 && "bg-accent/20 border border-accent/10",
                    day.level === 2 && "bg-accent/50 border border-accent/20",
                    day.level === 3 && "bg-accent border border-accent/30 shadow-[0_0_8px_rgba(29,158,117,0.2)]"
                  )}
                  title={`Level ${day.level}`}
                />
              ))}
            </div>
          ))}
        </div>
      </PremiumCard>

      {/* Ranked Mistakes Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-accent" />
          <h2 className="text-lg font-medium text-foreground/90 tracking-tight">Active Signature Vectors</h2>
        </div>
        
        {isLoading && (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        )}
        
        {isError && <div className="text-error font-mono text-sm">Synchronicity failure in pattern engine.</div>}

        {patterns && patterns.length > 0 ? (
          <div className="flex flex-col gap-4">
            {patterns.map((pattern, index) => (
              <PremiumCard
                key={pattern.id}
                className="group py-4 px-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center font-mono text-sm text-foreground/20 group-hover:text-accent group-hover:border-accent/20 transition-all duration-500">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-medium text-[16px] text-foreground/90 group-hover:text-foreground transition-colors">{pattern.title}</h3>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-error font-bold uppercase tracking-wider">{pattern.occurrence_count} Identifications</span>
                        <div className="w-1 h-1 rounded-full bg-foreground/10" />
                        <span className="text-foreground/40 text-[10px] font-mono uppercase tracking-widest">{pattern.impact}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <motion.button 
                      whileHover={{ x: 5 }}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] text-foreground/20 group-hover:text-accent group-hover:border-accent/30 group-hover:bg-accent/5 transition-all duration-300 shadow-lg"
                    >
                      <ArrowRight size={18} strokeWidth={2} />
                    </motion.button>
                  </div>
                </div>
              </PremiumCard>
            ))}
          </div>
        ) : (
          !isLoading && (
            <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
              <Fingerprint size={48} strokeWidth={1} />
              <span className="font-mono text-xs uppercase tracking-[0.4em]">No signatures captured</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
