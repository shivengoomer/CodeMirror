"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Sliders,
  Cpu,
  Terminal,
  ChevronRight,
  Info,
  Sparkles,
  Brain,
  Code2,
  AlertTriangle,
  Search,
  LayoutGrid
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Type Definitions for Stepper & Tracer
   ───────────────────────────────────────────────────────────────────────────── */
interface StepState {
  array?: number[];
  pointers?: Record<string, any>;
  comparing?: number[];
  sorted?: number[];
  pivot?: number;
  highlightedLines?: number[];
  explanation: string;
  // Specific structures
  stack?: any[];
  queue?: any[];
  treeNodes?: any[];
  treeEdges?: any[];
  graphNodes?: any[];
  dpTable?: any[][];
  pegs?: Record<string, number[]>;
  customVisualData?: any;
}

interface AlgorithmInfo {
  id: string;
  name: string;
  category: string;
  complexity: string;
  defaultInput: string;
  pseudocode: string[];
}

const ALGORITHMS: AlgorithmInfo[] = [
  {
    id: "bubble-sort",
    name: "Bubble Sort",
    category: "Sorting",
    complexity: "O(n²)",
    defaultInput: "8, 5, 2, 9, 5, 6, 3",
    pseudocode: [
      "for i = 0 to n - 1:",
      "  for j = 0 to n - i - 1:",
      "    if arr[j] > arr[j+1]:",
      "      swap(arr[j], arr[j+1])",
      "    else:",
      "      do nothing",
      "  mark arr[n - 1 - i] as sorted",
      "end sorted"
    ],
  },
  {
    id: "binary-search",
    name: "Binary Search",
    category: "Searching",
    complexity: "O(log n)",
    defaultInput: "2, 3, 5, 6, 8, 9, 10, 11 | target=9",
    pseudocode: [
      "low = 0, high = n - 1",
      "while low <= high:",
      "  mid = (low + high) / 2",
      "  if arr[mid] == target:",
      "    return mid",
      "  else if arr[mid] < target:",
      "    low = mid + 1",
      "  else:",
      "    high = mid - 1",
      "return -1"
    ],
  },
  {
    id: "stack",
    name: "Stack Operations",
    category: "Data Structures",
    complexity: "O(1)",
    defaultInput: "push 10, push 20, pop, push 30, push 45, pop, pop",
    pseudocode: [
      "Stack s = empty",
      "push(val):",
      "  s.top = val",
      "pop():",
      "  popped = s.top",
      "  return popped"
    ],
  },
  {
    id: "bst",
    name: "BST Insertion",
    category: "Trees",
    complexity: "O(log n)",
    defaultInput: "8, 3, 10, 1, 6, 14, 4, 7, 13",
    pseudocode: [
      "BST root = empty",
      "insert(val):",
      "  if root is empty:",
      "    root = Node(val)",
      "  curr = root",
      "  while curr:",
      "    if val < curr.val:",
      "      if curr.left is empty:",
      "        curr.left = Node(val)",
      "      curr = curr.left",
      "    else:",
      "      if curr.right is empty:",
      "        curr.right = Node(val)",
      "      curr = curr.right"
    ],
  },
  {
    id: "bfs",
    name: "Graph BFS",
    category: "Graphs",
    complexity: "O(V + E)",
    defaultInput: "A-B, A-C, B-D, C-D, C-E, D-F, E-F",
    pseudocode: [
      "mark A as visited, enqueue A",
      "while queue is not empty:",
      "  curr = dequeue()",
      "  for each neighbor of curr:",
      "    if neighbor is not visited:",
      "      mark neighbor as visited",
      "      enqueue neighbor"
    ],
  },
  {
    id: "knapsack",
    name: "0/1 Knapsack",
    category: "Dynamic Programming",
    complexity: "O(n * W)",
    defaultInput: "weights=2,3,4,5 | values=3,4,5,6 | capacity=5",
    pseudocode: [
      "dp = matrix (n+1) x (capacity+1) with 0",
      "for i = 1 to n:",
      "  for w = 0 to capacity:",
      "    if weights[i-1] <= w:",
      "      dp[i][w] = max(dp[i-1][w], dp[i-1][w-w_i] + val_i)",
      "    else:",
      "      dp[i][w] = dp[i-1][w]"
    ],
  },
  {
    id: "hanoi",
    name: "Tower of Hanoi",
    category: "Recursion",
    complexity: "O(2ⁿ)",
    defaultInput: "disks=3",
    pseudocode: [
      "hanoi(n, from, to, aux):",
      "  if n == 1:",
      "    move disk from from to to",
      "    return",
      "  hanoi(n - 1, from, aux, to)",
      "  move disk from from to to",
      "  hanoi(n - 1, aux, to, from)"
    ],
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   DSA Visualizer Generators
   ───────────────────────────────────────────────────────────────────────────── */

function* bubbleSortGenerator(nums: number[]): Generator<StepState, void, unknown> {
  let arr = [...nums];
  let n = arr.length;
  yield {
    array: [...arr],
    explanation: "Starting Bubble Sort. The list will be sorted in ascending order.",
    comparing: [],
    sorted: [],
    highlightedLines: [0],
  };

  for (let i = 0; i < n - 1; i++) {
    yield {
      array: [...arr],
      explanation: `Pass ${i + 1}: Bubble the largest element of current subsegment to the end.`,
      comparing: [],
      sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
      highlightedLines: [1],
    };
    for (let j = 0; j < n - i - 1; j++) {
      yield {
        array: [...arr],
        explanation: `Comparing indices ${j} (${arr[j]}) and ${j + 1} (${arr[j + 1]}).`,
        comparing: [j, j + 1],
        sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
        highlightedLines: [2],
      };
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
        yield {
          array: [...arr],
          explanation: `Since ${temp} > ${arr[j]}, swap them.`,
          comparing: [j, j + 1],
          sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
          highlightedLines: [3],
        };
      } else {
        yield {
          array: [...arr],
          explanation: `Since ${arr[j]} <= ${arr[j + 1]}, no swap is needed.`,
          comparing: [j, j + 1],
          sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
          highlightedLines: [4],
        };
      }
    }
    yield {
      array: [...arr],
      explanation: `Index ${n - 1 - i} (${arr[n - 1 - i]}) is now fully sorted.`,
      comparing: [],
      sorted: Array.from({ length: i + 1 }, (_, k) => n - 1 - k),
      highlightedLines: [6],
    };
  }
  yield {
    array: [...arr],
    explanation: "Array is fully sorted!",
    comparing: [],
    sorted: Array.from({ length: n }, (_, k) => k),
    highlightedLines: [7],
  };
}

function* binarySearchGenerator(nums: number[], target: number): Generator<StepState, void, unknown> {
  let arr = [...nums].sort((a, b) => a - b);
  let low = 0;
  let high = arr.length - 1;
  yield {
    array: [...arr],
    pointers: { low, high },
    explanation: `Starting binary search for target = ${target}. Low pointer = 0, High pointer = ${high}.`,
    highlightedLines: [0],
  };

  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    yield {
      array: [...arr],
      pointers: { low, high, mid },
      explanation: `Condition check low (${low}) <= high (${high}) is true. Calculating mid = (low + high) / 2 = index ${mid}.`,
      highlightedLines: [2],
    };

    let val = arr[mid];
    yield {
      array: [...arr],
      pointers: { low, high, mid },
      comparing: [mid],
      explanation: `Compare arr[mid] (${val}) with target (${target}).`,
      highlightedLines: [3],
    };

    if (val === target) {
      yield {
        array: [...arr],
        pointers: { low, high, mid },
        sorted: [mid],
        explanation: `Target found at mid index ${mid}! Returning index.`,
        highlightedLines: [4],
      };
      return;
    } else if (val < target) {
      low = mid + 1;
      yield {
        array: [...arr],
        pointers: { low, high, mid },
        explanation: `Since ${val} < ${target}, target must lie in the right sub-array. Set Low = mid + 1 = index ${low}.`,
        highlightedLines: [6],
      };
    } else {
      high = mid - 1;
      yield {
        array: [...arr],
        pointers: { low, high, mid },
        explanation: `Since ${val} > ${target}, target must lie in the left sub-array. Set High = mid - 1 = index ${high}.`,
        highlightedLines: [8],
      };
    }
  }

  yield {
    array: [...arr],
    pointers: {},
    explanation: `Low has crossed High. Target ${target} was not found in the array. Returning -1.`,
    highlightedLines: [9],
  };
}

function* stackGenerator(operations: string[]): Generator<StepState, void, unknown> {
  let stack: any[] = [];
  yield {
    stack: [],
    explanation: "Initialize an empty stack.",
    highlightedLines: [0],
  };

  for (let op of operations) {
    let parts = op.trim().split(/\s+/);
    let cmd = parts[0].toLowerCase();
    let val = parts[1];

    if (cmd === "push") {
      stack.push(val);
      yield {
        stack: [...stack],
        pointers: { top: stack.length - 1 },
        explanation: `Pushing element "${val}" onto stack.`,
        highlightedLines: [2],
      };
    } else if (cmd === "pop") {
      if (stack.length === 0) {
        yield {
          stack: [],
          explanation: "Underflow: Cannot pop from an empty stack.",
          highlightedLines: [3],
        };
      } else {
        let popped = stack.pop();
        yield {
          stack: [...stack],
          pointers: stack.length > 0 ? { top: stack.length - 1 } : {},
          explanation: `Popping top element "${popped}" from the stack.`,
          highlightedLines: [4],
        };
      }
    }
  }
}

interface TreeNode {
  id: number;
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

function* bstInsertGenerator(nums: number[]): Generator<StepState, void, unknown> {
  let root: TreeNode | null = null;
  let nextNodeId = 1;

  function getTreeList(node: TreeNode | null, x: number, y: number, level: number, parentX?: number, parentY?: number, compVal?: number): { nodes: any[], edges: any[] } {
    if (!node) return { nodes: [], edges: [] };
    const horizontalOffset = 180 / Math.pow(1.8, level);
    const verticalOffset = 60;
    
    let leftResult = getTreeList(node.left, x - horizontalOffset, y + verticalOffset, level + 1, x, y, compVal);
    let rightResult = getTreeList(node.right, x + horizontalOffset, y + verticalOffset, level + 1, x, y, compVal);

    let state: "normal" | "comparing" | "highlighted" = "normal";
    if (compVal !== undefined && node.val === compVal) {
      state = "comparing";
    }

    let currentNodes = [
      { id: node.id, val: node.val, x, y, state },
      ...leftResult.nodes,
      ...rightResult.nodes
    ];

    let currentEdges = [...leftResult.edges, ...rightResult.edges];
    if (parentX !== undefined && parentY !== undefined) {
      currentEdges.push({
        fromX: parentX,
        fromY: parentY + 15,
        toX: x,
        toY: y - 15,
      });
    }

    return { nodes: currentNodes, edges: currentEdges };
  }

  yield {
    treeNodes: [],
    treeEdges: [],
    explanation: "Initialize an empty Binary Search Tree.",
    highlightedLines: [0],
  };

  for (let num of nums) {
    yield {
      ...getTreeList(root, 250, 40, 0),
      explanation: `Start BST insertion for element ${num}.`,
      highlightedLines: [1],
    };

    if (!root) {
      root = { id: nextNodeId++, val: num, left: null, right: null };
      yield {
        ...getTreeList(root, 250, 40, 0),
        explanation: `Tree was empty. Element ${num} becomes the root node.`,
        highlightedLines: [3],
      };
      continue;
    }

    let curr = root;
    while (curr) {
      yield {
        ...getTreeList(root, 250, 40, 0, undefined, undefined, curr.val),
        explanation: `Comparing node ${curr.val} with insertion value ${num}.`,
        highlightedLines: [5],
      };

      if (num < curr.val) {
        if (!curr.left) {
          curr.left = { id: nextNodeId++, val: num, left: null, right: null };
          yield {
            ...getTreeList(root, 250, 40, 0, undefined, undefined, num),
            explanation: `${num} < ${curr.val}. Left child is empty, inserting ${num} here.`,
            highlightedLines: [8],
          };
          break;
        } else {
          yield {
            ...getTreeList(root, 250, 40, 0, undefined, undefined, curr.val),
            explanation: `${num} < ${curr.val}. Navigating to left child: ${curr.left.val}.`,
            highlightedLines: [9],
          };
          curr = curr.left;
        }
      } else {
        if (!curr.right) {
          curr.right = { id: nextNodeId++, val: num, left: null, right: null };
          yield {
            ...getTreeList(root, 250, 40, 0, undefined, undefined, num),
            explanation: `${num} >= ${curr.val}. Right child is empty, inserting ${num} here.`,
            highlightedLines: [12],
          };
          break;
        } else {
          yield {
            ...getTreeList(root, 250, 40, 0, undefined, undefined, curr.val),
            explanation: `${num} >= ${curr.val}. Navigating to right child: ${curr.right.val}.`,
            highlightedLines: [13],
          };
          curr = curr.right;
        }
      }
    }
  }

  yield {
    ...getTreeList(root, 250, 40, 0),
    explanation: "All insertions completed successfully!",
    highlightedLines: [13],
  };
}

function* bfsGenerator(adjList: Record<string, string[]>): Generator<StepState, void, unknown> {
  let visited = new Set<string>();
  let queue: string[] = [];
  let traversalOrder: string[] = [];

  const startNode = "A";
  queue.push(startNode);
  visited.add(startNode);

  yield {
    graphNodes: Object.keys(adjList).map(node => ({
      id: node,
      state: node === startNode ? "comparing" : "normal"
    })),
    queue: [...queue],
    explanation: `Initializing Breadth First Search at root node "${startNode}". Mark visited and enqueue.`,
    highlightedLines: [0],
  };

  while (queue.length > 0) {
    let curr = queue.shift()!;
    traversalOrder.push(curr);

    yield {
      graphNodes: Object.keys(adjList).map(node => ({
        id: node,
        state: node === curr ? "comparing" : visited.has(node) ? "visited" : "normal"
      })),
      queue: [...queue],
      explanation: `Dequeue node "${curr}" for neighbor evaluation.`,
      highlightedLines: [2],
    };

    let neighbors = adjList[curr] || [];
    for (let neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
        yield {
          graphNodes: Object.keys(adjList).map(node => ({
            id: node,
            state: node === neighbor ? "comparing" : visited.has(node) ? "visited" : "normal"
          })),
          queue: [...queue],
          explanation: `Neighbor "${neighbor}" is unvisited. Mark it as visited and enqueue it.`,
          highlightedLines: [5],
        };
      } else {
        yield {
          graphNodes: Object.keys(adjList).map(node => ({
            id: node,
            state: node === neighbor ? "visited" : visited.has(node) ? "visited" : "normal"
          })),
          queue: [...queue],
          explanation: `Neighbor "${neighbor}" is already visited. Skipping node.`,
          highlightedLines: [6],
        };
      }
    }
  }

  yield {
    graphNodes: Object.keys(adjList).map(node => ({
      id: node,
      state: "visited"
    })),
    queue: [],
    explanation: `BFS Completed. Traversal order: ${traversalOrder.join(" ➔ ")}`,
    highlightedLines: [6],
  };
}

function* knapsackGenerator(weights: number[], values: number[], capacity: number): Generator<StepState, void, unknown> {
  const n = weights.length;
  let dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));
  
  yield {
    dpTable: dp.map(row => [...row]),
    explanation: "Initialize DP table. Row values represent items 1..i, Column indexes represent max weight limit.",
    highlightedLines: [0],
    customVisualData: { weights, values, capacity },
  };

  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1];
    const val = values[i - 1];
    
    yield {
      dpTable: dp.map(row => [...row]),
      explanation: `Evaluating Item ${i} with weight = ${w} and value = ${val}.`,
      highlightedLines: [1],
      customVisualData: { weights, values, capacity, currentItem: i },
    };

    for (let j = 0; j <= capacity; j++) {
      if (w <= j) {
        let exclude = dp[i - 1][j];
        let include = dp[i - 1][j - w] + val;
        dp[i][j] = Math.max(exclude, include);
        yield {
          dpTable: dp.map(row => [...row]),
          explanation: `At capacity ${j}: Compare excluding Item ${i} (${exclude}) vs including Item ${i} (${include}). Result value = ${dp[i][j]}.`,
          highlightedLines: [4],
          pointers: { cell: [i, j] },
          customVisualData: { weights, values, capacity, currentItem: i, capacityCol: j },
        };
      } else {
        dp[i][j] = dp[i - 1][j];
        yield {
          dpTable: dp.map(row => [...row]),
          explanation: `At capacity ${j}: Weight (${w}) exceeds limit. Copy value from previous row: ${dp[i][j]}.`,
          highlightedLines: [6],
          pointers: { cell: [i, j] },
          customVisualData: { weights, values, capacity, currentItem: i, capacityCol: j },
        };
      }
    }
  }

  let res = dp[n][capacity];
  let wRemaining = capacity;
  let selectedItems: number[] = [];
  for (let i = n; i > 0 && res > 0; i--) {
    if (res !== dp[i - 1][wRemaining]) {
      selectedItems.push(i - 1);
      res = res - values[i - 1];
      wRemaining = wRemaining - weights[i - 1];
    }
  }

  yield {
    dpTable: dp.map(row => [...row]),
    explanation: `Algorithm finished. Maximum Value achieved is ${dp[n][capacity]}. Selected items: ${selectedItems.map(idx => `Item ${idx+1}`).join(", ") || "None"}.`,
    highlightedLines: [6],
    customVisualData: { weights, values, capacity, selectedItems },
  };
}

function* towerOfHanoiGenerator(n: number): Generator<StepState, void, unknown> {
  let pegs: Record<string, number[]> = {
    A: Array.from({ length: n }, (_, i) => n - i),
    B: [],
    C: [],
  };
  let movesCount = 0;

  yield {
    pegs: { A: [...pegs.A], B: [...pegs.B], C: [...pegs.C] },
    explanation: `Start Tower of Hanoi with ${n} disks on Peg A. Target: Move all to Peg C.`,
    customVisualData: { movesCount },
    highlightedLines: [0],
  };

  function* moveDisks(count: number, from: string, to: string, aux: string): Generator<StepState, void, unknown> {
    if (count === 1) {
      let disk = pegs[from].pop()!;
      pegs[to].push(disk);
      movesCount++;
      yield {
        pegs: { A: [...pegs.A], B: [...pegs.B], C: [...pegs.C] },
        explanation: `Move disk ${disk} from Peg ${from} to Peg ${to}.`,
        customVisualData: { movesCount, activeMove: { from, to, disk } },
        highlightedLines: [2],
      };
      return;
    }

    yield* moveDisks(count - 1, from, aux, to);
    
    let disk = pegs[from].pop()!;
    pegs[to].push(disk);
    movesCount++;
    yield {
      pegs: { A: [...pegs.A], B: [...pegs.B], C: [...pegs.C] },
      explanation: `Move disk ${disk} from Peg ${from} to Peg ${to}.`,
      customVisualData: { movesCount, activeMove: { from, to, disk } },
      highlightedLines: [5],
    };

    yield* moveDisks(count - 1, aux, to, from);
  }

  yield* moveDisks(n, "A", "C", "B");

  yield {
    pegs: { A: [...pegs.A], B: [...pegs.B], C: [...pegs.C] },
    explanation: `Completed in ${movesCount} moves! Disks successfully transferred.`,
    customVisualData: { movesCount },
    highlightedLines: [6],
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Content Component
   ───────────────────────────────────────────────────────────────────────────── */
function DSAVisualizerContent() {
  const [activeAlg, setActiveAlg] = useState<AlgorithmInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.25x to 4x
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bottomExpanded, setBottomExpanded] = useState(true);

  // Trace variables
  const generatorRef = useRef<Generator<StepState, void, unknown> | null>(null);
  const stepsHistoryRef = useRef<StepState[]>([]);
  const currentStepIdxRef = useRef<number>(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stepsCount, setStepsCount] = useState(0);
  const [currentStepState, setCurrentStepState] = useState<StepState | null>(null);
  const [logMessages, setLogMessages] = useState<{ text: string; timestamp: string }[]>([]);

  // Font Injection
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Sora:wght@400;600;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const addLogMessage = (text: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogMessages(prev => [{ text, timestamp }, ...prev]);
  };

  const initializeTrace = useCallback((alg: AlgorithmInfo, input: string) => {
    setInputError(null);
    setIsPlaying(false);
    stepsHistoryRef.current = [];
    currentStepIdxRef.current = 0;
    setCurrentStepIdx(0);
    setStepsCount(0);
    setLogMessages([]);

    try {
      let generator: Generator<StepState, void, unknown>;
      
      if (alg.id === "bubble-sort") {
        const nums = input.split(",").map(s => {
          const num = parseInt(s.trim(), 10);
          if (isNaN(num)) throw new Error("All array items must be integers");
          return num;
        });
        if (nums.length === 0 || nums.some(isNaN)) throw new Error("Invalid array input");
        generator = bubbleSortGenerator(nums);
      } else if (alg.id === "binary-search") {
        const parts = input.split("|");
        const arrayStr = parts[0];
        const targetStr = parts[1];
        if (!arrayStr || !targetStr) throw new Error("Format: values | target=X");
        const nums = arrayStr.split(",").map(s => {
          const num = parseInt(s.trim(), 10);
          if (isNaN(num)) throw new Error("Array must contain numbers");
          return num;
        });
        const targetMatch = targetStr.match(/target\s*=\s*(-?\d+)/i);
        if (!targetMatch) throw new Error("Target must be specified like target=9");
        const target = parseInt(targetMatch[1], 10);
        generator = binarySearchGenerator(nums, target);
      } else if (alg.id === "stack") {
        const ops = input.split(",").map(s => s.trim());
        if (ops.length === 0 || ops[0] === "") throw new Error("Enter operations like push 10, pop");
        generator = stackGenerator(ops);
      } else if (alg.id === "bst") {
        const nums = input.split(",").map(s => {
          const num = parseInt(s.trim(), 10);
          if (isNaN(num)) throw new Error("BST values must be integers");
          return num;
        });
        generator = bstInsertGenerator(nums);
      } else if (alg.id === "bfs") {
        const edges = input.split(",").map(s => s.trim());
        const adjList: Record<string, string[]> = {};
        edges.forEach(edge => {
          const nodes = edge.split("-").map(n => n.trim());
          if (nodes.length !== 2) throw new Error("Edges must be in node1-node2 format (e.g. A-B)");
          const [u, v] = nodes;
          if (!adjList[u]) adjList[u] = [];
          if (!adjList[v]) adjList[v] = [];
          adjList[u].push(v);
          adjList[v].push(u);
        });
        if (!adjList["A"]) {
          adjList["A"] = [];
        }
        generator = bfsGenerator(adjList);
      } else if (alg.id === "knapsack") {
        const parts = input.split("|");
        let weights: number[] = [];
        let values: number[] = [];
        let capacity = 0;
        
        parts.forEach(part => {
          const [key, valStr] = part.split("=");
          if (!key || !valStr) throw new Error("Format: weights=2,3 | values=3,4 | capacity=5");
          const k = key.trim().toLowerCase();
          if (k === "weights") {
            weights = valStr.split(",").map(s => parseInt(s.trim(), 10));
          } else if (k === "values") {
            values = valStr.split(",").map(s => parseInt(s.trim(), 10));
          } else if (k === "capacity") {
            capacity = parseInt(valStr.trim(), 10);
          }
        });
        
        if (weights.length !== values.length) throw new Error("Weights and values must have equal length");
        if (isNaN(capacity) || capacity <= 0) throw new Error("Capacity must be positive integer");
        generator = knapsackGenerator(weights, values, capacity);
      } else if (alg.id === "hanoi") {
        const match = input.match(/disks\s*=\s*(\d+)/i);
        if (!match) throw new Error("Format: disks=3");
        const disks = parseInt(match[1], 10);
        if (isNaN(disks) || disks < 1 || disks > 8) throw new Error("Disks must be between 1 and 8");
        generator = towerOfHanoiGenerator(disks);
      } else {
        throw new Error("Unknown algorithm");
      }

      generatorRef.current = generator;
      
      const first = generator.next();
      if (!first.done && first.value) {
        stepsHistoryRef.current.push(first.value);
        setCurrentStepState(first.value);
        setStepsCount(1);
        addLogMessage(first.value.explanation);
      }
    } catch (err: any) {
      setInputError(err.message);
    }
  }, []);

  const handleSelectAlg = (alg: AlgorithmInfo) => {
    setActiveAlg(alg);
    setInputValue(alg.defaultInput);
    initializeTrace(alg, alg.defaultInput);
  };

  const handleStepForward = useCallback(() => {
    if (!generatorRef.current) return;
    
    if (currentStepIdxRef.current < stepsHistoryRef.current.length - 1) {
      currentStepIdxRef.current += 1;
      setCurrentStepIdx(currentStepIdxRef.current);
      const state = stepsHistoryRef.current[currentStepIdxRef.current];
      setCurrentStepState(state);
      addLogMessage(state.explanation);
      return;
    }

    const next = generatorRef.current.next();
    if (!next.done && next.value) {
      stepsHistoryRef.current.push(next.value);
      currentStepIdxRef.current = stepsHistoryRef.current.length - 1;
      setCurrentStepIdx(currentStepIdxRef.current);
      setCurrentStepState(next.value);
      setStepsCount(stepsHistoryRef.current.length);
      addLogMessage(next.value.explanation);
    } else {
      setIsPlaying(false);
      addLogMessage("Execution finished.");
    }
  }, []);

  const handleStepBackward = useCallback(() => {
    if (currentStepIdxRef.current > 0) {
      currentStepIdxRef.current -= 1;
      setCurrentStepIdx(currentStepIdxRef.current);
      const state = stepsHistoryRef.current[currentStepIdxRef.current];
      setCurrentStepState(state);
      addLogMessage(`Stepped backward: ${state.explanation}`);
    }
  }, []);

  const handleReset = () => {
    if (activeAlg) {
      initializeTrace(activeAlg, inputValue);
    }
  };

  // Autoplay Effect
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.max(100, 1000 / speed);
    const timer = setInterval(() => {
      handleStepForward();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, handleStepForward]);

  // Categories parsing
  const categories = Array.from(new Set(ALGORITHMS.map(a => a.category)));
  const filteredAlgs = ALGORITHMS.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        ["--bg" as any]: "#222831",
        ["--surface" as any]: "#393E46",
        ["--accent" as any]: "#00ADB5",
        ["--accent-dim" as any]: "rgba(0,173,181,0.15)",
        ["--accent-glow" as any]: "rgba(0,173,181,0.3)",
        ["--text" as any]: "#EEEEEE",
        ["--text-muted" as any]: "rgba(238,238,238,0.45)",
        ["--border" as any]: "rgba(0,173,181,0.12)",
        ["--node-fill" as any]: "#393E46",
        ["--node-stroke" as any]: "#00ADB5",
        ["--node-highlight" as any]: "rgba(0,173,181,0.9)",
        ["--node-visited" as any]: "rgba(0,173,181,0.4)",
        ["--node-comparing" as any]: "#FFD700",
        ["--node-sorted" as any]: "rgba(0,173,181,0.6)",
        ["--error" as any]: "#FF6B6B",
      }}
      className="flex flex-col xl:flex-row h-[calc(100vh-140px)] gap-6 text-[var(--text)] select-none font-sans"
    >
      {/* ── LEFT PANEL: Problem Selector ── */}
      <div className="w-full xl:w-[290px] shrink-0 bg-[var(--surface)]/10 border border-[var(--border)] rounded-2xl flex flex-col p-4 backdrop-blur-xl">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={13} />
          <input
            type="text"
            placeholder="Search algorithms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface)]/40 border border-[var(--border)] rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]/40 placeholder:text-white/20 transition-all font-mono"
          />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4">
          {categories.map(cat => {
            const items = filteredAlgs.filter(a => a.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] px-2 mb-1">
                  {cat}
                </span>
                {items.map(alg => {
                  const isActive = activeAlg?.id === alg.id;
                  return (
                    <button
                      key={alg.id}
                      onClick={() => handleSelectAlg(alg)}
                      className={clsx(
                        "relative flex items-center justify-between rounded-xl text-xs transition-all duration-200 overflow-hidden px-3 py-2.5 text-left border border-transparent",
                        isActive
                          ? "bg-[var(--accent)]/10 text-white font-semibold border-[var(--accent)]/20"
                          : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface)]/20"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                      )}
                      <span className="truncate">{alg.name}</span>
                      <span className="text-[8px] font-mono opacity-50 px-1 py-0.5 rounded bg-white/5 uppercase border border-white/5">
                        {alg.complexity}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT LAYOUT (Visualization & Logs) ── */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
        
        {/* Empty State */}
        {!activeAlg ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-[var(--border)] rounded-2xl bg-[var(--surface)]/5 p-12 text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] animate-pulse shadow-[0_0_15px_var(--accent-glow)]">
              <LayoutGrid size={24} />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-bold font-display uppercase tracking-wider text-white">Select an Algorithm</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Choose any algorithm from the left panel to load the interactive step-by-step trace visualizer.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl text-left mt-4 font-mono text-[10px]">
              {ALGORITHMS.map(a => (
                <div
                  key={a.id}
                  onClick={() => handleSelectAlg(a)}
                  className="p-3 border border-[var(--border)] rounded-xl bg-[var(--surface)]/10 hover:bg-[var(--accent)]/5 hover:border-[var(--accent)]/30 cursor-pointer transition-all flex flex-col justify-between h-16"
                >
                  <span className="text-[var(--text)] font-semibold leading-tight">{a.name}</span>
                  <span className="opacity-40 uppercase tracking-widest">{a.complexity}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── TOP CONTROLS BAR ── */}
            <div className="bg-[var(--surface)]/10 border border-[var(--border)] rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 backdrop-blur-xl shrink-0">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white font-display">
                    {activeAlg.name}
                  </h1>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-widest font-semibold">
                    {activeAlg.complexity}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                  Category: {activeAlg.category}
                </p>
              </div>

              {/* Editable Input */}
              <div className="flex flex-col gap-1 flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      initializeTrace(activeAlg, e.target.value);
                    }}
                    className={clsx(
                      "w-full bg-[var(--surface)]/40 border rounded-xl py-2 px-3 text-xs text-[var(--text)] outline-none font-mono transition-all",
                      inputError ? "border-[var(--error)] focus:border-[var(--error)]" : "border-[var(--border)] focus:border-[var(--accent)]/40"
                    )}
                    placeholder="Input array or parameters..."
                  />
                  {inputError && (
                    <span className="absolute -bottom-5 left-1 text-[8.5px] font-mono text-[var(--error)] uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={8} /> {inputError}
                    </span>
                  )}
                </div>
              </div>

              {/* Steppers & Speed */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-black/20 border border-[var(--border)]/50 rounded-xl p-1">
                  <button
                    onClick={handleStepBackward}
                    disabled={currentStepIdx === 0}
                    className="w-7 h-7 rounded-lg hover:bg-white/5 disabled:opacity-20 text-[var(--text)] flex items-center justify-center transition-all"
                    title="Step Backward"
                  >
                    <SkipBack size={12} />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-7 h-7 rounded-lg bg-[var(--accent)] text-black flex items-center justify-center shadow-[0_0_8px_var(--accent-glow)] transition-all hover:scale-105"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                  </button>
                  <button
                    onClick={handleStepForward}
                    disabled={currentStepIdx >= stepsCount - 1 && !generatorRef.current?.next}
                    className="w-7 h-7 rounded-lg hover:bg-white/5 disabled:opacity-20 text-[var(--text)] flex items-center justify-center transition-all"
                    title="Step Forward"
                  >
                    <SkipForward size={12} />
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-7 h-7 rounded-lg hover:bg-white/5 text-[var(--text)] flex items-center justify-center transition-all"
                    title="Reset execution"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>

                {/* Speed Slider */}
                <div className="flex items-center gap-2 bg-black/20 border border-[var(--border)]/50 rounded-xl px-3 py-1">
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">Speed:</span>
                  <input
                    type="range"
                    min="0.25"
                    max="4.0"
                    step="0.25"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-16 accent-[var(--accent)] cursor-pointer h-1 rounded-lg"
                  />
                  <span className="text-[9px] font-mono text-[var(--accent)] font-semibold w-7 text-right">
                    {speed}x
                  </span>
                </div>
              </div>
            </div>

            {/* ── CENTRAL VISUALIZATION CANVAS ── */}
            <div className="flex-1 border border-[var(--border)] rounded-2xl bg-[#08080f]/40 relative overflow-hidden flex items-center justify-center p-6 backdrop-blur-xl">
              <div className="absolute top-4 left-4 text-[9px] font-mono text-[var(--text-muted)]/50 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu size={10} /> Active Visual block
              </div>

              {/* Visualizer Renderer Switch */}
              <div className="w-full h-full flex items-center justify-center">
                {activeAlg.id === "bubble-sort" && currentStepState?.array && (
                  <div className="flex items-end justify-center gap-3 h-64 px-4 w-full">
                    {currentStepState.array.map((item, idx) => {
                      const isComparing = currentStepState.comparing?.includes(idx);
                      const isSorted = currentStepState.sorted?.includes(idx);
                      
                      let barColor = "var(--surface)";
                      let strokeColor = "var(--border)";
                      let heightPct = Math.max(10, (item / Math.max(...currentStepState.array!)) * 100);

                      if (isComparing) {
                        barColor = "var(--node-comparing)";
                        strokeColor = "#FFD700";
                      } else if (isSorted) {
                        barColor = "var(--node-sorted)";
                        strokeColor = "var(--accent)";
                      }

                      return (
                        <motion.div
                          key={`${idx}-${item}`}
                          layout
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                          className="flex flex-col items-center flex-1 max-w-[50px] h-full justify-end"
                        >
                          <div
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: barColor,
                              border: `1px solid ${strokeColor}`,
                            }}
                            className="w-full rounded-t-lg shadow-lg relative flex items-end justify-center transition-colors duration-300"
                          >
                            <span className="font-mono text-xs font-semibold mb-2 text-[var(--text)] select-none">
                              {item}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] mt-2">
                            {idx}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {activeAlg.id === "binary-search" && currentStepState?.array && (
                  <div className="flex flex-col items-center gap-6 py-6 w-full">
                    <div className="flex justify-center items-center gap-3 flex-wrap">
                      {currentStepState.array.map((val, idx) => {
                        const low = currentStepState.pointers?.low;
                        const high = currentStepState.pointers?.high;
                        const mid = currentStepState.pointers?.mid;
                        const isComparing = currentStepState.comparing?.includes(idx);
                        const isSorted = currentStepState.sorted?.includes(idx);

                        const isLow = low === idx;
                        const isHigh = high === idx;
                        const isMid = mid === idx;

                        return (
                          <div key={idx} className="flex flex-col items-center gap-2 relative">
                            {/* Pointers above node */}
                            <div className="h-6 flex items-end justify-center gap-1 text-[9px] font-bold font-mono">
                              {isLow && <span className="bg-emerald-500 text-black px-1.5 py-0.5 rounded shadow">Low</span>}
                              {isHigh && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded shadow">High</span>}
                            </div>

                            <motion.div
                              layout
                              className={clsx(
                                "w-12 h-12 rounded-lg flex items-center justify-center border font-mono text-sm font-semibold transition-all duration-300",
                                isMid
                                  ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold scale-110 shadow-[0_0_12px_var(--accent-glow)]"
                                  : isComparing
                                  ? "bg-[var(--node-comparing)] border-amber-400 text-black font-bold"
                                  : isSorted
                                  ? "bg-[var(--node-sorted)] border-[var(--accent)] text-[var(--text)]"
                                  : idx >= (low ?? 0) && idx <= (high ?? currentStepState.array!.length)
                                  ? "border-[var(--accent)]/55 bg-[var(--surface)] text-[var(--text)]"
                                  : "border-white/[0.05] bg-white/[0.02] text-[var(--text-muted)] opacity-30"
                              )}
                            >
                              {val}
                            </motion.div>
                            
                            <div className="h-4 text-[9px] font-mono font-bold text-[var(--accent)]">
                              {isMid && <span>mid</span>}
                            </div>
                            
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">
                              {idx}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeAlg.id === "stack" && currentStepState?.stack && (
                  <div className="flex flex-col items-center justify-end h-72 py-4 w-full">
                    <div className="w-56 border-b-4 border-l-2 border-r-2 border-[var(--border)] bg-[var(--surface)]/10 rounded-b-lg p-3 flex flex-col-reverse gap-2 h-64 justify-start overflow-y-auto">
                      <AnimatePresence>
                        {currentStepState.stack.map((item, idx) => {
                          const isTop = idx === currentStepState.pointers?.top;
                          return (
                            <motion.div
                              key={`${idx}-${item}`}
                              initial={{ opacity: 0, y: -40, scale: 0.8 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8, x: 100 }}
                              transition={{ type: "spring", stiffness: 250, damping: 20 }}
                              className={clsx(
                                "p-3 rounded-lg border font-mono text-center relative flex justify-between items-center",
                                isTop
                                  ? "bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]"
                                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--text)]"
                              )}
                            >
                              <span className="text-xs font-semibold">{item}</span>
                              <span className="text-[9px] opacity-40">Index: {idx}</span>
                              {isTop && (
                                <span className="absolute -left-16 text-[9px] uppercase tracking-wider font-bold text-[var(--accent)] flex items-center gap-1 animate-pulse">
                                  TOP ➔
                                </span>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {currentStepState.stack.length === 0 && (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[11px] font-mono italic">
                          Stack is Empty
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeAlg.id === "bst" && (
                  <div className="w-full flex justify-center py-4">
                    {currentStepState?.treeNodes && currentStepState.treeNodes.length > 0 ? (
                      <svg className="w-full max-w-[500px] h-72">
                        {currentStepState.treeEdges?.map((edge, idx) => (
                          <line
                            key={`edge-${idx}`}
                            x1={edge.fromX}
                            y1={edge.fromY}
                            x2={edge.toX}
                            y2={edge.toY}
                            stroke="var(--border)"
                            strokeWidth={1.5}
                          />
                        ))}

                        {currentStepState.treeNodes?.map((node) => {
                          let fill = "var(--node-fill)";
                          let stroke = "var(--node-stroke)";
                          let textColor = "var(--text)";
                          
                          if (node.state === "comparing") {
                            fill = "var(--node-comparing)";
                            stroke = "#FFD700";
                            textColor = "#000000";
                          } else if (node.state === "highlighted") {
                            fill = "var(--accent)";
                            stroke = "var(--accent)";
                            textColor = "#000000";
                          }

                          return (
                            <g key={`node-${node.id}`}>
                              <motion.circle
                                layout
                                cx={node.x}
                                cy={node.y}
                                r={16}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={2}
                                className="transition-colors duration-300"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 250, damping: 18 }}
                              />
                              <text
                                x={node.x}
                                y={node.y + 4}
                                textAnchor="middle"
                                fill={textColor}
                                className="font-mono text-[11px] font-semibold select-none pointer-events-none"
                              >
                                {node.val}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    ) : (
                      <div className="text-[var(--text-muted)] italic font-mono text-[11px]">BST is empty. Please step forward.</div>
                    )}
                  </div>
                )}

                {activeAlg.id === "bfs" && (
                  <div className="flex flex-col gap-4 w-full max-w-[500px]">
                    <svg className="w-full h-64">
                      {[
                        { fx: 80, fy: 130, tx: 200, ty: 50 },
                        { fx: 80, fy: 130, tx: 200, ty: 210 },
                        { fx: 200, fy: 50, tx: 320, ty: 50 },
                        { fx: 200, fy: 210, tx: 320, ty: 50 },
                        { fx: 200, fy: 210, tx: 320, ty: 210 },
                        { fx: 320, fy: 50, tx: 440, ty: 130 },
                        { fx: 320, fy: 210, tx: 440, ty: 130 },
                      ].map((edge, idx) => (
                        <line
                          key={`gedge-${idx}`}
                          x1={edge.fx}
                          y1={edge.fy}
                          x2={edge.tx}
                          y2={edge.ty}
                          stroke="var(--border)"
                          strokeWidth={2}
                        />
                      ))}

                      {currentStepState?.graphNodes?.map((node: any) => {
                        const coords: Record<string, { x: number, y: number }> = {
                          A: { x: 80, y: 130 },
                          B: { x: 200, y: 50 },
                          C: { x: 200, y: 210 },
                          D: { x: 320, y: 50 },
                          E: { x: 320, y: 210 },
                          F: { x: 440, y: 130 },
                        };
                        const pos = coords[node.id] || { x: 250, y: 130 };

                        let fill = "var(--node-fill)";
                        let stroke = "var(--node-stroke)";
                        let textColor = "var(--text)";
                        
                        if (node.state === "comparing") {
                          fill = "var(--node-comparing)";
                          stroke = "#FFD700";
                          textColor = "#000000";
                        } else if (node.state === "visited") {
                          fill = "var(--node-visited)";
                          stroke = "var(--accent)";
                        }

                        return (
                          <g key={`gnode-${node.id}`}>
                            <circle
                              cx={pos.x}
                              cy={pos.y}
                              r={18}
                              fill={fill}
                              stroke={stroke}
                              strokeWidth={2}
                              className="transition-all duration-300"
                            />
                            <text
                              x={pos.x}
                              y={pos.y + 4}
                              textAnchor="middle"
                              fill={textColor}
                              className="font-mono text-xs font-bold select-none pointer-events-none"
                            >
                              {node.id}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div className="flex items-center gap-3 bg-[var(--surface)]/10 border border-[var(--border)] p-3 rounded-lg">
                      <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider font-bold">Frontier Queue:</span>
                      <div className="flex gap-1.5 font-mono text-xs">
                        {currentStepState?.queue && currentStepState.queue.length > 0 ? (
                          currentStepState.queue.map((qItem: any, qIdx: number) => (
                            <div key={qIdx} className="px-2 py-0.5 rounded bg-[var(--accent-dim)] border border-[var(--accent)]/30 text-[var(--accent)] font-semibold">
                              {qItem}
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] italic">Queue is empty</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeAlg.id === "knapsack" && currentStepState?.dpTable && (
                  <div className="flex flex-col gap-4 w-full overflow-x-auto max-h-72 no-scrollbar">
                    <table className="min-w-full border-collapse border border-[var(--border)]/50 font-mono text-[10px] text-[var(--text)]">
                      <thead>
                        <tr className="bg-[var(--surface)]/30 border-b border-[var(--border)]/50">
                          <th className="p-2 border-r border-[var(--border)]/50">Item \ Cap</th>
                          {Array.from({ length: (currentStepState.dpTable[0]?.length ?? 1) }, (_, cap) => (
                            <th key={cap} className="p-2 border-r border-[var(--border)]/50 text-center font-bold">{cap}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentStepState.dpTable.map((row, i) => (
                          <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-white/[0.01] transition-all">
                            <td className="p-2 border-r border-[var(--border)]/50 font-bold bg-[var(--surface)]/10">
                              {i === 0 ? "0" : `It ${i} (w:${currentStepState.customVisualData?.weights?.[i-1]}, v:${currentStepState.customVisualData?.values?.[i-1]})`}
                            </td>
                            {row.map((val, j) => {
                              const isCell = currentStepState.pointers?.cell?.[0] === i && currentStepState.pointers?.cell?.[1] === j;
                              const isSelected = currentStepState.customVisualData?.selectedItems?.includes(i - 1) && j === currentStepState.customVisualData?.capacity;
                              
                              return (
                                <td
                                  key={j}
                                  className={clsx(
                                    "p-1 border-r border-[var(--border)]/50 text-center transition-all duration-300",
                                    isCell
                                      ? "bg-[var(--node-comparing)] text-black font-bold scale-105"
                                      : isSelected
                                      ? "bg-[var(--node-sorted)] text-white font-bold"
                                      : "bg-transparent"
                                  )}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeAlg.id === "hanoi" && currentStepState?.pegs && (
                  <div className="flex justify-around items-end h-64 border border-[var(--border)]/30 rounded-xl bg-[var(--surface)]/5 p-6 w-full max-w-[500px] relative">
                    {["A", "B", "C"].map((pegName) => {
                      const diskList = currentStepState.pegs?.[pegName] || [];
                      return (
                        <div key={pegName} className="flex flex-col items-center relative w-1/3 h-full justify-end">
                          <span className="absolute top-2 text-[10px] font-mono font-bold text-[var(--accent)]">Peg {pegName}</span>
                          <div className="absolute w-1 h-36 bg-[var(--border)] rounded-full -bottom-1 z-0" />
                          <div className="flex flex-col-reverse items-center gap-1 w-full z-10 select-none pb-2">
                            {diskList.map((diskVal) => {
                              const diskWidthPercent = 20 + diskVal * 10;
                              const colors = [
                                "#FF5058", "#00ADB5", "#FFD700", "#FF8C00",
                                "#9932CC", "#10D986", "#1E90FF", "#FF69B4"
                              ];
                              const diskColor = colors[(diskVal - 1) % colors.length];

                              return (
                                <motion.div
                                  key={diskVal}
                                  layout
                                  className="h-4 rounded shadow flex items-center justify-center font-mono font-bold text-[9px] text-black"
                                  style={{
                                    width: `${diskWidthPercent}%`,
                                    backgroundColor: diskColor,
                                  }}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 250, damping: 20 }}
                                >
                                  {diskVal}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── BOTTOM PANEL: Log & Pseudocode ── */}
            <div className="bg-[var(--surface)]/10 border border-[var(--border)] rounded-2xl backdrop-blur-xl shrink-0 flex flex-col transition-all duration-300">
              <div
                onClick={() => setBottomExpanded(!bottomExpanded)}
                className="px-4 py-2 border-b border-[var(--border)]/30 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition-all"
              >
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-bold">
                  <Terminal size={11} /> Trace Explanation & Pseudocode
                </div>
                <span className="text-[10px] font-mono text-[var(--accent)] font-semibold">
                  {bottomExpanded ? "Collapse" : "Expand"}
                </span>
              </div>

              {bottomExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-12 h-44 overflow-hidden">
                  
                  {/* Left Column: Trace Log Messages (7 cols) */}
                  <div className="md:col-span-7 p-4 flex flex-col gap-2 overflow-y-auto border-r border-[var(--border)]/30 no-scrollbar">
                    {logMessages.map((log, idx) => {
                      const isCurrent = idx === 0;
                      return (
                        <div
                          key={idx}
                          className={clsx(
                            "flex items-start gap-3 p-2 rounded-xl transition-all duration-300 border",
                            isCurrent
                              ? "bg-[var(--accent)]/10 border-[var(--accent)]/20 text-white"
                              : "border-transparent text-[var(--text-muted)]"
                          )}
                        >
                          <span className="text-[9px] font-mono opacity-50 shrink-0 mt-0.5">{log.timestamp}</span>
                          <span className="text-[11.5px] leading-relaxed font-mono">{log.text}</span>
                        </div>
                      );
                    })}
                    {logMessages.length === 0 && (
                      <div className="text-[var(--text-muted)] font-mono text-xs italic text-center py-8">
                        No logs recorded yet.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Pseudocode Panel (5 cols) */}
                  <div className="md:col-span-5 p-4 overflow-y-auto no-scrollbar font-mono text-[10.5px] leading-5 bg-black/10">
                    {activeAlg.pseudocode.map((line, idx) => {
                      const isHighlighted = currentStepState?.highlightedLines?.includes(idx);
                      return (
                        <div
                          key={idx}
                          className={clsx(
                            "px-2 rounded-md transition-all duration-150 border-l-2",
                            isHighlighted
                              ? "bg-[var(--accent)]/10 border-[var(--accent)] text-white font-semibold"
                              : "border-transparent text-[var(--text-muted)]"
                          )}
                        >
                          <pre className="whitespace-pre">{line}</pre>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default function DSAVisualizerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
        <span className="text-xs font-mono text-[var(--text-muted)] animate-pulse">Initializing Trace Canvas...</span>
      </div>
    }>
      <DSAVisualizerContent />
    </Suspense>
  );
}
