"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/register";

  const { data: syncStatus, refetch: refetchSync } = useQuery({
    queryKey: ["syncStatus"],
    queryFn: api.getSyncStatus,
    refetchInterval: (query: any) => (query.state.data?.progress === 100 ? false : 5000),
    enabled: !isPublicPage,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: () => refetchSync(),
  });

  if (isPublicPage) {
    return (
      <main className="flex-1 h-screen overflow-auto relative">
        <div className="absolute inset-0 bg-mesh opacity-20 pointer-events-none" />
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background selection:bg-accent/30 selection:text-accent-foreground">
      {/* Ambient Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-[60%] -right-[5%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px] animate-float" />
      </div>

      <Sidebar />
      
      <main className="flex-1 flex flex-col relative z-10">
        <header className="h-20 shrink-0 px-10 flex items-center justify-between border-b border-white/[0.05] bg-background/50 backdrop-blur-xl">
          <div className="flex flex-col">
            <motion.span 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-sans text-[15px] font-medium text-foreground/90 flex items-center gap-2"
            >
              <Zap size={14} className="text-accent fill-accent/20" />
              Intelligence Dashboard
            </motion.span>
            <span className="font-mono text-[11px] text-foreground/40 uppercase tracking-[0.2em] mt-0.5">
              System monitoring active
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            {syncStatus && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-mono text-[9px] text-foreground/30 uppercase tracking-widest">
                    Data Synchronicity
                  </span>
                  <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      className="h-full bg-accent" 
                      initial={{ width: 0 }}
                      animate={{ width: `${syncStatus.progress}%` }}
                      transition={{ duration: 1, ease: "circOut" }}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className={clsx(
                    "font-mono text-[11px] font-medium tracking-tighter",
                    syncStatus.progress === 100 ? "text-accent" : "text-foreground/60"
                  )}>
                    {syncStatus.progress === 100 ? "OPTIMIZED" : `${syncStatus.progress}%`}
                  </span>
                </div>
              </div>
            )}
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || (syncStatus && syncStatus.progress !== undefined && syncStatus.progress < 100)}
              className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-xl transition-all text-foreground/60 hover:text-foreground disabled:opacity-30 shadow-lg"
              title="Trigger Delta Sync"
            >
              <RefreshCw size={18} className={syncMutation.isPending ? "animate-spin" : ""} />
            </motion.button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 relative custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
