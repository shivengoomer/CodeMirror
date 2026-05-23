"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserProfile } from "@/types/api";
import { PremiumCard } from "@/components/ui/PremiumCard";
import {
  Settings, Shield, Globe, Clock, Save, Key, CheckCircle2,
  AlertTriangle, RefreshCw, ExternalLink, Eye, EyeOff, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SettingsView() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: api.getProfile,
  });

  const [formData, setFormData] = useState<Partial<UserProfile>>({});

  // LeetCode session reconnect state
  const [lcSession, setLcSession] = useState("");
  const [lcCsrf, setLcCsrf] = useState("");
  const [showSession, setShowSession] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionMsg, setSessionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);

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
    // Load sync status to show session health
    api.getSyncStatus().then(setSyncStatus).catch(() => {});
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => api.updateProfile(data),
    onSuccess: () => { refetch(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleSaveSession = async () => {
    const sessionVal = lcSession.trim();
    if (!sessionVal) {
      setSessionMsg({ type: "error", text: "LEETCODE_SESSION cookie value is required" });
      return;
    }

    // Client-side Clerk/JWT check
    if (sessionVal.split(".").length === 3) {
      try {
        const payload = JSON.parse(atob(sessionVal.split(".")[1]));
        if (payload.iss && (payload.iss.includes("clerk") || payload.iss.includes("accounts.dev"))) {
          setSessionMsg({
            type: "error",
            text: "The entered value is a Clerk authentication token, not a LeetCode session cookie. Please copy the LEETCODE_SESSION cookie from leetcode.com."
          });
          return;
        }
      } catch (e) {}
    }

    // Client-side short/invalid check
    if (sessionVal.toLowerCase() === "test" || sessionVal.length <= 20) {
      setSessionMsg({
        type: "error",
        text: "The entered value is too short to be a valid LeetCode session cookie. Please copy the correct LEETCODE_SESSION cookie from leetcode.com."
      });
      return;
    }

    setSessionSaving(true);
    setSessionMsg(null);
    try {
      const csrf = lcCsrf.trim() || undefined;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      };
      if (csrf) {
        headers["Cookie"] = `LEETCODE_SESSION=${lcSession.trim()}; csrftoken=${csrf}`;
        headers["x-csrftoken"] = csrf;
      } else {
        headers["Cookie"] = `LEETCODE_SESSION=${lcSession.trim()}`;
      }

      const result = await api.syncLeetCodeSession({
        leetcode_session: lcSession.trim(),
        leetcode_csrf: csrf,
        leetcode_headers: headers,
      });

      if (result.status === "ok") {
        setSessionMsg({ type: "success", text: "Session saved! Running code backfill in background…" });
        setLcSession("");
        setLcCsrf("");
        // Trigger backfill for existing submissions with missing code
        try {
          const backfill = await api.backfillCode();
          if (backfill.pending_count > 0) {
            setSessionMsg({
              type: "success",
              text: `Session saved! Fetching code for ${backfill.pending_count} submissions in background. Refresh submissions in ~30s.`
            });
          } else {
            setSessionMsg({ type: "success", text: "Session saved! ✓ All submissions already have code." });
          }
        } catch {
          // backfill failure is non-critical
        }
        // Refresh sync status
        api.getSyncStatus().then(setSyncStatus).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["submissions"] });
      } else {
        setSessionMsg({ type: "error", text: `Unexpected response: ${JSON.stringify(result)}` });
      }
    } catch (err: any) {
      setSessionMsg({ type: "error", text: `Failed: ${err.message}` });
    } finally {
      setSessionSaving(false);
    }
  };

  const sessionHealthy = syncStatus?.has_leetcode_session && syncStatus?.sync_status !== "failed";

  if (isLoading) return (
    <div className="w-full flex flex-col gap-10 animate-pulse">
      <div className="h-10 w-48 bg-white/5 rounded-lg" />
      <div className="h-64 w-full bg-white/5 rounded-2xl" />
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-12 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
          System Configuration
        </h1>
        <p className="text-foreground/40 text-sm font-mono tracking-wide">
          Manage your neural link and environment
        </p>
      </div>

      {/* ── LeetCode Session Reconnect ── */}
      <PremiumCard>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
                <Key size={15} className="text-[#F59E0B]" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-foreground/90 uppercase tracking-widest font-mono">
                  LeetCode Session Link
                </h2>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">
                  Required to fetch your submission code from LeetCode
                </p>
              </div>
            </div>
            {/* Session health indicator */}
            <div className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border ${
              sessionHealthy
                ? "text-[#10D986] bg-[#10D986]/5 border-[#10D986]/20"
                : "text-[#F59E0B] bg-[#F59E0B]/5 border-[#F59E0B]/20"
            }`}>
              {sessionHealthy ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
              {sessionHealthy ? "Connected" : "Not connected"}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[#0d0d18] border border-white/[0.06] rounded-xl p-4 text-[11px] font-mono text-white/50 leading-relaxed space-y-2">
            <p className="text-white/70 font-semibold">How to get your LeetCode session cookies:</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>Open <a href="https://leetcode.com" target="_blank" rel="noopener noreferrer" className="text-[#6C63FF] hover:underline inline-flex items-center gap-0.5">leetcode.com <ExternalLink size={9} /></a> and log in</li>
              <li>Open DevTools → Application → Cookies → <code className="text-white/60">https://leetcode.com</code></li>
              <li>Copy the value of <code className="text-[#F59E0B]">LEETCODE_SESSION</code> (very long string)</li>
              <li>Copy the value of <code className="text-[#10D986]">csrftoken</code></li>
              <li>Paste them below and click Save</li>
            </ol>
          </div>

          <div className="flex flex-col gap-4">
            {/* LEETCODE_SESSION */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono font-bold text-[#F59E0B]/70 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]/50 inline-block" />
                LEETCODE_SESSION Cookie Value
              </label>
              <div className="relative">
                <input
                  id="lc-session-input"
                  type={showSession ? "text" : "password"}
                  value={lcSession}
                  onChange={(e) => setLcSession(e.target.value)}
                  placeholder="eyJ0eXAiOiJKV1QiLCJhbGci... (very long)"
                  className="w-full bg-white/[0.03] border border-[#F59E0B]/10 focus:border-[#F59E0B]/30 rounded-xl px-4 py-3 pr-12 text-sm font-mono text-white/80 focus:outline-none focus:ring-1 focus:ring-[#F59E0B]/10 transition-all placeholder-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowSession(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                >
                  {showSession ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {lcSession && (
                <p className="text-[10px] text-white/30 font-mono ml-1">Length: {lcSession.length} chars {lcSession.length > 100 ? "✓" : "⚠ seems short"}</p>
              )}
            </div>

            {/* csrftoken */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono font-bold text-[#10D986]/70 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10D986]/50 inline-block" />
                csrftoken Cookie Value <span className="text-white/20 normal-case">(optional)</span>
              </label>
              <input
                id="lc-csrf-input"
                type="text"
                value={lcCsrf}
                onChange={(e) => setLcCsrf(e.target.value)}
                placeholder="abcdef1234567890..."
                className="w-full bg-white/[0.03] border border-[#10D986]/10 focus:border-[#10D986]/30 rounded-xl px-4 py-3 text-sm font-mono text-white/80 focus:outline-none focus:ring-1 focus:ring-[#10D986]/10 transition-all placeholder-white/10"
              />
            </div>
          </div>

          {/* Status message */}
          <AnimatePresence>
            {sessionMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`flex items-start gap-2 p-3 rounded-xl border text-[11px] font-mono ${
                  sessionMsg.type === "success"
                    ? "bg-[#10D986]/5 border-[#10D986]/20 text-[#10D986]"
                    : "bg-[#FF5058]/5 border-[#FF5058]/20 text-[#FF5058]"
                }`}
              >
                {sessionMsg.type === "success" ? <CheckCircle2 size={12} className="shrink-0 mt-0.5" /> : <AlertTriangle size={12} className="shrink-0 mt-0.5" />}
                {sessionMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            id="save-lc-session-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleSaveSession}
            disabled={sessionSaving || !lcSession.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 hover:bg-[#F59E0B]/20 text-[#F59E0B] text-[11px] font-mono uppercase tracking-widest font-bold transition-all disabled:opacity-40"
          >
            {sessionSaving ? (
              <><RefreshCw size={13} className="animate-spin" /> Saving & Syncing…</>
            ) : (
              <><Zap size={13} /> Save Session & Fetch Missing Code</>
            )}
          </motion.button>
        </div>
      </PremiumCard>

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
