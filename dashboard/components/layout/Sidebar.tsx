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
  Sparkles
} from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Intelligence" },
  { href: "/submissions", icon: List, label: "Submissions" },
  { href: "/fingerprints", icon: Activity, label: "Fingerprints" },
  { href: "/revision", icon: CheckSquare, label: "Revision Queue" },
  { href: "/problems", icon: FileText, label: "Saved Problems" },
  { href: "/chat", icon: MessageSquare, label: "Coach Chat" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("cm_dashboard_access_token");
    router.push("/login");
  };

  return (
    <aside className="w-20 shrink-0 bg-background border-r border-border flex flex-col items-center py-8 gap-8 z-50">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-2 border border-accent/30 shadow-[0_0_15px_-5px_rgba(29,158,117,0.4)]"
      >
        <Sparkles className="text-accent" size={20} />
      </motion.div>
      
      <nav className="flex-1 flex flex-col w-full gap-3 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHoveredPath(item.href)}
              onMouseLeave={() => setHoveredPath(null)}
              className={clsx(
                "group relative flex items-center justify-center w-full h-12 rounded-xl transition-all duration-300",
                isActive ? "text-accent" : "text-foreground/40 hover:text-foreground/80"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-accent/5 rounded-xl border border-accent/20 shadow-[inset_0_0_10px_rgba(29,158,117,0.05)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <AnimatePresence>
                {hoveredPath === item.href && !isActive && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-white/[0.03] rounded-xl border border-white/[0.05]"
                  />
                )}
              </AnimatePresence>

              <Icon 
                size={22} 
                strokeWidth={isActive ? 2 : 1.5} 
                className={clsx("relative z-10 transition-transform duration-300 group-hover:scale-110", isActive && "drop-shadow-[0_0_8px_rgba(29,158,117,0.4)]")} 
              />
              
              {/* Tooltip */}
              <div className="absolute left-16 px-3 py-2 bg-card/90 backdrop-blur-md text-foreground text-[11px] font-medium rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 shadow-xl whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="w-full px-3 mt-auto">
        <button
          onClick={handleLogout}
          className="group relative flex items-center justify-center w-full h-12 rounded-xl text-foreground/40 hover:text-error hover:bg-error/5 transition-all duration-300"
        >
          <LogOut size={22} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute left-16 px-3 py-2 bg-card/90 backdrop-blur-md text-foreground text-[11px] font-medium rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 shadow-xl whitespace-nowrap z-50">
            Logout
          </div>
        </button>
      </div>
    </aside>
  );
}
