"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function PremiumCard({ children, className, glow = false }: PremiumCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={clsx(
        "glass glass-hover p-6 rounded-2xl relative overflow-hidden group shadow-premium",
        glow && "before:absolute before:inset-0 before:bg-accent/5 before:opacity-0 group-hover:before:opacity-100 before:transition-opacity",
        className
      )}
    >
      {/* Subtle Border Glow */}
      <div className="absolute inset-0 border border-white/[0.03] rounded-2xl pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Hover Light Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-accent/0 via-accent/[0.02] to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </motion.div>
  );
}
