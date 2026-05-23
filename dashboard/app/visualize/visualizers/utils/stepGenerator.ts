import { VisualizerType } from "./topicRouter";
import { computeTreeLayout, TreeNodeData } from "./treeLayout";

export interface TraceStep {
  state: any;
  log: string;
  codeLine: number;
}

/**
 * Parses user input or returns a default based on the visualizer type.
 */
export function parseInput(input: string, type: VisualizerType): any {
  const trimmed = input.trim();
  if (!trimmed) return getDefaultInput(type);

  try {
    switch (type) {
      case "ArrayVisualizer": {
        if (trimmed.includes("|")) {
          // e.g. "2,3,5,6,8,9,10 | target=9"
          const parts = trimmed.split("|");
          const arr = parts[0].split(",").map(n => parseFloat(n.trim()));
          const targetPart = parts[1].toLowerCase();
          const target = parseFloat(targetPart.replace(/target\s*=\s*/g, "").trim());
          return { array: arr, target: isNaN(target) ? 9 : target, isBinarySearch: true };
        }
        // e.g. "8,5,2,9,6,3"
        return { array: trimmed.split(",").map(n => parseFloat(n.trim())), isBinarySearch: false };
      }
      case "StringVisualizer": {
        if (trimmed.includes("|")) {
          const parts = trimmed.split("|").map(s => s.trim());
          return { s1: parts[0], s2: parts[1], isCompare: true };
        }
        return { s: trimmed, isCompare: false };
      }
      case "TreeVisualizer": {
        return trimmed.split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      }
      case "GraphVisualizer": {
        return JSON.parse(trimmed);
      }
      case "DPTableVisualizer": {
        // e.g. "weights=2,3,4 | values=3,4,5 | capacity=5"
        const parts = trimmed.split("|");
        let weights: number[] = [2, 3, 4, 5];
        let values: number[] = [3, 4, 5, 6];
        let capacity = 5;
        parts.forEach(p => {
          const [k, v] = p.split("=");
          if (k && v) {
            const key = k.trim().toLowerCase();
            if (key === "weights") weights = v.split(",").map(n => parseInt(n.trim(), 10));
            else if (key === "values") values = v.split(",").map(n => parseInt(n.trim(), 10));
            else if (key === "capacity") capacity = parseInt(v.trim(), 10);
          }
        });
        return { weights, values, capacity };
      }
      case "StackQueueVisualizer": {
        return trimmed.split(",").map(s => s.trim());
      }
      case "LinkedListVisualizer": {
        return trimmed.split(",").map(s => s.trim());
      }
      case "HeapVisualizer": {
        return trimmed.split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      }
    }
  } catch (err) {
    console.error("Input parse error, falling back to default.", err);
  }
  return getDefaultInput(type);
}

export function getDefaultInput(type: VisualizerType): any {
  switch (type) {
    case "ArrayVisualizer":
      return { array: [8, 5, 2, 9, 5, 6, 3], isBinarySearch: false };
    case "StringVisualizer":
      return { s: "racecar", isCompare: false };
    case "TreeVisualizer":
      return [8, 3, 10, 1, 6, 14, 4, 7, 13];
    case "GraphVisualizer":
      return {
        nodes: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }, { id: "F" }],
        edges: [
          { from: "A", to: "B", weight: 4 },
          { from: "A", to: "C", weight: 2 },
          { from: "B", to: "D", weight: 5 },
          { from: "C", to: "D", weight: 8 },
          { from: "C", to: "E", weight: 10 },
          { from: "D", to: "F", weight: 3 },
          { from: "E", to: "F", weight: 4 }
        ],
        directed: false
      };
    case "DPTableVisualizer":
      return { weights: [2, 3, 4, 5], values: [3, 4, 5, 6], capacity: 5 };
    case "StackQueueVisualizer":
      return ["push 10", "push 20", "pop", "push 30", "push 45", "pop", "pop"];
    case "LinkedListVisualizer":
      return ["10", "20", "30", "40"];
    case "HeapVisualizer":
      return [8, 5, 2, 9, 5, 6, 3];
  }
}

export function getDefaultInputString(type: VisualizerType): string {
  switch (type) {
    case "ArrayVisualizer":
      return "8, 5, 2, 9, 5, 6, 3";
    case "StringVisualizer":
      return "racecar";
    case "TreeVisualizer":
      return "8, 3, 10, 1, 6, 14, 4, 7, 13";
    case "GraphVisualizer":
      return JSON.stringify({
        nodes: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }, { id: "F" }],
        edges: [
          { from: "A", to: "B", weight: 4 },
          { from: "A", to: "C", weight: 2 },
          { from: "B", to: "D", weight: 5 },
          { from: "C", to: "D", weight: 8 },
          { from: "C", to: "E", weight: 10 },
          { from: "D", to: "F", weight: 3 },
          { from: "E", to: "F", weight: 4 }
        ],
        directed: false
      }, null, 2);
    case "DPTableVisualizer":
      return "weights=2,3,4,5 | values=3,4,5,6 | capacity=5";
    case "StackQueueVisualizer":
      return "push 10, push 20, pop, push 30, push 45, pop, pop";
    case "LinkedListVisualizer":
      return "10, 20, 30, 40";
    case "HeapVisualizer":
      return "8, 5, 2, 9, 5, 6, 3";
  }
}

export function getPseudocode(type: VisualizerType, subType?: string): string[] {
  switch (type) {
    case "ArrayVisualizer":
      if (subType === "binary-search") {
        return [
          "low = 0, high = n - 1",
          "while low <= high:",
          "  mid = (low + high) // 2",
          "  if arr[mid] == target: return mid",
          "  else if arr[mid] < target: low = mid + 1",
          "  else: high = mid - 1",
          "return -1"
        ];
      }
      return [
        "for i = 0 to n - 1:",
        "  for j = 0 to n - i - 1:",
        "    if arr[j] > arr[j+1]:",
        "      swap(arr[j], arr[j+1])",
        "  mark arr[n-1-i] as sorted"
      ];
    case "StringVisualizer":
      if (subType === "compare") {
        return [
          "for i = 0 to len(s1) - 1:",
          "  for j = 0 to len(s2) - 1:",
          "    if s1[i] == s2[j]: match++",
          "    else: mismatch++"
        ];
      }
      return [
        "left = 0, right = len(s) - 1",
        "while left < right:",
        "  if s[left] != s[right]: return false",
        "  left++, right--",
        "return true"
      ];
    case "TreeVisualizer":
      return [
        "insert(node, val):",
        "  if node is null: return Node(val)",
        "  if val < node.val:",
        "    node.left = insert(node.left, val)",
        "  else:",
        "    node.right = insert(node.right, val)",
        "  return node"
      ];
    case "GraphVisualizer":
      return [
        "BFS(start):",
        "  queue = [start], visited = {start}",
        "  while queue is not empty:",
        "    curr = queue.dequeue()",
        "    for each neighbor in adj[curr]:",
        "      if neighbor not in visited:",
        "        visited.add(neighbor), queue.enqueue(neighbor)"
      ];
    case "DPTableVisualizer":
      return [
        "dp = (n+1) x (W+1) grid filled with 0",
        "for i = 1 to n:",
        "  for w = 1 to W:",
        "    if wt[i-1] <= w:",
        "      dp[i][w] = max(dp[i-1][w], val[i-1] + dp[i-1][w-wt[i-1]])",
        "    else: dp[i][w] = dp[i-1][w]",
        "traceback optimal items"
      ];
    case "StackQueueVisualizer":
      return [
        "Stack / Queue Operations:",
        "  PUSH/ENQUEUE: append to structure",
        "  POP/DEQUEUE: remove top/front element",
        "  update top / front / rear pointers"
      ];
    case "LinkedListVisualizer":
      return [
        "traverse(head):",
        "  curr = head",
        "  while curr is not null:",
        "    process curr.val",
        "    curr = curr.next"
      ];
    case "HeapVisualizer":
      return [
        "heapify(arr, i):",
        "  largest = i, left = 2*i + 1, right = 2*i + 2",
        "  if left < n and arr[left] > arr[largest]: largest = left",
        "  if right < n and arr[right] > arr[largest]: largest = right",
        "  if largest != i:",
        "    swap(arr[i], arr[largest])",
        "    heapify(arr, largest)"
      ];
  }
}

/**
 * Generates visualization steps based on the visualizer type and parsed input.
 */
export function generateSteps(type: VisualizerType, parsed: any): TraceStep[] {
  const steps: TraceStep[] = [];

  switch (type) {
    case "ArrayVisualizer": {
      if (parsed.isBinarySearch) {
        const arr = [...parsed.array].sort((a, b) => a - b);
        const target = parsed.target;
        let low = 0;
        let high = arr.length - 1;

        steps.push({
          state: { array: [...arr], low, high, mid: -1, status: "default" },
          log: `Initialize low = 0, high = ${high} on sorted array. Target = ${target}`,
          codeLine: 0
        });

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          steps.push({
            state: { array: [...arr], low, high, mid, status: "comparing" },
            log: `Check condition low (${low}) <= high (${high}). Calculate mid = ${mid}. arr[mid] = ${arr[mid]}`,
            codeLine: 2
          });

          if (arr[mid] === target) {
            steps.push({
              state: { array: [...arr], low, high, mid, status: "found" },
              log: `Found target ${target} at index ${mid}!`,
              codeLine: 3
            });
            break;
          } else if (arr[mid] < target) {
            const oldLow = low;
            low = mid + 1;
            steps.push({
              state: { array: [...arr], low, high, mid, status: "left-eliminated" },
              log: `Since arr[mid]=${arr[mid]} < target=${target}, eliminate left half. Set low = mid + 1 = ${low}`,
              codeLine: 4
            });
          } else {
            const oldHigh = high;
            high = mid - 1;
            steps.push({
              state: { array: [...arr], low, high, mid, status: "right-eliminated" },
              log: `Since arr[mid]=${arr[mid]} > target=${target}, eliminate right half. Set high = mid - 1 = ${high}`,
              codeLine: 5
            });
          }
        }

        if (low > high) {
          steps.push({
            state: { array: [...arr], low, high, mid: -1, status: "not-found" },
            log: `Search concluded. Target ${target} not found in the array.`,
            codeLine: 6
          });
        }
      } else {
        // Bubble Sort
        const arr = [...parsed.array];
        const n = arr.length;
        steps.push({
          state: { array: [...arr], i: -1, j: -1, comparing: [], sorted: [] },
          log: `Starting Bubble Sort on array of size ${n}.`,
          codeLine: 0
        });

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n - i - 1; j++) {
            steps.push({
              state: { array: [...arr], i, j, comparing: [j, j + 1], sorted: Array.from({ length: i }, (_, k) => n - 1 - k) },
              log: `Compare arr[j]=${arr[j]} with arr[j+1]=${arr[j + 1]}`,
              codeLine: 2
            });

            if (arr[j] > arr[j + 1]) {
              const tmp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = tmp;
              steps.push({
                state: { array: [...arr], i, j, comparing: [j, j + 1], sorted: Array.from({ length: i }, (_, k) => n - 1 - k) },
                log: `Swap elements at index ${j} and ${j + 1}: ${arr[j + 1]} > ${arr[j]}`,
                codeLine: 3
              });
            }
          }
          steps.push({
            state: { array: [...arr], i, j: -1, comparing: [], sorted: Array.from({ length: i + 1 }, (_, k) => n - 1 - k) },
            log: `Element at index ${n - 1 - i} (${arr[n - 1 - i]}) is fully sorted.`,
            codeLine: 4
          });
        }

        steps.push({
          state: { array: [...arr], i: n, j: -1, comparing: [], sorted: Array.from({ length: n }, (_, k) => k) },
          log: `Sorting completed successfully!`,
          codeLine: 4
        });
      }
      break;
    }
    case "StringVisualizer": {
      if (parsed.isCompare) {
        const s1 = parsed.s1;
        const s2 = parsed.s2;
        steps.push({
          state: { s1, s2, i: 0, j: 0, matches: [], mismatches: [] },
          log: `Compare characters between s1: "${s1}" and s2: "${s2}"`,
          codeLine: 0
        });

        for (let i = 0; i < s1.length; i++) {
          for (let j = 0; j < s2.length; j++) {
            const isMatch = s1[i] === s2[j];
            steps.push({
              state: {
                s1, s2, i, j,
                matches: isMatch ? [[i, j]] : [],
                mismatches: !isMatch ? [[i, j]] : []
              },
              log: `Comparing s1[${i}]='${s1[i]}' with s2[${j}]='${s2[j]}': ${isMatch ? "MATCH!" : "MISMATCH."}`,
              codeLine: 2
            });
          }
        }
      } else {
        const s = parsed.s;
        let left = 0;
        let right = s.length - 1;
        steps.push({
          state: { s, left, right, comparing: [left, right], status: "default" },
          log: `Checking if word "${s}" is palindrome. Left pointer = 0, Right pointer = ${right}`,
          codeLine: 0
        });

        let isPal = true;
        while (left < right) {
          const match = s[left] === s[right];
          if (!match) {
            isPal = false;
            steps.push({
              state: { s, left, right, comparing: [left, right], status: "mismatch" },
              log: `Mismatch detected: s[${left}]='${s[left]}' !== s[${right}]='${s[right]}'. Not a palindrome!`,
              codeLine: 2
            });
            break;
          }

          steps.push({
            state: { s, left, right, comparing: [left, right], status: "match" },
            log: `Match: s[${left}]='${s[left]}' === s[${right}]='${s[right]}'`,
            codeLine: 2
          });

          left++;
          right--;
          steps.push({
            state: { s, left, right, comparing: [left, right], status: "default" },
            log: `Move pointers inward. Left = ${left}, Right = ${right}`,
            codeLine: 3
          });
        }

        if (isPal) {
          steps.push({
            state: { s, left, right, comparing: [], status: "success" },
            log: `Checked all matching characters. "${s}" is a valid palindrome!`,
            codeLine: 4
          });
        }
      }
      break;
    }
    case "TreeVisualizer": {
      const nums = parsed;
      let root: TreeNodeData | null = null;
      let nodeCounter = 1;

      steps.push({
        state: { tree: null, currentVal: null, traversalPath: [], activeNodeId: null },
        log: "Initialize an empty binary search tree.",
        codeLine: 0
      });

      for (let num of nums) {
        steps.push({
          state: { tree: root ? JSON.parse(JSON.stringify(root)) : null, currentVal: num, traversalPath: [], activeNodeId: null },
          log: `Request to insert node with value ${num}`,
          codeLine: 1
        });

        if (!root) {
          root = { id: nodeCounter++, val: num, left: null, right: null };
          steps.push({
            state: { tree: JSON.parse(JSON.stringify(root)), currentVal: num, traversalPath: [root.id], activeNodeId: root.id },
            log: `Tree is empty. Insert value ${num} as the root node.`,
            codeLine: 2
          });
          continue;
        }

        let curr: TreeNodeData | null = root;
        const path: (string | number)[] = [];
        
        while (curr) {
          path.push(curr.id);
          steps.push({
            state: { tree: JSON.parse(JSON.stringify(root)), currentVal: num, traversalPath: [...path], activeNodeId: curr.id },
            log: `Comparing value ${num} with node ${curr.val}`,
            codeLine: 2
          });

          if (num < (curr.val as number)) {
            if (!curr.left) {
              curr.left = { id: nodeCounter++, val: num, left: null, right: null };
              path.push(curr.left.id);
              steps.push({
                state: { tree: JSON.parse(JSON.stringify(root)), currentVal: num, traversalPath: [...path], activeNodeId: curr.left.id },
                log: `${num} < ${curr.val}. Left branch is empty. Inserted ${num} here.`,
                codeLine: 4
              });
              break;
            } else {
              curr = curr.left;
            }
          } else {
            if (!curr.right) {
              curr.right = { id: nodeCounter++, val: num, left: null, right: null };
              path.push(curr.right.id);
              steps.push({
                state: { tree: JSON.parse(JSON.stringify(root)), currentVal: num, traversalPath: [...path], activeNodeId: curr.right.id },
                log: `${num} >= ${curr.val}. Right branch is empty. Inserted ${num} here.`,
                codeLine: 6
              });
              break;
            } else {
              curr = curr.right;
            }
          }
        }
      }
      break;
    }
    case "GraphVisualizer": {
      const graph = parsed;
      const nodes = graph.nodes || [];
      const edges = graph.edges || [];
      const start = nodes[0]?.id || "A";

      // Adjacency list representation
      const adj: Record<string, string[]> = {};
      nodes.forEach((n: any) => {
        adj[n.id] = [];
      });
      edges.forEach((e: any) => {
        adj[e.from].push(e.to);
        if (!graph.directed) {
          adj[e.to].push(e.from);
        }
      });

      const visited = new Set<string>();
      const queue: string[] = [start];
      visited.add(start);

      steps.push({
        state: { nodes, edges, queue: [...queue], visited: Array.from(visited), activeNodeId: null, adj },
        log: `Initialize BFS from starting node "${start}". Enqueue and mark as visited.`,
        codeLine: 1
      });

      while (queue.length > 0) {
        const curr = queue.shift()!;
        steps.push({
          state: { nodes, edges, queue: [...queue], visited: Array.from(visited), activeNodeId: curr, adj },
          log: `Dequeue node "${curr}" to visit neighbors.`,
          codeLine: 3
        });

        const neighbors = adj[curr] || [];
        for (let neighbor of neighbors) {
          const isVisited = visited.has(neighbor);
          if (!isVisited) {
            visited.add(neighbor);
            queue.push(neighbor);
            steps.push({
              state: { nodes, edges, queue: [...queue], visited: Array.from(visited), activeNodeId: curr, checkingNeighbor: neighbor, adj },
              log: `Neighbor "${neighbor}" is unvisited. Enqueue and mark it visited.`,
              codeLine: 6
            });
          } else {
            steps.push({
              state: { nodes, edges, queue: [...queue], visited: Array.from(visited), activeNodeId: curr, checkingNeighbor: neighbor, adj },
              log: `Neighbor "${neighbor}" is already visited. Skip.`,
              codeLine: 6
            });
          }
        }
      }

      steps.push({
        state: { nodes, edges, queue: [], visited: Array.from(visited), activeNodeId: null, adj },
        log: `BFS completed! Traversed all accessible nodes.`,
        codeLine: 6
      });
      break;
    }
    case "DPTableVisualizer": {
      const { weights, values, capacity } = parsed;
      const n = weights.length;
      const dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

      steps.push({
        state: { dp: dp.map(row => [...row]), currentI: 0, currentW: 0, formula: "", activeCell: null, weights, values, capacity },
        log: `Initialize ${n + 1}x${capacity + 1} DP table filled with 0s.`,
        codeLine: 0
      });

      for (let i = 1; i <= n; i++) {
        for (let w = 1; w <= capacity; w++) {
          const itemWeight = weights[i - 1];
          const itemValue = values[i - 1];

          if (itemWeight <= w) {
            const exclude = dp[i - 1][w];
            const include = itemValue + dp[i - 1][w - itemWeight];
            dp[i][w] = Math.max(exclude, include);
            steps.push({
              state: {
                dp: dp.map(row => [...row]),
                currentI: i,
                currentW: w,
                formula: `dp[${i}][${w}] = max(exclude: dp[${i - 1}][${w}] (${exclude}), include: val + dp[${i - 1}][${w - itemWeight}] (${include})) = ${dp[i][w]}`,
                activeCell: { r: i, c: w },
                weights,
                values,
                capacity
              },
              log: `Evaluating item ${i} (wt=${itemWeight}, val=${itemValue}) at sub-capacity ${w}. Fits! Compare including vs excluding.`,
              codeLine: 4
            });
          } else {
            dp[i][w] = dp[i - 1][w];
            steps.push({
              state: {
                dp: dp.map(row => [...row]),
                currentI: i,
                currentW: w,
                formula: `dp[${i}][${w}] = dp[${i - 1}][${w}] (${dp[i][w]})`,
                activeCell: { r: i, c: w },
                weights,
                values,
                capacity
              },
              log: `Item ${i} (wt=${itemWeight}) exceeds capacity limit ${w}. Copy from previous row.`,
              codeLine: 5
            });
          }
        }
      }

      // Traceback path
      const traceback: { r: number; c: number }[] = [];
      let res = dp[n][capacity];
      let wRemaining = capacity;
      for (let i = n; i > 0 && res > 0; i--) {
        if (res !== dp[i - 1][wRemaining]) {
          traceback.push({ r: i, c: wRemaining });
          res -= values[i - 1];
          wRemaining -= weights[i - 1];
        }
      }

      steps.push({
        state: {
          dp: dp.map(row => [...row]),
          currentI: n,
          currentW: capacity,
          formula: `Optimal solution = ${dp[n][capacity]}`,
          activeCell: null,
          traceback,
          weights,
          values,
          capacity
        },
        log: `Computation completed. Max value: ${dp[n][capacity]}. Backtracked items index: ${traceback.map(t => t.r).join(", ")}`,
        codeLine: 6
      });
      break;
    }
    case "StackQueueVisualizer": {
      const ops = parsed;
      const list: any[] = [];
      
      steps.push({
        state: { list: [], pointer: -1, activeOp: "START" },
        log: "Initialize empty data structure.",
        codeLine: 0
      });

      ops.forEach((op: string) => {
        const parts = op.toLowerCase().split(/\s+/);
        const cmd = parts[0];
        const val = parts[1];

        if (cmd === "push" || cmd === "enqueue") {
          list.push(val);
          steps.push({
            state: { list: [...list], pointer: list.length - 1, activeOp: `${cmd.toUpperCase()} ${val}` },
            log: `${cmd.toUpperCase()} value "${val}"`,
            codeLine: 1
          });
        } else if (cmd === "pop" || cmd === "dequeue") {
          if (list.length === 0) {
            steps.push({
              state: { list: [], pointer: -1, activeOp: "UNDERFLOW" },
              log: `Underflow: Cannot pop from an empty structure.`,
              codeLine: 2
            });
          } else {
            const popped = cmd === "pop" ? list.pop() : list.shift();
            steps.push({
              state: { list: [...list], pointer: list.length - 1, activeOp: `${cmd.toUpperCase()} -> ${popped}` },
              log: `Removed top/front element "${popped}" via ${cmd.toUpperCase()}`,
              codeLine: 2
            });
          }
        }
      });
      break;
    }
    case "LinkedListVisualizer": {
      const values = parsed;
      const list = [...values];
      
      steps.push({
        state: { list: [], activeIndex: -1, pointer: "HEAD" },
        log: "Initialize empty Linked List.",
        codeLine: 0
      });

      const currentList: string[] = [];
      for (let i = 0; i < list.length; i++) {
        currentList.push(list[i]);
        steps.push({
          state: { list: [...currentList], activeIndex: i, pointer: "INSERT" },
          log: `Insert node with value ${list[i]} at the end of the list.`,
          codeLine: 4
        });
      }

      steps.push({
        state: { list: [...currentList], activeIndex: -1, pointer: "DONE" },
        log: `Finished building list. HEAD is at index 0, TAIL is at index ${list.length - 1}.`,
        codeLine: 5
      });
      break;
    }
    case "HeapVisualizer": {
      const arr = [...parsed];
      steps.push({
        state: { array: [...arr], activeSwap: null, comparing: [], n: arr.length },
        log: "Initialize binary heap tree from array.",
        codeLine: 0
      });

      const n = arr.length;
      
      // Simple build-max-heap simulator
      const buildHeapArr = [...arr];
      for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        // Heapify step simulator
        let largest = i;
        let left = 2 * i + 1;
        let right = 2 * i + 2;

        steps.push({
          state: { array: [...buildHeapArr], activeSwap: null, comparing: [i], n },
          log: `Heapifying index ${i} (val = ${buildHeapArr[i]})`,
          codeLine: 1
        });

        if (left < n && buildHeapArr[left] > buildHeapArr[largest]) {
          largest = left;
        }
        if (right < n && buildHeapArr[right] > buildHeapArr[largest]) {
          largest = right;
        }

        if (largest !== i) {
          steps.push({
            state: { array: [...buildHeapArr], activeSwap: [i, largest], comparing: [i, largest], n },
            log: `Index ${largest} (val = ${buildHeapArr[largest]}) is larger. Swap with parent index ${i}.`,
            codeLine: 5
          });
          const temp = buildHeapArr[i];
          buildHeapArr[i] = buildHeapArr[largest];
          buildHeapArr[largest] = temp;
          steps.push({
            state: { array: [...buildHeapArr], activeSwap: null, comparing: [], n },
            log: `Swap complete.`,
            codeLine: 6
          });
        }
      }

      steps.push({
        state: { array: [...buildHeapArr], activeSwap: null, comparing: [], n },
        log: "Max Heap structure built successfully!",
        codeLine: 6
      });
      break;
    }
  }

  // Fallback step if empty
  if (steps.length === 0) {
    steps.push({
      state: {},
      log: "No execution steps generated.",
      codeLine: 0
    });
  }

  return steps;
}
