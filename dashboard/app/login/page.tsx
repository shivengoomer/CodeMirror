"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { PremiumCard } from "@/components/ui/PremiumCard";
import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api.login({ email, password });
      localStorage.setItem("cm_dashboard_access_token", data.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none" />
      <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse-glow" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10 px-6"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/30 shadow-[0_0_20px_-5px_rgba(29,158,117,0.4)] mb-6"
          >
            <Sparkles className="text-accent" size={32} />
          </motion.div>
          <h1 className="text-3xl font-medium tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent mb-2">
            Welcome back
          </h1>
          <p className="text-foreground/40 text-sm font-mono uppercase tracking-[0.2em]">
            Neural Gateway Access
          </p>
        </div>

        <PremiumCard glow className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono font-bold text-foreground/30 uppercase tracking-widest ml-1">Identity Vector</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/[0.03] border border-white/5 rounded-xl px-5 py-3 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all text-foreground placeholder-foreground/10 text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-mono font-bold text-foreground/30 uppercase tracking-widest">Access Key</label>
                <button type="button" className="text-[10px] font-mono text-accent/60 hover:text-accent transition-colors uppercase tracking-widest">Recovery</button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/[0.03] border border-white/5 rounded-xl px-5 py-3 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all text-foreground placeholder-foreground/10 text-sm"
                placeholder="••••••••"
                required
              />
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-error/5 border border-error/20 rounded-xl p-3 text-error text-[11px] font-mono text-center"
              >
                {error}
              </motion.div>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="bg-accent text-white font-bold py-3.5 rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 shadow-[0_10px_20px_-10px_rgba(29,158,117,0.5)] flex items-center justify-center gap-2 group"
            >
              {loading ? "Authenticating..." : (
                <>
                  Establish Connection <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 flex flex-col gap-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-card px-3 text-foreground/20 font-mono uppercase tracking-widest">Secondary Uplink</span>
              </div>
            </div>

            <button className="w-full bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] text-foreground/60 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium">
               Continue with GitHub
            </button>
          </div>
        </PremiumCard>

        <p className="mt-8 text-center text-[11px] text-foreground/30 font-mono uppercase tracking-[0.2em]">
          New explorer?{" "}
          <Link href="/register" className="text-accent hover:text-accent-foreground transition-colors font-bold">
            Initialize Account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
