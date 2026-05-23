"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Submission } from "@/types/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Search,
  Sliders,
  AlertCircle,
  HelpCircle,
  Edit3,
  CheckCircle,
  XCircle,
  Cpu,
  Layers,
  Flame,
  ArrowRight,
  Maximize2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { routeTopic, VisualizerType } from "./visualizers/utils/topicRouter";
import { generateSteps, parseInput, getPseudocode, getDefaultInputString, TraceStep } from "./visualizers/utils/stepGenerator";

// Load Konva components dynamically to bypass SSR window-not-defined errors
const ArrayVisualizer = dynamic(() => import("./visualizers/ArrayVisualizer"), { ssr: false });
const TreeVisualizer = dynamic(() => import("./visualizers/TreeVisualizer"), { ssr: false });
const GraphVisualizer = dynamic(() => import("./visualizers/GraphVisualizer"), { ssr: false });
const DPTableVisualizer = dynamic(() => import("./visualizers/DPTableVisualizer"), { ssr: false });
const StackQueueVisualizer = dynamic(() => import("./visualizers/StackQueueVisualizer"), { ssr: false });
const LinkedListVisualizer = dynamic(() => import("./visualizers/LinkedListVisualizer"), { ssr: false });
const StringVisualizer = dynamic(() => import("./visualizers/StringVisualizer"), { ssr: false });
const HeapVisualizer = dynamic(() => import("./visualizers/HeapVisualizer"), { ssr: false });

export default function VisualizePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subIdParam = searchParams.get("subId");

  const [selectedSubId, setSelectedSubId] = useState<string | null>(subIdParam);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerExpanded, setDrawerExpanded] = useState(true);
  
  // Sync subId query parameter with local state if changed from outside
  useEffect(() => {
    if (subIdParam && subIdParam !== selectedSubId) {
      setSelectedSubId(subIdParam);
    }
  }, [subIdParam, selectedSubId]);

  // Update URL search parameter when selectedSubId changes internally
  const handleSelectSubmission = (id: string) => {
    setSelectedSubId(id);
    router.replace(`/visualize?subId=${id}`);
  };
  
  // Custom input state
  const [customInput, setCustomInput] = useState("");
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Playback state
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.5x, 1x, 2x, 3x

  // Canvas size state
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });

  // Log scroll ref
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Cache for analysis V2 (to prevent re-fetching on every state change/render)
  const analysisCache = useRef<Record<string, any>>({});

  // 1. Fetch Submissions List
  const { data: submissionsData, isLoading: listLoading, error: listError } = useQuery({
    queryKey: ["submissionsList"],
    queryFn: () => api.listSubmissions({ limit: 100 })
  });

  const submissions = submissionsData?.items || [];

  // Filter Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s =>
      (s.problem_title || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [submissions, searchQuery]);

  // 2. Fetch Selected Submission Details
  const { data: submissionDetail, isLoading: subDetailLoading, error: subDetailError } = useQuery({
    queryKey: ["submissionDetail", selectedSubId],
    queryFn: () => (selectedSubId ? api.getSubmission(selectedSubId) : Promise.resolve(null)),
    enabled: !!selectedSubId
  });

  // 3. Fetch (or pull from cache) Analysis V2
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    if (!selectedSubId) {
      setAnalysisData(null);
      return;
    }

    if (analysisCache.current[selectedSubId]) {
      setAnalysisData(analysisCache.current[selectedSubId]);
      return;
    }

    setAnalysisLoading(true);
    api.getAnalysisV2(selectedSubId)
      .then(res => {
        analysisCache.current[selectedSubId] = res;
        setAnalysisData(res);
      })
      .catch(err => {
        console.error("Failed to load V2 analysis", err);
        setAnalysisData(null);
      })
      .finally(() => {
        setAnalysisLoading(false);
      });
  }, [selectedSubId]);

  // 4. Topic Routing & Visualizer Setup
  const topicTags = useMemo(() => {
    if (!submissionDetail) return [];
    // Handle either schema tags or topic_tags from database
    return (submissionDetail as any).topic_tags || (submissionDetail as any).tags || [];
  }, [submissionDetail]);

  const visualizerType: VisualizerType = useMemo(() => {
    return routeTopic(topicTags);
  }, [topicTags]);

  const hasTopicMatch = useMemo(() => {
    // If routeTopic fell back to ArrayVisualizer but tags didn't actually contain array keys, show warning
    if (topicTags.length === 0) return true;
    const mappedType = routeTopic(topicTags);
    if (mappedType === "ArrayVisualizer") {
      const keys = ["array", "sorting", "two-pointers", "sliding-window", "binary-search", "prefix-sum"];
      return topicTags.some((tag: any) => {
        const name = (typeof tag === "string" ? tag : tag.name || "").toLowerCase();
        return keys.some(k => name.includes(k));
      });
    }
    return true;
  }, [topicTags]);

  // Initialize Custom Input pre-fill whenever submission changes
  useEffect(() => {
    if (visualizerType) {
      setCustomInput(getDefaultInputString(visualizerType));
      setCurrentStep(0);
      setIsPlaying(false);
    }
  }, [visualizerType, selectedSubId]);

  // 5. Generate Simulation Steps
  const steps: TraceStep[] = useMemo(() => {
    const parsed = parseInput(customInput, visualizerType);
    return generateSteps(visualizerType, parsed);
  }, [customInput, visualizerType]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = 1000 / speed;
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, speed, steps.length]);

  // Auto-scroll the log drawer when steps progress
  useEffect(() => {
    if (logScrollRef.current) {
      const activeLine = logScrollRef.current.querySelector(".active-log-line");
      if (activeLine) {
        activeLine.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentStep]);

  // Resize Observer for Stage container
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setCanvasSize({
          width: Math.max(300, width),
          height: Math.max(200, height)
        });
      }
    });

    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, [selectedSubId]);

  // Handler for custom input confirm
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);

    // Basic validation
    if (visualizerType === "GraphVisualizer") {
      try {
        JSON.parse(customInput);
      } catch (err) {
        setInputError("Must be valid JSON containing nodes and edges arrays.");
        return;
      }
    }

    setCurrentStep(0);
    setIsPlaying(false);
    setShowInputModal(false);
  };

  const handleStepForward = () => {
    setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
  };

  const handleStepReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const activeStepState = steps[currentStep]?.state || {};
  const activeLog = steps[currentStep]?.log || "";
  const activeCodeLine = steps[currentStep]?.codeLine ?? -1;

  // Determine subType to highlight correct pseudocode
  const subType = useMemo(() => {
    if (visualizerType === "ArrayVisualizer") {
      const inputStr = customInput.toLowerCase();
      if (inputStr.includes("target=") || inputStr.includes("|")) return "binary-search";
    }
    if (visualizerType === "StringVisualizer") {
      if (customInput.includes("|")) return "compare";
    }
    return undefined;
  }, [visualizerType, customInput]);

  const pseudocodeLines = getPseudocode(visualizerType, subType);

  return (
    <div className="flex h-[calc(100vh-80px)] text-[#EEEEEE] font-sans overflow-hidden" style={{ "--bg": "#222831", "--surface": "#393E46", "--accent": "#00ADB5" } as any}>
      {/* ── LEFT SIDEBAR: Searchable submissions list ── */}
      <div className="w-[280px] shrink-0 border-r border-[rgba(0,173,181,0.15)] bg-[#222831] flex flex-col z-10">
        <div className="p-4 border-b border-[rgba(0,173,181,0.12)]">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 text-[rgba(238,238,238,0.3)]" />
            </span>
            <input
              type="text"
              className="w-full bg-[#393E46]/40 border border-[rgba(0,173,181,0.15)] rounded-lg pl-9 pr-4 py-2 text-[13px] font-sans text-[#EEEEEE] placeholder-[rgba(238,238,238,0.3)] focus:outline-none focus:ring-1 focus:ring-[#00ADB5] transition-all"
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col gap-2">
          {listLoading ? (
            // Skeleton load cards
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-20 bg-[#393E46]/20 border border-[rgba(0,173,181,0.06)] rounded-xl animate-pulse flex flex-col p-3 gap-2">
                <div className="h-3 bg-[#393E46]/50 rounded-full w-3/4" />
                <div className="h-2 bg-[#393E46]/40 rounded-full w-1/2" />
              </div>
            ))
          ) : listError ? (
            <div className="p-4 text-center text-sm text-[#FF6B6B]">
              <AlertCircle className="mx-auto mb-2 text-[#FF6B6B]" size={20} />
              Failed to load submissions
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-4 text-center text-xs text-[rgba(238,238,238,0.45)]">
              No submissions found.
            </div>
          ) : (
            filteredSubmissions.map(sub => {
              const isSelected = selectedSubId === sub.id;
              const firstTag = sub.problem_slug ? sub.problem_slug.split("-")[0] : "Code";
              const isAccepted = (sub.verdict || "").toLowerCase() === "accepted";

              return (
                <button
                  key={sub.id}
                  onClick={() => handleSelectSubmission(sub.id)}
                  className={`w-full text-left rounded-xl p-3 border transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group ${
                    isSelected
                      ? "bg-[rgba(0,173,181,0.12)] border-[#00ADB5]"
                      : "bg-[#393E46]/20 border-[rgba(0,173,181,0.08)] hover:bg-[#393E46]/40 hover:border-[rgba(0,173,181,0.2)]"
                  }`}
                >
                  {/* Left accent indicator for active */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00ADB5]" />
                  )}

                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[13px] font-semibold text-[#EEEEEE] font-display tracking-tight line-clamp-1 flex-1 group-hover:text-[#00ADB5] transition-colors">
                      {sub.problem_title || "Unnamed Problem"}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${isAccepted ? "bg-[#00ADB5]" : "bg-[#FF6B6B]"}`} />
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    {/* Tag pill */}
                    <span className="bg-[#393E46]/60 border border-[rgba(238,238,238,0.08)] text-[rgba(238,238,238,0.55)] px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                      {firstTag}
                    </span>
                    <span className="text-[rgba(238,238,238,0.35)]">
                      {sub.language}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Visualizer Stage & Drawer ── */}
      <div className="flex-1 flex flex-col bg-[#222831] relative">
        <AnimatePresence mode="wait">
          {!selectedSubId ? (
            /* Elegant empty state */
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-[rgba(0,173,181,0.08)] border border-[rgba(0,173,181,0.18)] flex items-center justify-center text-[#00ADB5] mb-4 shadow-[0_0_20px_rgba(0,173,181,0.15)]">
                <Cpu size={28} />
              </div>
              <h2 className="text-xl font-bold font-display tracking-tight text-[#EEEEEE] mb-2">
                Topic-Aware DSA Visualizer
              </h2>
              <p className="text-sm text-[rgba(238,238,238,0.45)] max-w-sm leading-relaxed mb-6 font-sans">
                Select any submission from the left sidebar. The visualizer will automatically resolve the topic tags and compile a step-by-step interactive simulation.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-md w-full">
                {["Array & Sorting", "Trees & BST", "Graph Traversals", "Stack & Queue"].map((lbl, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#393E46]/20 border border-[rgba(0,173,181,0.08)] text-left flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ADB5]" />
                    <span className="text-[12px] font-mono text-[rgba(238,238,238,0.65)]">{lbl}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="visualizer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* 1. TOPBAR */}
              <div className="h-14 border-b border-[rgba(0,173,181,0.15)] flex items-center justify-between px-6 bg-[#222831]">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold font-display tracking-tight text-[#EEEEEE]">
                    {submissionDetail?.problem_title}
                  </span>
                  
                  {/* Topic badge */}
                  {topicTags.length > 0 && (
                    <span className="bg-[#393E46] border border-[rgba(0,173,181,0.2)] text-[#00ADB5] px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider">
                      {visualizerType.replace("Visualizer", "")}
                    </span>
                  )}

                  {/* Fallback warning Notice */}
                  {!hasTopicMatch && (
                    <span className="flex items-center gap-1.5 bg-[rgba(255,183,77,0.1)] border border-[rgba(255,183,77,0.2)] text-[#FFB74D] px-2.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-wider">
                      <AlertCircle size={10} />
                      Fallback Array View
                    </span>
                  )}

                  {/* V2 Complexity details */}
                  {analysisData && (
                    <div className="flex items-center gap-3 border-l border-white/5 pl-4 text-[10px] font-mono text-[rgba(238,238,238,0.45)]">
                      <span className="flex items-center gap-1 text-[#00ADB5]">
                        Time: {analysisData.time_complexity || "O(N)"}
                      </span>
                      <span className="flex items-center gap-1 text-[#FFB74D]">
                        Space: {analysisData.space_complexity || "O(1)"}
                      </span>
                    </div>
                  )}
                </div>

                {/* PLAYBACK CONTROLS */}
                <div className="flex items-center gap-4">
                  {/* Edit Input Button */}
                  <button
                    onClick={() => setShowInputModal(true)}
                    className="p-1.5 rounded-lg border border-[rgba(0,173,181,0.15)] bg-[#393E46]/30 text-[rgba(238,238,238,0.65)] hover:text-[#00ADB5] hover:bg-[#393E46]/60 transition-all flex items-center gap-1.5 text-xs font-mono"
                    title="Change input values"
                  >
                    <Edit3 size={12} />
                    Edit Input
                  </button>

                  <div className="flex items-center gap-1 bg-[#393E46]/40 border border-white/5 p-1 rounded-lg">
                    {/* Reset */}
                    <button
                      onClick={handleStepReset}
                      className="p-1.5 rounded hover:bg-[#393E46] text-[rgba(238,238,238,0.65)] hover:text-[#EEEEEE] transition-all"
                      title="Reset execution"
                    >
                      <RotateCcw size={13} />
                    </button>

                    {/* Play/Pause */}
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 rounded hover:bg-[#393E46] text-[#00ADB5] transition-all"
                    >
                      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    </button>

                    {/* Step Forward */}
                    <button
                      onClick={handleStepForward}
                      disabled={isPlaying || currentStep >= steps.length - 1}
                      className="p-1.5 rounded hover:bg-[#393E46] disabled:opacity-30 disabled:hover:bg-transparent text-[rgba(238,238,238,0.65)] hover:text-[#EEEEEE] transition-all"
                    >
                      <SkipForward size={13} />
                    </button>
                  </div>

                  {/* Speed slider */}
                  <div className="flex items-center gap-2 bg-[#393E46]/40 border border-white/5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-[rgba(238,238,238,0.45)]">
                    <span>SPEED</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.5"
                      value={speed}
                      onChange={e => setSpeed(parseFloat(e.target.value))}
                      className="w-16 accent-[#00ADB5]"
                    />
                    <span className="w-8 text-right text-[#00ADB5] font-bold">{speed}x</span>
                  </div>
                </div>
              </div>

              {/* Progress bar below topbar */}
              <div className="h-0.5 bg-[#393E46]/30 relative w-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[#00ADB5] transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              {/* 2. CANVAS AREA */}
              <div
                ref={canvasContainerRef}
                className="flex-1 relative bg-[#222831] overflow-hidden"
              >
                {subDetailLoading || analysisLoading ? (
                  /* Loading Spinner */
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-[#00ADB5]/35 border-t-[#00ADB5] rounded-full animate-spin" />
                  </div>
                ) : (
                  /* Render selected Konva visualizer dynamically */
                  <>
                    {visualizerType === "ArrayVisualizer" && (
                      <ArrayVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "TreeVisualizer" && (
                      <TreeVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "GraphVisualizer" && (
                      <GraphVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "DPTableVisualizer" && (
                      <DPTableVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "StackQueueVisualizer" && (
                      <StackQueueVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "LinkedListVisualizer" && (
                      <LinkedListVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "StringVisualizer" && (
                      <StringVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                    {visualizerType === "HeapVisualizer" && (
                      <HeapVisualizer state={activeStepState} width={canvasSize.width} height={canvasSize.height} />
                    )}
                  </>
                )}
              </div>

              {/* Collapsible toggle bar for Bottom Drawer */}
              <div className="h-6 shrink-0 border-t border-[rgba(0,173,181,0.1)] flex items-center justify-center bg-[#222831]/80 hover:bg-[#393E46]/30 cursor-pointer select-none" onClick={() => setDrawerExpanded(!drawerExpanded)}>
                {drawerExpanded ? <ChevronDown size={14} className="text-[#00ADB5]" /> : <ChevronUp size={14} className="text-[#00ADB5]" />}
              </div>

              {/* 3. BOTTOM DRAWER */}
              <div
                className={`transition-all duration-300 ease-in-out border-t border-[rgba(0,173,181,0.15)] flex bg-[#393E46]/20 backdrop-blur-xl ${
                  drawerExpanded ? "h-[180px]" : "h-0 overflow-hidden"
                }`}
              >
                {/* Left Half: Step Logs */}
                <div className="w-1/2 border-r border-[rgba(0,173,181,0.12)] flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-2 bg-[#222831]/30 border-b border-[rgba(0,173,181,0.12)] flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest text-[rgba(238,238,238,0.45)]">STEP LOGS</span>
                    <span className="text-[10px] font-mono text-[#00ADB5]">Step {currentStep + 1} of {steps.length}</span>
                  </div>
                  
                  <div ref={logScrollRef} className="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col gap-1.5">
                    {steps.map((st, sIdx) => {
                      const isActive = sIdx === currentStep;
                      return (
                        <div
                          key={sIdx}
                          onClick={() => {
                            setCurrentStep(sIdx);
                            setIsPlaying(false);
                          }}
                          className={`active-log-line cursor-pointer flex gap-3 px-3 py-2 rounded-lg text-xs leading-relaxed transition-all duration-150 relative ${
                            isActive
                              ? "bg-[rgba(0,173,181,0.1)] text-[#EEEEEE] border-l-[3px] border-[#00ADB5]"
                              : "text-[rgba(238,238,238,0.55)] border-l-[3px] border-transparent hover:bg-white/[0.02]"
                          }`}
                        >
                          <span className="font-mono text-[10px] opacity-35 w-6 select-none">
                            {String(sIdx + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1 font-sans">{st.log}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Half: Pseudocode Panel */}
                <div className="w-1/2 flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-2 bg-[#222831]/30 border-b border-[rgba(0,173,181,0.12)]">
                    <span className="text-[10px] font-mono tracking-widest text-[rgba(238,238,238,0.45)]">PSEUDOCODE HIGH-FIDELITY</span>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-1 bg-[#222831]/10 font-mono text-[11px] leading-relaxed">
                    {pseudocodeLines.map((line, idx) => {
                      const isHighlighted = idx === activeCodeLine;
                      return (
                        <div
                          key={idx}
                          className={`px-3 py-1 rounded transition-all duration-150 ${
                            isHighlighted
                              ? "bg-[rgba(0,173,181,0.22)] border border-[rgba(0,173,181,0.35)] text-[#00ADB5] font-bold shadow-[0_0_8px_rgba(0,173,181,0.15)]"
                              : "text-[rgba(238,238,238,0.65)]"
                          }`}
                        >
                          <span className="opacity-30 inline-block w-4 mr-2">{idx + 1}</span>
                          <span className="whitespace-pre">{line}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── INLINE INPUT DIALOG ── */}
        <AnimatePresence>
          {showInputModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#222831]/80 backdrop-blur-sm">
              <motion.form
                onSubmit={handleInputSubmit}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#393E46] border border-[rgba(0,173,181,0.35)] rounded-2xl p-6 shadow-[0_0_30px_rgba(0,173,181,0.25)] flex flex-col gap-4"
              >
                <div>
                  <h3 className="text-sm font-bold font-display tracking-tight text-[#EEEEEE]">
                    Edit Simulation Input
                  </h3>
                  <p className="text-[11px] text-[rgba(238,238,238,0.45)] mt-1 font-mono uppercase tracking-wider">
                    {visualizerType} Pre-fill
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-[rgba(238,238,238,0.45)]">
                    {visualizerType === "ArrayVisualizer" && "Comma separated values, or 'values | target=X'"}
                    {visualizerType === "StringVisualizer" && "Single string for palindrome, or 's1 | s2' for LCS"}
                    {visualizerType === "TreeVisualizer" && "Comma separated values to insert in BST"}
                    {visualizerType === "GraphVisualizer" && "Valid JSON Adjacency specification"}
                    {visualizerType === "DPTableVisualizer" && "Format: weights=2,3 | values=3,4 | capacity=5"}
                    {visualizerType === "StackQueueVisualizer" && "Command sequence: push 10, enqueue 20, pop"}
                    {visualizerType === "LinkedListVisualizer" && "Comma separated string node list"}
                    {visualizerType === "HeapVisualizer" && "Comma separated array to build heap"}
                  </label>

                  {visualizerType === "GraphVisualizer" ? (
                    <textarea
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      rows={5}
                      className="w-full bg-[#222831]/50 border border-[rgba(0,173,181,0.18)] rounded-xl px-4 py-3 text-[12px] font-mono text-[#EEEEEE] focus:outline-none focus:ring-1 focus:ring-[#00ADB5] resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      className="w-full bg-[#222831]/50 border border-[rgba(0,173,181,0.18)] rounded-xl px-4 py-2.5 text-[12px] font-mono text-[#EEEEEE] focus:outline-none focus:ring-1 focus:ring-[#00ADB5]"
                    />
                  )}

                  {inputError && (
                    <span className="text-[10px] font-mono text-[#FF6B6B]">
                      {inputError}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowInputModal(false)}
                    className="px-4 py-2 text-xs font-mono text-[rgba(238,238,238,0.55)] hover:text-[#EEEEEE] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00ADB5] text-white rounded-lg text-xs font-mono font-bold shadow-[0_0_12px_rgba(0,173,181,0.35)] hover:opacity-90 transition-all"
                  >
                    Apply Input
                  </button>
                </div>
              </motion.form>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
