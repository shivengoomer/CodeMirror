import { Suspense } from "react";
import VisualizePage from "./VisualizePage";

export const metadata = {
  title: "LeetCode Submission Visualizer | CodeMirror",
  description: "Visualize DSA submissions step-by-step with interactive Konva.js canvas.",
};

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 bg-[#222831] text-[#EEEEEE]">
        <div className="w-6 h-6 rounded-full border-2 border-[#00ADB5]/35 border-t-[#00ADB5] animate-spin" />
        <span className="text-xs font-mono text-white/50 animate-pulse">Loading Visualizer...</span>
      </div>
    }>
      <VisualizePage />
    </Suspense>
  );
}
