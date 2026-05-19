"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserProfile } from "@/types/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { Settings, Shield, Globe, Clock, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsView() {
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: api.getProfile,
  });

  const [formData, setFormData] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        leetcode_username: profile.leetcode_username || "",
        gfg_username: profile.gfg_username || "",
        hackerrank_username: profile.hackerrank_username || "",
        available_minutes_per_day: profile.available_minutes_per_day || 30,
        timezone: profile.timezone || "UTC",
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => api.updateProfile(data),
    onSuccess: () => {
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) return (
    <div className="max-w-3xl mx-auto flex flex-col gap-10 animate-pulse">
       <div className="h-10 w-48 bg-white/5 rounded-lg" />
       <div className="h-64 w-full bg-white/5 rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-12 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
          System Configuration
        </h1>
        <p className="text-foreground/40 text-sm font-mono tracking-wide">
          Manage your neural link and environment
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <PremiumCard>
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-accent" />
              <h2 className="text-sm font-medium text-foreground/90 uppercase tracking-widest font-mono">Platform Integrity</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {[
                { label: "LeetCode", key: "leetcode_username", placeholder: "leetcode_id" },
                { label: "GeeksforGeeks", key: "gfg_username", placeholder: "gfg_id" },
                { label: "HackerRank", key: "hackerrank_username", placeholder: "hr_id" },
              ].map((field) => (
                <div key={field.key} className="flex flex-col gap-3">
                  <label className="text-[10px] font-mono font-bold text-foreground/30 uppercase tracking-[0.2em] ml-1">
                    {field.label} Signature
                  </label>
                  <input
                    type="text"
                    value={(formData as any)[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="bg-white/[0.03] border border-white/5 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all text-foreground placeholder-foreground/10"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-purple-400" />
              <h2 className="text-sm font-medium text-foreground/90 uppercase tracking-widest font-mono">Temporal Bounds</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-mono font-bold text-foreground/30 uppercase tracking-[0.2em] ml-1">
                  Daily Quota (min)
                </label>
                <input
                  type="number"
                  value={formData.available_minutes_per_day || 0}
                  onChange={(e) => setFormData({ ...formData, available_minutes_per_day: parseInt(e.target.value) })}
                  className="bg-white/[0.03] border border-white/5 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all text-foreground"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-mono font-bold text-foreground/30 uppercase tracking-[0.2em] ml-1">
                  Standard Timezone
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={14} />
                  <input
                    type="text"
                    value={formData.timezone || "UTC"}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-11 pr-5 py-3 text-sm focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        </PremiumCard>

        <div className="flex justify-end pt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-accent text-white font-bold px-8 py-3.5 rounded-xl hover:bg-accent/90 transition-all disabled:opacity-30 shadow-[0_10px_20px_-10px_rgba(29,158,117,0.5)] flex items-center gap-2 group"
          >
            {updateMutation.isPending ? "Syncing..." : (
              <>
                Save Configuration <Save size={18} className="group-hover:rotate-12 transition-transform" />
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
