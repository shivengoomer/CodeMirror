"use client";

import { HTMLMotionProps, motion } from "framer-motion";
import clsx from "clsx";

interface PremiumCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  variant?: "default" | "elevated" | "flat" | "accent";
}

export function PremiumCard({
  children,
  className,
  glow = false,
  variant = "default",
  ...props
}: PremiumCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.015 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        "relative rounded-xl overflow-hidden group transition-all duration-300",
        // Variant styles using theme-based CSS variables
        variant === "default" && "bg-[var(--surface)] border border-[var(--border)] backdrop-blur-xl",
        variant === "elevated" && "bg-[var(--bg-secondary)]/80 border border-[var(--border)] backdrop-blur-xl shadow-premium",
        variant === "flat" && "bg-white/[0.01] border border-[var(--border)]",
        variant === "accent" && "bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent-alt)]/5 border border-[var(--border)]",
        // Glow shadows in accent color only (using theme's --glow)
        glow && "shadow-glow",
        className
      )}
      {...props}
    >
      {/* Top edge subtle highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />

      {/* Glow overlay on hover */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}

      {/* Content with generous padding */}
      <div className="relative z-10 p-8">
        {children}
      </div>
    </motion.div>
  );
}
