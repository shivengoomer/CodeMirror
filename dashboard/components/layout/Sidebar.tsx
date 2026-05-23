"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  CheckSquare,
  MessageSquare,
  BarChart2,
  Settings,
  LogOut,
  FileText,
  List,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Zap,
  Code2,
  Cpu,
} from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Intelligence", badge: null },
      { href: "/submissions", icon: List, label: "Submissions", badge: null },
      { href: "/stats", icon: BarChart2, label: "Analytics", badge: null },
    ],
  },
  {
    label: "Learning",
    items: [
      { href: "/fingerprints", icon: Activity, label: "Fingerprints", badge: "AI" },
      { href: "/revision", icon: CheckSquare, label: "Revision Queue", badge: null },
      { href: "/problems", icon: FileText, label: "Problem Index", badge: null },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/visualizer", icon: Code2, label: "Visualizer", badge: "Beta" },
      { href: "/visualize", icon: Cpu, label: "DSA Visualizer", badge: "New" },
      { href: "/chat", icon: MessageSquare, label: "AI Coach", badge: "GPT" },
      { href: "/settings", icon: Settings, label: "Settings", badge: null },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Persistence of sidebar state
  useEffect(() => {
    const saved = localStorage.getItem("cm_sidebar_collapsed");
    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem("cm_sidebar_collapsed", nextState ? "true" : "false");
  };

  const handleLogout = () => {
    localStorage.removeItem("cm_dashboard_access_token");
    router.push("/login");
  };

  return (
    <aside
      className={clsx(
        "shrink-0 h-screen flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)]/20 backdrop-blur-xl relative z-50 transition-all duration-300 ease-in-out select-none",
        collapsed ? "w-[64px]" : "w-[220px]"
      )}
    >
      {/* Subtle top gradient */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent" />
      {/* Ambient glow */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Logo / Brand ── */}
      <div
        className={clsx(
          "px-4 pt-6 pb-5 flex items-center border-b border-[var(--border)] transition-all duration-300",
          collapsed ? "justify-center gap-0" : "gap-3"
        )}
      >
        <motion.div
          onClick={toggleCollapse}
          className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent-alt)]/20 border border-[var(--accent)]/30 flex items-center justify-center cursor-pointer shadow-lg shadow-[var(--accent)]/5 shrink-0"
        >
          <Sparkles className="text-[var(--accent)]" size={14} />
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-transparent animate-pulse-glow" />
        </motion.div>
        
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
          >
            <span className="text-[13px] font-semibold text-[var(--foreground)] tracking-tight font-display leading-tight">
              CodeMirror
            </span>
            <span className="text-[9px] text-[var(--accent)] font-mono font-medium tracking-widest uppercase leading-none mt-0.5">
              AI Coach
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-4 flex flex-col gap-4">
        {navGroups.map((group, gi) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {!collapsed && (
              <span className="text-[8.5px] font-semibold text-[var(--foreground-muted)]/40 uppercase tracking-[0.16em] px-3 mb-1 font-sans">
                {group.label}
              </span>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "group relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 overflow-hidden",
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                    isActive
                      ? "text-[var(--foreground)] bg-[var(--accent)]/10"
                      : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Left Border for active item */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                  )}

                  <div
                    className={clsx(
                      "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all duration-200",
                      isActive
                        ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                        : "bg-white/[0.02] text-[var(--foreground-muted)] group-hover:bg-white/[0.06] group-hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon size={13} strokeWidth={isActive ? 2.2 : 1.8} />
                  </div>

                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 ml-2.5 truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}

                  {!collapsed && item.badge && (
                    <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider scale-90">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── System Status ── */}
      <div className="px-2 mb-2">
        <div
          className={clsx(
            "rounded-lg bg-white/[0.02] border border-[var(--border)] transition-all duration-300",
            collapsed ? "p-2.5 flex justify-center" : "p-3 flex items-center gap-2.5"
          )}
        >
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)]" />
            <div className="absolute w-3.5 h-3.5 rounded-full bg-[var(--accent-green)]/20 animate-ping" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-medium text-[var(--foreground)] truncate leading-tight">System Online</span>
              <span className="text-[8px] font-mono text-[var(--foreground-muted)] uppercase tracking-wider leading-none mt-0.5">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Collapse / Expand Footer Action ── */}
      <div className="px-2 mb-1">
        <button
          onClick={toggleCollapse}
          className="group w-full flex items-center justify-center p-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] border border-transparent hover:border-[var(--border)] transition-all duration-200"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* ── User / Logout ── */}
      <div className="border-t border-[var(--border)] px-2 py-3">
        <button
          onClick={handleLogout}
          className={clsx(
            "group w-full flex items-center rounded-lg text-[12px] font-medium text-[var(--foreground-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/[0.05] transition-all duration-200",
            collapsed ? "justify-center p-2" : "px-3 py-2 gap-2.5"
          )}
        >
          <div className="w-6 h-6 rounded-md bg-white/[0.02] group-hover:bg-[var(--error)]/10 flex items-center justify-center transition-all duration-200 shrink-0">
            <LogOut size={12} strokeWidth={1.8} />
          </div>
          {!collapsed && <span className="truncate">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
