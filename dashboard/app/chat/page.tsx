"use client";

import clsx from "clsx";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Brain, User, CornerDownLeft } from "lucide-react";
import { PremiumCard } from "@/components/ui/PremiumCard";

interface Message {
  role: "user" | "coach";
  text: string;
}

export default function ChatView() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "user",
      text: "I keep failing on cycle detection in directed graphs. I use a visited set but it doesn't work for Course Schedule."
    },
    {
      role: "coach",
      text: "A single visited set is sufficient for undirected graphs to prevent revisiting. However, in directed graphs, reaching an already visited node doesn't strictly mean there's a cycle—it might just be a cross-edge to a fully processed path.\n\nTo detect a cycle in a directed graph, you must track the current active path. Use a 'recursion stack' (or a state array: 0=unvisited, 1=visiting, 2=visited)."
    }
  ]);

  const chatMutation = useMutation({
    mutationFn: (msg: string) => api.chat(msg, { context: "recent failures" }),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "coach", text: data.text }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "coach", text: "I apologize, but my neural connection was interrupted. Please try rephrasing your inquiry." }]);
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const msg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setInput("");
    chatMutation.mutate(msg);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col relative">
      {/* Pinned Context Bar */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 glass border-b border-white/5 py-3 px-6 z-10 rounded-2xl flex items-center justify-between shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
            <Sparkles size={14} className="text-accent" />
          </div>
          <span className="font-mono text-[11px] text-foreground/40 uppercase tracking-[0.2em]">
            Neural Context <span className="text-accent font-bold">Active</span>
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-[10px] font-mono text-foreground/30 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
            14 ANALYSES
          </span>
          <span className="text-[10px] font-mono text-foreground/30 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
            3 PATTERNS
          </span>
        </div>
      </motion.div>

      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-auto pt-20 pb-32 flex flex-col gap-8 px-2 custom-scrollbar no-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={clsx("flex gap-4", m.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div className={clsx(
                "w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center border transition-all duration-300",
                m.role === "user" 
                  ? "bg-white/5 border-white/5 text-foreground/40" 
                  : "bg-accent/10 border-accent/20 text-accent shadow-[0_0_15px_-5px_rgba(29,158,117,0.3)]"
              )}>
                {m.role === "user" ? <User size={18} /> : <Brain size={18} />}
              </div>
              
              <div className={clsx(
                "flex flex-col gap-2 max-w-[75%]",
                m.role === "user" ? "items-end" : "items-start"
              )}>
                <div className={clsx(
                  "p-5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap transition-all duration-300",
                  m.role === "user" 
                    ? "bg-white/[0.03] border border-white/5 text-foreground/80 rounded-tr-none" 
                    : "glass border-accent/10 text-foreground/90 rounded-tl-none shadow-premium group hover:border-accent/30"
                )}>
                  {m.text}
                </div>
                <span className="font-mono text-[9px] text-foreground/20 uppercase tracking-widest px-2">
                  {m.role === "user" ? "User Terminal" : "Cognitive Coach"}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {chatMutation.isPending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4"
          >
             <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent animate-pulse">
               <Brain size={18} />
             </div>
             <div className="glass border-accent/10 p-5 rounded-2xl rounded-tl-none max-w-[75%] flex gap-1 items-center">
               <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
               <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
               <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
             </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-6 left-0 right-0 px-2">
        <PremiumCard className="!p-2 overflow-visible">
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Inquire about patterns or strategies..."
              className="flex-1 bg-transparent border-none py-4 pl-6 pr-12 text-[15px] text-foreground placeholder-foreground/20 focus:outline-none focus:ring-0 transition-all font-sans"
            />
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="absolute right-2 p-3 bg-accent text-white rounded-xl disabled:opacity-30 disabled:grayscale transition-all shadow-[0_0_20px_-5px_rgba(29,158,117,0.5)] flex items-center justify-center"
            >
              <CornerDownLeft size={18} />
            </motion.button>
          </div>
        </PremiumCard>
        <div className="mt-3 flex justify-center gap-4 text-[9px] font-mono text-foreground/20 uppercase tracking-[0.3em]">
          <span>Shift + Enter for multiline</span>
          <div className="w-1 h-1 rounded-full bg-foreground/10 self-center" />
          <span>Powered by neural analysis engine</span>
        </div>
      </div>
    </div>
  );
}
