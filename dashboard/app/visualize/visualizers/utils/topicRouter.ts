export type VisualizerType =
  | "TreeVisualizer"
  | "GraphVisualizer"
  | "DPTableVisualizer"
  | "ArrayVisualizer"
  | "StringVisualizer"
  | "StackQueueVisualizer"
  | "LinkedListVisualizer"
  | "HeapVisualizer";

export function routeTopic(tags: (string | { name: string; slug: string })[]): VisualizerType {
  if (!tags || tags.length === 0) return "ArrayVisualizer";

  const normalizedTags = tags.map(t => {
    if (typeof t === "string") return t.toLowerCase().trim();
    if (t && typeof t === "object") {
      return (t.name || t.slug || "").toLowerCase().trim();
    }
    return "";
  });

  const check = (keys: string[]) => normalizedTags.some(tag => keys.some(k => tag.includes(k) || k.includes(tag)));

  if (check(["binary-search-tree", "binary-tree", "tree"])) {
    return "TreeVisualizer";
  }
  if (check(["graph", "bfs", "dfs", "shortest-path", "topological", "union-find"])) {
    return "GraphVisualizer";
  }
  if (check(["dynamic-programming", "dp", "memoization", "knapsack", "lcs"])) {
    return "DPTableVisualizer";
  }
  if (check(["stack", "queue", "monotonic-stack"])) {
    return "StackQueueVisualizer";
  }
  if (check(["linked-list"])) {
    return "LinkedListVisualizer";
  }
  if (check(["heap", "priority-queue"])) {
    return "HeapVisualizer";
  }
  if (check(["string", "substring", "palindrome", "anagram"])) {
    return "StringVisualizer";
  }
  if (check(["array", "sorting", "two-pointers", "sliding-window", "binary-search", "prefix-sum", "divide-and-conquer"])) {
    return "ArrayVisualizer";
  }

  return "ArrayVisualizer";
}
