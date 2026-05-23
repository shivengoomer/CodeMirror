"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useTheme } from "@/components/Providers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  RefreshCw,
  Bell,
  LayoutDashboard,
  List,
  BarChart2,
  Activity,
  CheckSquare,
  FileText,
  MessageSquare,
  Settings,
  ChevronRight,
  Sun,
  Moon,
  Database,
  Code2,
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const routeMeta: Record<string, { title: string; subtitle: string; icon: any }> = {
  "/": { title: "Intelligence Overview", subtitle: "AI-powered performance insights", icon: LayoutDashboard },
  "/submissions": { title: "Submissions", subtitle: "Browse and analyze your solutions", icon: List },
  "/stats": { title: "Analytics", subtitle: "Performance metrics & trends", icon: BarChart2 },
  "/fingerprints": { title: "Fingerprints", subtitle: "Detected mistake patterns", icon: Activity },
  "/revision": { title: "Revision Queue", subtitle: "Spaced repetition practice", icon: CheckSquare },
  "/problems": { title: "Problem Index", subtitle: "Synchronized problem repository", icon: FileText },
  "/visualizer": { title: "Code Visualizer", subtitle: "Step-by-step execution tracer", icon: Code2 },
  "/visualize": { title: "DSA Visualizer", subtitle: "Topic-aware step-by-step submission simulations", icon: Cpu },
  "/dsa-visualizer": { title: "DSA Visualizer", subtitle: "Interactive structures & patterns", icon: Cpu },
  "/chat": { title: "AI Coach", subtitle: "Personalized guidance & strategy", icon: MessageSquare },
  "/settings": { title: "Settings", subtitle: "Preferences & configuration", icon: Settings },
};

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/register";
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const { data: syncStatus, refetch: refetchSync } = useQuery({
    queryKey: ["syncStatus"],
    queryFn: api.getSyncStatus,
    refetchInterval: (query: any) => (query.state.data?.progress === 100 ? false : 8000),
    enabled: !isPublicPage,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: () => refetchSync(),
  });

  // Track previous progress to detect completion transitions
  const [prevProgress, setPrevProgress] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!syncStatus) return;

    if (prevProgress !== undefined && prevProgress < 100 && syncStatus.progress === 100) {
      // Sync just finished successfully! Invalidate all dashboard & statistics caches
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["interviewReadiness"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["patterns"] });
      queryClient.invalidateQueries({ queryKey: ["trends"] });
      queryClient.invalidateQueries({ queryKey: ["revisionToday"] });
    }

    setPrevProgress(syncStatus.progress);
  }, [syncStatus?.progress, prevProgress, queryClient]);

  // Throttled auto-sync trigger on mount/load (once every 5 minutes)
  useEffect(() => {
    if (isPublicPage || !syncStatus || !syncStatus.ready) return;

    // Only trigger if a sync is not already running
    if (syncStatus.progress !== 100) return;

    const LAST_SYNC_KEY = "codemirror_last_auto_sync_ts";
    const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (!lastSyncStr || now - parseInt(lastSyncStr, 10) > fiveMinutes) {
      localStorage.setItem(LAST_SYNC_KEY, now.toString());
      syncMutation.mutate();
    }
  }, [isPublicPage, syncStatus?.ready, syncStatus?.progress]);

  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.getNotifications,
    enabled: !isPublicPage,
    refetchInterval: 60000,
  });

  if (isPublicPage) {
    return (
      <main className="flex-1 h-screen overflow-auto relative bg-[var(--background)]">
        <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none" />
        {children}
      </main>
    );
  }

  const meta = routeMeta[pathname] || { title: "Dashboard", subtitle: "", icon: LayoutDashboard };
  const unreadCount = notifs?.length || 0;
  const isSyncing = syncMutation.isPending || (syncStatus?.progress !== undefined && syncStatus.progress < 100);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[var(--background)] relative font-sans transition-colors duration-300">
      {/* ── Global Ambient Blobs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[5%] w-[45%] h-[45%] bg-[var(--accent)]/[0.04] rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute top-[55%] -right-[10%] w-[35%] h-[35%] bg-[var(--accent-alt)]/[0.03] rounded-full blur-[120px] animate-float" />
        <div className="absolute top-[30%] left-[40%] w-[20%] h-[20%] bg-[var(--accent-green)]/[0.01] rounded-full blur-[80px]" />
      </div>

      {/* ── Dot Grid ── */}
      <div className="fixed inset-0 bg-dot-grid opacity-[0.25] pointer-events-none z-0" />

      <Sidebar />

      <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* ── Header ── */}
        <header className="h-16 shrink-0 px-8 flex items-center justify-between bg-transparent relative">
          {/* Subtle header separator in 20% accent color */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--accent)]/20" />

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--foreground-muted)]">
            <span className="opacity-40 font-display">CodeMirror</span>
            <ChevronRight size={10} className="opacity-30" />
            <span className="text-[var(--foreground)] font-semibold font-display tracking-tight text-[13px]">{meta.title}</span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Sync Progress */}
            <AnimatePresence>
              {syncStatus && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 pr-3 border-r border-[var(--border)]"
                >
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[8.5px] font-mono text-[var(--foreground-muted)] uppercase tracking-wider leading-none">
                      Sync
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-green)] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${syncStatus.progress ?? 0}%` }}
                          transition={{ duration: 0.8, ease: "circOut" }}
                        />
                      </div>
                      <span className={clsx(
                        "text-[9px] font-mono font-semibold w-8 text-right leading-none",
                        syncStatus.progress === 100 ? "text-[var(--accent-green)]" : "text-[var(--foreground-muted)]"
                      )}>
                        {syncStatus.progress === 100 ? "LIVE" : `${syncStatus.progress ?? 0}%`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sync Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => syncMutation.mutate()}
              disabled={isSyncing}
              className={clsx(
                "w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200",
                isSyncing
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] bg-white/[0.02] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-white/[0.06]"
              )}
              title="Trigger sync"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
            </motion.button>

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-8 h-8 rounded-lg border border-[var(--border)] bg-white/[0.02] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-white/[0.06] flex items-center justify-center transition-all duration-200"
            >
              <Bell size={12} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-white text-[7px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </motion.button>

            {/* Theme Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="relative w-8 h-8 rounded-lg border border-[var(--border)] bg-white/[0.02] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-white/[0.06] flex items-center justify-center transition-all duration-200"
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent-alt)]/20 border border-[var(--accent)]/30 flex items-center justify-center text-[11px] font-mono font-bold text-white/80 cursor-pointer hover:opacity-90 transition-all shadow-md">
              U
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <div className="flex-1 overflow-auto custom-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="min-h-full p-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
