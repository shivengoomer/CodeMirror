import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { AnalyzeResponse } from "@/types/api";

export function useSubmissionAnalysis() {
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyzeLatest();
      setAnalysis(result);
      return result;
    } catch (e: any) {
      setError(e.message || "Analysis failed.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { analysis, loading, error, analyze };
}
