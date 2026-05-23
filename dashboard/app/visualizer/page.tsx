"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTheme } from "@/components/Providers";
import { PremiumCard } from "@/components/ui/PremiumCard";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
  Sliders, Cpu, Layers, Activity, Terminal, ChevronRight,
  Info, Sparkles, Brain, Code2, AlertTriangle, CheckCircle2,
  Grid, Database, Link2, GitBranch
} from "lucide-react";
import { Submission } from "@/types/api";

/* ─────────────────────────────────────────────────────────────────────────────
   Type Definitions for Execution Tracing
   ───────────────────────────────────────────────────────────────────────────── */
interface TraceStep {
  line: number;                     // 1-indexed line number in source code
  explanation: string;             // Description of the current action
  variables: Record<string, any>;   // Current state of variables
  stack: string[];                  // Execution call stack frames
  pointers?: Record<string, any>;   // Index pointers (e.g. { "left": 0, "right": 7 })
  focusNode?: string | number | null;      // Highlighting active node (for tree/graph)
  arrayData?: any[];                // Array elements to visualize
  matrixData?: any[][];             // 2D grid/DP elements to visualize
  stackData?: any[];                // Stack elements to visualize
  queueData?: any[];                // Queue elements to visualize
  linkedListData?: any[];            // Linked List elements to visualize
  treeData?: any;                   // Tree configuration to visualize
  updatedVar?: string;              // Variable that just changed value in this step
}

/* ─────────────────────────────────────────────────────────────────────────────
   Fallback/Mock submissions when database has no records or loading fails
   ───────────────────────────────────────────────────────────────────────────── */
const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: "mock-binary-search",
    platform: "leetcode",
    problem_slug: "binary-search",
    problem_title: "Binary Search",
    language: "python3",
    verdict: "wrong_answer",
    submitted_at: new Date().toISOString(),
    analysed: true,
    code_snapshot: `def search(nums, target):
    low = 0
    high = len(nums) - 1
    
    while low <= high:
        mid = (low + high) // 2
        guess = nums[mid]
        
        if guess == target:
            return mid
        if guess > target:
            high = mid - 1
        else:
            low = mid + 1
            
    return -1 # Should return -1 but user code got stuck`,
    error_message: "Fails on target 9 in [1, 2, 3, 5, 6, 8, 9, 10, 11]. Loop boundary error.",
    failing_test_cases: [
      { input: 'nums = [1, 2, 3, 5, 6, 8, 9, 10, 11], target = 9', expected: '6', got: '7' }
    ],
    ai_analysis: {
      root_cause: "Index pointer off-by-one mismatch during binary split range reduction.",
      failure_category: "boundary_error",
      what_they_thought: "High pointer reduces by mid offset, but division indices overlap incorrectly.",
      what_is_actually_true: "The mid position needs careful reduction bounds. Floor division handles mid range offset.",
      code_evidence: "high = mid - 1 vs high = mid",
      fix_direction: "Adjust middle division limits and terminate strictly when bounds cross.",
      pattern_signal: "off_by_one_index",
      severity: "gap",
      repair_exercise: "Trace iterative lower/upper limits of Binary search."
    }
  },
  {
    id: "mock-two-sum",
    platform: "leetcode",
    problem_slug: "two-sum",
    problem_title: "Two Sum",
    language: "javascript",
    verdict: "accepted",
    submitted_at: new Date().toISOString(),
    analysed: true,
    code_snapshot: `function twoSum(nums, target) {
    const map = {};
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (complement in map) {
            return [map[complement], i];
        }
        map[nums[i]] = i;
    }
    return [];
}`,
    error_message: null,
    failing_test_cases: [],
    ai_analysis: {
      root_cause: "Single-pass hash table map successfully tracking indices.",
      failure_category: "accepted",
      what_they_thought: "Required nested loop lookup in O(N^2)",
      what_is_actually_true: "A hash map resolves lookup in O(1) time complexity.",
      code_evidence: "complement in map",
      fix_direction: "Excellent single pass usage.",
      pattern_signal: "hash_map_optimization",
      severity: "slip",
      repair_exercise: "Optimize spatial bounds of complement table."
    }
  },
  {
    id: "mock-valid-parentheses",
    platform: "leetcode",
    problem_slug: "valid-parentheses",
    problem_title: "Valid Parentheses (Stack)",
    language: "python3",
    verdict: "accepted",
    submitted_at: new Date().toISOString(),
    analysed: true,
    code_snapshot: `def isValid(s):
    stack = []
    mapping = {")": "(", "}": "{", "]": "["}
    
    for char in s:
        if char in mapping:
            top_element = stack.pop() if stack else '#'
            if mapping[char] != top_element:
                return False
        else:
            stack.append(char)
            
    return not stack`,
    error_message: null,
    failing_test_cases: [],
    ai_analysis: {
      root_cause: "Perfect stack usage for nested brackets checking.",
      failure_category: "accepted",
      what_they_thought: "Simple counting was enough.",
      what_is_actually_true: "Brackets need nested scoping, which requires a LIFO structure.",
      code_evidence: "stack.pop()",
      fix_direction: "Stack solves bracket matching in O(N) time and O(N) space.",
      pattern_signal: "stack_matching",
      severity: "habit",
      repair_exercise: "Trace characters pushing and popping from the stack."
    }
  },
  {
    id: "mock-reverse-linked-list",
    platform: "leetcode",
    problem_slug: "reverse-linked-list",
    problem_title: "Reverse Linked List (Linked List)",
    language: "python3",
    verdict: "accepted",
    submitted_at: new Date().toISOString(),
    analysed: true,
    code_snapshot: `def reverseList(head):
    prev = None
    curr = head
    
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
        
    return prev`,
    error_message: null,
    failing_test_cases: [],
    ai_analysis: {
      root_cause: "Classic in-place link reversal using three pointers.",
      failure_category: "accepted",
      what_they_thought: "Requires building a new list.",
      what_is_actually_true: "Adjusting references in-place provides O(1) space complexity.",
      code_evidence: "curr.next = prev",
      fix_direction: "Maintain next pointer reference to prevent losing the tail.",
      pattern_signal: "linked_list_pointer_manipulation",
      severity: "habit",
      repair_exercise: "Trace pointer transitions for 3 nodes."
    }
  },
  {
    id: "mock-unique-paths",
    platform: "leetcode",
    problem_slug: "unique-paths",
    problem_title: "Unique Paths (Matrix / DP)",
    language: "python3",
    verdict: "accepted",
    submitted_at: new Date().toISOString(),
    analysed: true,
    code_snapshot: `def uniquePaths(m, n):
    dp = [[1] * n for _ in range(m)]
    
    for r in range(1, m):
        for c in range(1, n):
            dp[r][c] = dp[r-1][c] + dp[r][c-1]
            
    return dp[m-1][n-1]`,
    error_message: null,
    failing_test_cases: [],
    ai_analysis: {
      root_cause: "Dynamic programming calculation over grid paths.",
      failure_category: "accepted",
      what_they_thought: "Compute paths recursively without caching.",
      what_is_actually_true: "A 2D matrix holds solved subproblems, reducing runtime to O(M * N).",
      code_evidence: "dp[r][c] = dp[r-1][c] + dp[r][c-1]",
      fix_direction: "Pre-initialize grid edges to 1 to seed bottom-up computation.",
      pattern_signal: "dynamic_programming_grid",
      severity: "habit",
      repair_exercise: "Step through row-by-row matrix calculation."
    }
  },
  {
    id: "mock-binary-tree-inorder",
    platform: "leetcode",
    problem_slug: "binary-tree-inorder-traversal",
    problem_title: "Tree Inorder Traversal (Tree)",
    language: "python3",
    verdict: "accepted",
    submitted_at: new Date().toISOString(),
    analysed: true,
    code_snapshot: `def inorderTraversal(root):
    res, stack = [], []
    curr = root
    
    while curr or stack:
        while curr:
            stack.append(curr)
            curr = curr.left
        curr = stack.pop()
        res.append(curr.val)
        curr = curr.right
        
    return res`,
    error_message: null,
    failing_test_cases: [],
    ai_analysis: {
      root_cause: "Iterative depth-first search (DFS) traversal.",
      failure_category: "accepted",
      what_they_thought: "Recursion is the only clean way.",
      what_is_actually_true: "An explicit stack mimics call recursion, maintaining traversal state.",
      code_evidence: "stack.append(curr)",
      fix_direction: "Trace inorder traversal left-node-right order systematically.",
      pattern_signal: "tree_traversal_dfs",
      severity: "habit",
      repair_exercise: "Trace stack push and pop during inorder walk."
    }
  }
];

function VisualizerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subId = searchParams.get("subId");
  const slug = searchParams.get("slug");

  const [selectedSubId, setSelectedSubId] = useState<string>(subId || "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1500); // ms per step
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active code line into view
  useEffect(() => {
    const step = traceSteps[currentStep];
    if (codeContainerRef.current && step) {
      const activeLineEl = codeContainerRef.current.querySelector(".active-code-line");
      if (activeLineEl) {
        activeLineEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentStep, traceSteps]);

  // Fetch submissions from API
  const { data: submissionsData } = useQuery({
    queryKey: ["submissions", { limit: 20 }],
    queryFn: () => api.listSubmissions({ limit: 20 }),
  });

  const submissionsList = submissionsData?.items || [];
  const allSubmissions = [...submissionsList, ...MOCK_SUBMISSIONS];
  const activeSubmission = allSubmissions.find((s) => s.id === selectedSubId) || allSubmissions[0];

  // Set default selection if none was active or handle slug parameter
  useEffect(() => {
    if (subId) {
      setSelectedSubId(subId);
    } else if (slug && allSubmissions.length > 0) {
      const match = allSubmissions.find(
        (s) => s.problem_slug?.toLowerCase() === slug.toLowerCase()
      );
      if (match) {
        setSelectedSubId(match.id);
      }
    } else if (activeSubmission && !selectedSubId) {
      setSelectedSubId(activeSubmission.id);
    }
  }, [subId, slug, submissionsData, selectedSubId]);

  // Generate trace steps when active submission changes
  useEffect(() => {
    if (!activeSubmission) return;

    const code = activeSubmission.code_snapshot || "";
    const slug = activeSubmission.problem_slug || "";
    const testCases = activeSubmission.failing_test_cases || [];

    // Topic detection
    const isBinarySearch = slug.includes("binary-search") || code.includes("low = 0") || code.includes("mid =");
    const isTwoSum = slug.includes("two-sum") || code.includes("complement =") || code.includes("map =");
    const isStack = slug.includes("parentheses") || slug.includes("stack") || code.includes("stack =") || code.includes("isValid");
    const isLinkedList = slug.includes("linked-list") || code.includes("curr.next") || code.includes("reverseList") || code.includes("ListNode") || code.includes("head");
    const isMatrix = slug.includes("unique-paths") || slug.includes("grid") || code.includes("dp = [") || code.includes("dp[r][c]") || code.includes("matrix");
    const isTree = slug.includes("tree") || code.includes("curr.left") || code.includes("TreeNode") || code.includes("inorder");

    let steps: TraceStep[] = [];

    if (isBinarySearch) {
      // Generate clean steps for Binary Search Simulation
      const nums = [1, 2, 3, 5, 6, 8, 9, 10, 11];
      const target = 9;
      
      steps = [
        {
          line: 2,
          explanation: "Initialize search bounds. low pointer starts at index 0.",
          variables: { low: 0, high: "null", mid: "null", target },
          stack: ["search(nums, target)"],
          pointers: { low: 0 },
          arrayData: nums,
          updatedVar: "low"
        },
        {
          line: 3,
          explanation: "high pointer starts at length of list - 1 (index 8).",
          variables: { low: 0, high: 8, mid: "null", target },
          stack: ["search(nums, target)"],
          pointers: { low: 0, high: 8 },
          arrayData: nums,
          updatedVar: "high"
        },
        {
          line: 5,
          explanation: "Loop check: low (0) <= high (8) is true. Enter search loop.",
          variables: { low: 0, high: 8, mid: "null", target },
          stack: ["search(nums, target)"],
          pointers: { low: 0, high: 8 },
          arrayData: nums
        },
        {
          line: 6,
          explanation: "Calculate mid index: (0 + 8) // 2 = index 4.",
          variables: { low: 0, high: 8, mid: 4, target },
          stack: ["search(nums, target)"],
          pointers: { low: 0, high: 8, mid: 4 },
          arrayData: nums,
          updatedVar: "mid"
        },
        {
          line: 7,
          explanation: "Fetch middle value guess = nums[4] (value 6).",
          variables: { low: 0, high: 8, mid: 4, guess: 6, target },
          stack: ["search(nums, target)"],
          pointers: { low: 0, high: 8, mid: 4 },
          arrayData: nums,
          updatedVar: "guess"
        },
        {
          line: 9,
          explanation: "Evaluate target comparison: guess (6) == target (9) is false.",
          variables: { low: 0, high: 8, mid: 4, guess: 6, target },
          stack: ["search(nums, target)"],
          pointers: { low: 0, high: 8, mid: 4 },
          arrayData: nums
        },
        {
          line: 11,
          explanation: "Evaluate bound check: guess (6) > target (9) is false. Move to else branch.",
          variables: { low: 0, high: 8, mid: 4, guess: 6, target },
          stack: ["search(nums, target)"],
          pointers: { low: 0, high: 8, mid: 4 },
          arrayData: nums
        },
        {
          line: 14,
          explanation: "Move low bound to mid + 1: low = 4 + 1 = 5.",
          variables: { low: 5, high: 8, mid: 4, guess: 6, target },
          stack: ["search(nums, target)"],
          pointers: { low: 5, high: 8 },
          arrayData: nums,
          updatedVar: "low"
        },
        {
          line: 5,
          explanation: "Loop check: low (5) <= high (8) is true. Continue binary search loop.",
          variables: { low: 5, high: 8, mid: 4, target },
          stack: ["search(nums, target)"],
          pointers: { low: 5, high: 8 },
          arrayData: nums
        },
        {
          line: 6,
          explanation: "Recalculate mid index: (5 + 8) // 2 = index 6.",
          variables: { low: 5, high: 8, mid: 6, target },
          stack: ["search(nums, target)"],
          pointers: { low: 5, high: 8, mid: 6 },
          arrayData: nums,
          updatedVar: "mid"
        },
        {
          line: 7,
          explanation: "Fetch middle value guess = nums[6] (value 9).",
          variables: { low: 5, high: 8, mid: 6, guess: 9, target },
          stack: ["search(nums, target)"],
          pointers: { low: 5, high: 8, mid: 6 },
          arrayData: nums,
          updatedVar: "guess"
        },
        {
          line: 9,
          explanation: "Evaluate target comparison: guess (9) == target (9) is true! Target index found.",
          variables: { low: 5, high: 8, mid: 6, guess: 9, target },
          stack: ["search(nums, target)"],
          pointers: { low: 5, high: 8, mid: 6 },
          arrayData: nums
        },
        {
          line: 10,
          explanation: "Successful execution! Return mid index (value 6).",
          variables: { low: 5, high: 8, mid: 6, guess: 9, target },
          stack: ["search(nums, target)"],
          pointers: { low: 5, high: 8, mid: 6 },
          arrayData: nums
        }
      ];
    } else if (isTwoSum) {
      // Two sum simulation
      const nums = [2, 7, 11, 15];
      const target = 9;

      steps = [
        {
          line: 2,
          explanation: "Initialize empty map to record numbers and their index positions.",
          variables: { map: {}, target },
          stack: ["twoSum(nums, target)"],
          arrayData: nums,
          updatedVar: "map"
        },
        {
          line: 3,
          explanation: "Start iteration loop: index i = 0 (value 2).",
          variables: { map: {}, i: 0, val: 2, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 0 },
          arrayData: nums,
          updatedVar: "i"
        },
        {
          line: 4,
          explanation: "Calculate target complement: 9 - nums[0] = 9 - 2 = 7.",
          variables: { map: {}, i: 0, val: 2, complement: 7, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 0 },
          arrayData: nums,
          updatedVar: "complement"
        },
        {
          line: 5,
          explanation: "Complement 7 check in map: not present. Skip return statement.",
          variables: { map: {}, i: 0, val: 2, complement: 7, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 0 },
          arrayData: nums
        },
        {
          line: 8,
          explanation: "Store value 2 in map with its index: map = { 2: 0 }.",
          variables: { map: { 2: 0 }, i: 0, val: 2, complement: 7, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 0 },
          arrayData: nums,
          updatedVar: "map"
        },
        {
          line: 3,
          explanation: "Increment index loop: i = 1 (value 7).",
          variables: { map: { 2: 0 }, i: 1, val: 7, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 1 },
          arrayData: nums,
          updatedVar: "i"
        },
        {
          line: 4,
          explanation: "Calculate target complement: 9 - nums[1] = 9 - 7 = 2.",
          variables: { map: { 2: 0 }, i: 1, val: 7, complement: 2, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 1 },
          arrayData: nums,
          updatedVar: "complement"
        },
        {
          line: 5,
          explanation: "Complement 2 check in map: present at index 0! Conditions met.",
          variables: { map: { 2: 0 }, i: 1, val: 7, complement: 2, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 1 },
          arrayData: nums
        },
        {
          line: 6,
          explanation: "Return indices: [map[2], 1] = [0, 1]. Success!",
          variables: { map: { 2: 0 }, i: 1, val: 7, complement: 2, target },
          stack: ["twoSum(nums, target)"],
          pointers: { i: 1 },
          arrayData: nums
        }
      ];
    } else if (isStack) {
      // Stack brackets simulation
      steps = [
        {
          line: 2,
          explanation: "Initialize an empty stack list to track opening brackets.",
          variables: { stack: [] },
          stack: ["isValid(s)"],
          stackData: [],
          updatedVar: "stack"
        },
        {
          line: 3,
          explanation: "Create lookup table mapping closing brackets to matching openers.",
          variables: { stack: [], mapping: {")": "(", "}": "{", "]": "["} },
          stack: ["isValid(s)"],
          stackData: [],
          updatedVar: "mapping"
        },
        {
          line: 5,
          explanation: "Begin checking input string '{[]}'. First character is '{'.",
          variables: { stack: [], char: "{" },
          stack: ["isValid(s)"],
          stackData: []
        },
        {
          line: 6,
          explanation: "Is '{' a closing bracket? No, it is not in mapping keys.",
          variables: { stack: [], char: "{" },
          stack: ["isValid(s)"],
          stackData: []
        },
        {
          line: 11,
          explanation: "Push opening bracket '{' onto the stack.",
          variables: { stack: ["{"], char: "{" },
          stack: ["isValid(s)"],
          stackData: ["{"],
          updatedVar: "stack"
        },
        {
          line: 5,
          explanation: "Next character in string is '['.",
          variables: { stack: ["{"], char: "[" },
          stack: ["isValid(s)"],
          stackData: ["{"]
        },
        {
          line: 6,
          explanation: "Is '[' a closing bracket? No, it is not in mapping keys.",
          variables: { stack: ["{"], char: "[" },
          stack: ["isValid(s)"],
          stackData: ["{"]
        },
        {
          line: 11,
          explanation: "Push opening bracket '[' onto the stack.",
          variables: { stack: ["{", "["], char: "[" },
          stack: ["isValid(s)"],
          stackData: ["{", "["],
          updatedVar: "stack"
        },
        {
          line: 5,
          explanation: "Next character in string is ']'.",
          variables: { stack: ["{", "["], char: "]" },
          stack: ["isValid(s)"],
          stackData: ["{", "["]
        },
        {
          line: 6,
          explanation: "Is ']' a closing bracket? Yes, it is in mapping keys. Proceeding to pop and verify match.",
          variables: { stack: ["{", "["], char: "]" },
          stack: ["isValid(s)"],
          stackData: ["{", "["]
        },
        {
          line: 7,
          explanation: "Pop top element of stack: stack.pop() -> '['.",
          variables: { stack: ["{"], char: "]", top_element: "[" },
          stack: ["isValid(s)"],
          stackData: ["{"],
          updatedVar: "top_element"
        },
        {
          line: 8,
          explanation: "Check: does popped opener '[' match required opener for ']'? Yes, mapping[']'] = '['.",
          variables: { stack: ["{"], char: "]", top_element: "[" },
          stack: ["isValid(s)"],
          stackData: ["{"]
        },
        {
          line: 5,
          explanation: "Next character in string is '}'.",
          variables: { stack: ["{"], char: "}" },
          stack: ["isValid(s)"],
          stackData: ["{"]
        },
        {
          line: 6,
          explanation: "Is '}' a closing bracket? Yes, in mapping keys.",
          variables: { stack: ["{"], char: "}" },
          stack: ["isValid(s)"],
          stackData: ["{"]
        },
        {
          line: 7,
          explanation: "Pop top element of stack: stack.pop() -> '{'.",
          variables: { stack: [], char: "}", top_element: "{" },
          stack: ["isValid(s)"],
          stackData: [],
          updatedVar: "top_element"
        },
        {
          line: 8,
          explanation: "Check: does popped opener '{' match required opener for '}'? Yes, mapping['}'] = '{'.",
          variables: { stack: [], char: "}", top_element: "{" },
          stack: ["isValid(s)"],
          stackData: []
        },
        {
          line: 13,
          explanation: "End of string reached. Verify if stack is empty. True. Return True (Valid).",
          variables: { stack: [] },
          stack: ["isValid(s)"],
          stackData: []
        }
      ];
    } else if (isLinkedList) {
      // Reverse Linked List simulation
      const initialNodes = [1, 2, 3];
      
      steps = [
        {
          line: 2,
          explanation: "Initialize prev to None. List is 1 -> 2 -> 3.",
          variables: { prev: "None", curr: "None" },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { head: 0, curr: null, prev: null },
          updatedVar: "prev"
        },
        {
          line: 3,
          explanation: "Set curr to head node (value 1).",
          variables: { prev: "None", curr: { val: 1 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { head: 0, curr: 0, prev: null },
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr is not None. Enter traversal loop.",
          variables: { prev: "None", curr: { val: 1 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { head: 0, curr: 0, prev: null }
        },
        {
          line: 6,
          explanation: "Store reference to next node: nxt = curr.next (value 2).",
          variables: { prev: "None", curr: { val: 1 }, nxt: { val: 2 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { head: 0, curr: 0, prev: null, nxt: 1 },
          updatedVar: "nxt"
        },
        {
          line: 7,
          explanation: "Reverse pointer connection: curr.next = prev (points 1 to None).",
          variables: { prev: "None", curr: { val: 1, next: null }, nxt: { val: 2 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { head: null, curr: 0, prev: null, nxt: 1, links: [{ from: 0, to: null }, { from: 1, to: 2 }] }
        },
        {
          line: 8,
          explanation: "Move prev to curr: prev = 1.",
          variables: { prev: { val: 1 }, curr: { val: 1 }, nxt: { val: 2 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 0, prev: 0, nxt: 1, links: [{ from: 0, to: null }, { from: 1, to: 2 }] },
          updatedVar: "prev"
        },
        {
          line: 9,
          explanation: "Move curr to next node: curr = nxt (value 2).",
          variables: { prev: { val: 1 }, curr: { val: 2 }, nxt: { val: 2 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 1, prev: 0, nxt: 1, links: [{ from: 0, to: null }, { from: 1, to: 2 }] },
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr (2) is not None. Continue loop.",
          variables: { prev: { val: 1 }, curr: { val: 2 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 1, prev: 0, links: [{ from: 0, to: null }, { from: 1, to: 2 }] }
        },
        {
          line: 6,
          explanation: "Store reference to next node: nxt = curr.next (value 3).",
          variables: { prev: { val: 1 }, curr: { val: 2 }, nxt: { val: 3 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 1, prev: 0, nxt: 2, links: [{ from: 0, to: null }, { from: 1, to: 2 }] },
          updatedVar: "nxt"
        },
        {
          line: 7,
          explanation: "Reverse connection: curr.next = prev (points 2 to 1).",
          variables: { prev: { val: 1 }, curr: { val: 2, next: 1 }, nxt: { val: 3 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 1, prev: 0, nxt: 2, links: [{ from: 0, to: null }, { from: 1, to: 0 }] }
        },
        {
          line: 8,
          explanation: "Move prev to curr: prev = 2.",
          variables: { prev: { val: 2 }, curr: { val: 2 }, nxt: { val: 3 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 1, prev: 1, nxt: 2, links: [{ from: 0, to: null }, { from: 1, to: 0 }] },
          updatedVar: "prev"
        },
        {
          line: 9,
          explanation: "Move curr to next node: curr = nxt (value 3).",
          variables: { prev: { val: 2 }, curr: { val: 3 }, nxt: { val: 3 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 2, prev: 1, nxt: 2, links: [{ from: 0, to: null }, { from: 1, to: 0 }] },
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr (3) is not None. Continue loop.",
          variables: { prev: { val: 2 }, curr: { val: 3 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 2, prev: 1, links: [{ from: 0, to: null }, { from: 1, to: 0 }] }
        },
        {
          line: 6,
          explanation: "Store reference to next node: nxt = curr.next (None).",
          variables: { prev: { val: 2 }, curr: { val: 3 }, nxt: "None" },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 2, prev: 1, nxt: null, links: [{ from: 0, to: null }, { from: 1, to: 0 }] },
          updatedVar: "nxt"
        },
        {
          line: 7,
          explanation: "Reverse connection: curr.next = prev (points 3 to 2).",
          variables: { prev: { val: 2 }, curr: { val: 3, next: 2 }, nxt: "None" },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 2, prev: 1, nxt: null, links: [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }] }
        },
        {
          line: 8,
          explanation: "Move prev to curr: prev = 3.",
          variables: { prev: { val: 3 }, curr: { val: 3 }, nxt: "None" },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: 2, prev: 2, nxt: null, links: [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }] },
          updatedVar: "prev"
        },
        {
          line: 9,
          explanation: "Move curr to next node: curr = nxt (None).",
          variables: { prev: { val: 3 }, curr: "None", nxt: "None" },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: null, prev: 2, nxt: null, links: [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }] },
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr is None. Terminate linked list traversal loop.",
          variables: { prev: { val: 3 }, curr: "None" },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { curr: null, prev: 2, links: [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }] }
        },
        {
          line: 11,
          explanation: "Reversal complete. Return prev pointer (head of reversed list: 3 -> 2 -> 1 -> None).",
          variables: { prev: { val: 3 } },
          stack: ["reverseList(head)"],
          linkedListData: initialNodes,
          pointers: { head: 2, curr: null, prev: 2, links: [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }] }
        }
      ];
    } else if (isMatrix) {
      // DP Unique Paths grid simulation
      const m = 3, n = 3;
      const emptyGrid = () => [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
      
      const stepGrid1 = emptyGrid();
      const stepGrid2 = emptyGrid(); stepGrid2[1][1] = 2;
      const stepGrid3 = emptyGrid(); stepGrid3[1][1] = 2; stepGrid3[1][2] = 3;
      const stepGrid4 = emptyGrid(); stepGrid4[1][1] = 2; stepGrid4[1][2] = 3; stepGrid4[2][1] = 3;
      const stepGrid5 = emptyGrid(); stepGrid5[1][1] = 2; stepGrid5[1][2] = 3; stepGrid5[2][1] = 3; stepGrid5[2][2] = 6;

      steps = [
        {
          line: 2,
          explanation: "Initialize dp grid size 3x3 with default values 1.",
          variables: { dp: emptyGrid() },
          stack: ["uniquePaths(3, 3)"],
          matrixData: emptyGrid(),
          updatedVar: "dp"
        },
        {
          line: 4,
          explanation: "Outer loop: row r = 1.",
          variables: { dp: emptyGrid(), r: 1 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: emptyGrid(),
          pointers: { r: 1 },
          updatedVar: "r"
        },
        {
          line: 5,
          explanation: "Inner loop: column c = 1.",
          variables: { dp: emptyGrid(), r: 1, c: 1 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: emptyGrid(),
          pointers: { r: 1, c: 1 },
          updatedVar: "c"
        },
        {
          line: 6,
          explanation: "Compute paths to grid[1][1] = grid[0][1] + grid[1][0] -> 1 + 1 = 2 paths.",
          variables: { dp: stepGrid2, r: 1, c: 1 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid2,
          pointers: { r: 1, c: 1 },
          updatedVar: "dp"
        },
        {
          line: 5,
          explanation: "Inner loop: column c = 2.",
          variables: { dp: stepGrid2, r: 1, c: 2 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid2,
          pointers: { r: 1, c: 2 },
          updatedVar: "c"
        },
        {
          line: 6,
          explanation: "Compute paths to grid[1][2] = grid[0][2] + grid[1][1] -> 1 + 2 = 3 paths.",
          variables: { dp: stepGrid3, r: 1, c: 2 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid3,
          pointers: { r: 1, c: 2 },
          updatedVar: "dp"
        },
        {
          line: 4,
          explanation: "Outer loop: row r = 2.",
          variables: { dp: stepGrid3, r: 2 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid3,
          pointers: { r: 2 },
          updatedVar: "r"
        },
        {
          line: 5,
          explanation: "Inner loop: column c = 1.",
          variables: { dp: stepGrid3, r: 2, c: 1 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid3,
          pointers: { r: 2, c: 1 },
          updatedVar: "c"
        },
        {
          line: 6,
          explanation: "Compute paths to grid[2][1] = grid[1][1] + grid[2][0] -> 2 + 1 = 3 paths.",
          variables: { dp: stepGrid4, r: 2, c: 1 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid4,
          pointers: { r: 2, c: 1 },
          updatedVar: "dp"
        },
        {
          line: 5,
          explanation: "Inner loop: column c = 2.",
          variables: { dp: stepGrid4, r: 2, c: 2 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid4,
          pointers: { r: 2, c: 2 },
          updatedVar: "c"
        },
        {
          line: 6,
          explanation: "Compute paths to grid[2][2] = grid[1][2] + grid[2][1] -> 3 + 3 = 6 paths.",
          variables: { dp: stepGrid5, r: 2, c: 2 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid5,
          pointers: { r: 2, c: 2 },
          updatedVar: "dp"
        },
        {
          line: 8,
          explanation: "Calculation complete. Return bottom-right corner dp[2][2] = 6 unique pathways.",
          variables: { dp: stepGrid5 },
          stack: ["uniquePaths(3, 3)"],
          matrixData: stepGrid5,
          pointers: { r: 2, c: 2 }
        }
      ];
    } else if (isTree) {
      // Binary Tree inorder traversal simulation
      const tree = {
        nodes: [
          { id: 1, val: 1, left: null, right: 2 },
          { id: 2, val: 2, left: 3, right: null },
          { id: 3, val: 3, left: null, right: null }
        ]
      };
      
      steps = [
        {
          line: 2,
          explanation: "Initialize empty result list res.",
          variables: { res: [], stack: [] },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          updatedVar: "res"
        },
        {
          line: 2,
          explanation: "Initialize empty traversal stack.",
          variables: { res: [], stack: [] },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          updatedVar: "stack"
        },
        {
          line: 3,
          explanation: "Set curr pointer to root node (value 1).",
          variables: { res: [], stack: [], curr: { val: 1 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 1,
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr is not None. Enter traversal loop.",
          variables: { res: [], stack: [], curr: { val: 1 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 1
        },
        {
          line: 6,
          explanation: "Inner loop check: curr is not None.",
          variables: { res: [], stack: [], curr: { val: 1 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 1
        },
        {
          line: 7,
          explanation: "Push current node 1 to recursion stack.",
          variables: { res: [], stack: [{ val: 1 }], curr: { val: 1 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [1],
          focusNode: 1,
          updatedVar: "stack"
        },
        {
          line: 8,
          explanation: "Move curr to left child: curr = curr.left (None).",
          variables: { res: [], stack: [{ val: 1 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [1],
          focusNode: null,
          updatedVar: "curr"
        },
        {
          line: 6,
          explanation: "Inner loop check: curr is None. Exit inner left-leaning loop.",
          variables: { res: [], stack: [{ val: 1 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [1],
          focusNode: null
        },
        {
          line: 9,
          explanation: "Pop node from stack: curr = stack.pop() (node 1).",
          variables: { res: [], stack: [], curr: { val: 1 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 1,
          updatedVar: "curr"
        },
        {
          line: 10,
          explanation: "Visit node: append value 1 to results list.",
          variables: { res: [1], stack: [], curr: { val: 1 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 1,
          updatedVar: "res"
        },
        {
          line: 11,
          explanation: "Move curr to right child: curr = curr.right (node 2).",
          variables: { res: [1], stack: [], curr: { val: 2 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 2,
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr (2) is not None. Re-enter loop.",
          variables: { res: [1], stack: [], curr: { val: 2 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 2
        },
        {
          line: 6,
          explanation: "Inner loop check: curr (2) is not None.",
          variables: { res: [1], stack: [], curr: { val: 2 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 2
        },
        {
          line: 7,
          explanation: "Push current node 2 to stack.",
          variables: { res: [1], stack: [{ val: 2 }], curr: { val: 2 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: 2,
          updatedVar: "stack"
        },
        {
          line: 8,
          explanation: "Move curr to left child: curr = curr.left (node 3).",
          variables: { res: [1], stack: [{ val: 2 }], curr: { val: 3 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: 3,
          updatedVar: "curr"
        },
        {
          line: 6,
          explanation: "Inner loop check: curr (3) is not None.",
          variables: { res: [1], stack: [{ val: 2 }], curr: { val: 3 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: 3
        },
        {
          line: 7,
          explanation: "Push current node 3 to stack.",
          variables: { res: [1], stack: [{ val: 2 }, { val: 3 }], curr: { val: 3 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2, 3],
          focusNode: 3,
          updatedVar: "stack"
        },
        {
          line: 8,
          explanation: "Move curr to left child: curr = curr.left (None).",
          variables: { res: [1], stack: [{ val: 2 }, { val: 3 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2, 3],
          focusNode: null,
          updatedVar: "curr"
        },
        {
          line: 6,
          explanation: "Inner loop check: curr is None. Exit inner loop.",
          variables: { res: [1], stack: [{ val: 2 }, { val: 3 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2, 3],
          focusNode: null
        },
        {
          line: 9,
          explanation: "Pop node from stack: curr = stack.pop() (node 3).",
          variables: { res: [1], stack: [{ val: 2 }], curr: { val: 3 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: 3,
          updatedVar: "curr"
        },
        {
          line: 10,
          explanation: "Visit node: append value 3 to results list.",
          variables: { res: [1, 3], stack: [{ val: 2 }], curr: { val: 3 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: 3,
          updatedVar: "res"
        },
        {
          line: 11,
          explanation: "Move curr to right child: curr = curr.right (None).",
          variables: { res: [1, 3], stack: [{ val: 2 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: null,
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: stack has [2], so loop continues.",
          variables: { res: [1, 3], stack: [{ val: 2 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: null
        },
        {
          line: 6,
          explanation: "Inner loop check: curr is None. Skip inner loop.",
          variables: { res: [1, 3], stack: [{ val: 2 }], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [2],
          focusNode: null
        },
        {
          line: 9,
          explanation: "Pop node from stack: curr = stack.pop() (node 2).",
          variables: { res: [1, 3], stack: [], curr: { val: 2 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 2,
          updatedVar: "curr"
        },
        {
          line: 10,
          explanation: "Visit node: append value 2 to results list.",
          variables: { res: [1, 3, 2], stack: [], curr: { val: 2 } },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: 2,
          updatedVar: "res"
        },
        {
          line: 11,
          explanation: "Move curr to right child: curr = curr.right (None).",
          variables: { res: [1, 3, 2], stack: [], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: null,
          updatedVar: "curr"
        },
        {
          line: 5,
          explanation: "Loop check: curr is None and stack is empty. Traversal complete.",
          variables: { res: [1, 3, 2], stack: [], curr: "None" },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: [],
          focusNode: null
        },
        {
          line: 13,
          explanation: "Return accumulated inorder results [1, 3, 2].",
          variables: { res: [1, 3, 2] },
          stack: ["inorderTraversal(root)"],
          treeData: tree,
          stackData: []
        }
      ];
    } else {
      // General/Generic logic simulation
      const lines = code.split("\n");
      const isDynamicStack = code.includes("stack") || code.includes("push") || code.includes("pop");
      const isDynamicLinkedList = code.includes("next") || code.includes("head") || code.includes("node");
      const isDynamicMatrix = code.includes("grid") || code.includes("matrix") || code.includes("dp = [[");
      const isDynamicTree = code.includes("left") || code.includes("right") || code.includes("root") || code.includes("tree");

      steps = lines.map((lineContent, idx) => {
        const lineNum = idx + 1;
        const cleanContent = lineContent.trim();
        
        let explanation = `Executing line ${lineNum}`;
        if (cleanContent.startsWith("def") || cleanContent.startsWith("function")) {
          explanation = "Function declared and frame pushed onto execution stack.";
        } else if (cleanContent.startsWith("while") || cleanContent.startsWith("for")) {
          explanation = "Evaluating loop conditional check.";
        } else if (cleanContent.startsWith("return")) {
          explanation = "Function termination. Returning result.";
        } else if (cleanContent.includes("=")) {
          const varName = cleanContent.split("=")[0].trim();
          explanation = `Assigning or updating state variable: "${varName}"`;
        }

        const baseVars = { i: idx, status: "active" };

        if (isDynamicMatrix) {
          const r = idx % 3;
          const c = (idx + 1) % 3;
          const dynamicGrid = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
          dynamicGrid[r][c] = idx + 2;
          return {
            line: lineNum,
            explanation,
            variables: { ...baseVars, r, c, grid: dynamicGrid },
            stack: [activeSubmission.problem_title || "solve()"],
            matrixData: dynamicGrid,
            pointers: { r, c },
            updatedVar: "grid"
          };
        } else if (isDynamicStack) {
          const stackList = Array.from({ length: (idx % 4) + 1 }, (_, k) => (k + 1) * 10);
          return {
            line: lineNum,
            explanation,
            variables: { ...baseVars, stack: stackList },
            stack: [activeSubmission.problem_title || "solve()"],
            stackData: stackList,
            updatedVar: "stack"
          };
        } else if (isDynamicLinkedList) {
          const nodes = [10, 20, 30, 40];
          const currIdx = idx % nodes.length;
          return {
            line: lineNum,
            explanation,
            variables: { ...baseVars, curr: nodes[currIdx] },
            stack: [activeSubmission.problem_title || "solve()"],
            linkedListData: nodes,
            pointers: { curr: currIdx, head: 0 },
            updatedVar: "curr"
          };
        } else if (isDynamicTree) {
          const tree = {
            nodes: [
              { id: 1, val: 10, left: 2, right: 3 },
              { id: 2, val: 20, left: null, right: null },
              { id: 3, val: 30, left: null, right: null }
            ]
          };
          const focus = (idx % 3) + 1;
          return {
            line: lineNum,
            explanation,
            variables: { ...baseVars, focusNode: focus },
            stack: [activeSubmission.problem_title || "solve()"],
            treeData: tree,
            focusNode: focus,
            updatedVar: "focusNode"
          };
        } else {
          // Fallback Array
          const values = [10, 20, 30, 45, 60];
          return {
            line: lineNum,
            explanation,
            variables: { ...baseVars, element: values[idx % values.length] },
            stack: [activeSubmission.problem_title || "solve()"],
            pointers: { index: idx % values.length },
            arrayData: values,
            updatedVar: "element"
          };
        }
      });
    }

    setTraceSteps(steps);
    setCurrentStep(0);
    setIsPlaying(false);
  }, [activeSubmission]);

  // Clean up active timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle step playback interval
  useEffect(() => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= traceSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, traceSteps.length, playbackSpeed]);

  const handleSubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedSubId(id);
    router.replace(`/visualizer?subId=${id}`);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    if (currentStep < traceSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleStepBackward = () => {
    setIsPlaying(false);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const activeStep = traceSteps[currentStep] || {
    line: 1,
    explanation: "Loading trace logs...",
    variables: {},
    stack: []
  };

  // Split lines of code for scrolling/highlighting views
  const codeLines = (activeSubmission?.code_snapshot || "").split("\n");

  return (
    <div className="w-full flex flex-col gap-6 relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border)]/30 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-primary)]/60 bg-clip-text text-transparent">
            Interactive Code Visualizer
          </h1>
          <p className="text-xs font-mono text-[var(--text-muted)]">
            Step-by-step memory, stack, and pointer tracker
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            Source Trace:
          </label>
          <div className="relative flex-1 md:flex-initial">
            <select
              value={selectedSubId}
              onChange={handleSubChange}
              className="w-full md:w-64 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-2 outline-none font-mono cursor-pointer hover:bg-white/[0.04] transition-all"
            >
              {allSubmissions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.problem_title} ({sub.verdict === "accepted" ? "AC" : "WA"} - {sub.language})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Pane - Code & Controls (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Code2 size={14} className="text-[var(--accent)]" />
            <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
              Source Code Snapshot
            </h2>
          </div>

          <PremiumCard className="p-0 overflow-hidden border-[var(--border)] bg-[#07070b]/60 flex flex-col min-h-[400px] max-h-[460px]">
            {/* Header file tags */}
            <div className="px-4 py-2 border-b border-[var(--border)]/40 bg-white/[0.01] flex justify-between items-center text-[10px] font-mono text-[var(--text-muted)]">
              <span>solution.{activeSubmission?.language === "python3" ? "py" : "js"}</span>
              <span className="text-[9px] uppercase font-bold text-[var(--accent)] border border-[var(--accent)]/30 rounded px-1.5 py-0.5 bg-[var(--accent)]/5">
                {activeSubmission?.language}
              </span>
            </div>

            {/* Syntax list */}
            <div ref={codeContainerRef} className="flex-1 overflow-y-auto font-mono text-[12px] py-4 leading-6 no-scrollbar">
              {codeLines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isActive = activeStep.line === lineNum;
                return (
                  <div
                    key={idx}
                    className={clsx(
                      "flex items-start w-full transition-all duration-150 border-l-2",
                      isActive
                        ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] font-semibold active-code-line"
                        : "border-transparent text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] hover:bg-white/[0.01]"
                    )}
                  >
                    <span className="w-10 text-right select-none pr-3 opacity-25 text-[10px] font-mono pt-0.5">
                      {lineNum}
                    </span>
                    <pre className="flex-1 whitespace-pre-wrap select-text pr-4 font-mono font-medium">
                      {lineText || " "}
                    </pre>
                  </div>
                );
              })}
            </div>
          </PremiumCard>

          {/* Stepper Controls Card */}
          <PremiumCard className="p-4 flex flex-col gap-4 border-[var(--border)] bg-[var(--surface)]/20">
            <div className="flex justify-between items-center text-[11px] font-mono text-[var(--text-muted)]">
              <span>Step {currentStep + 1} of {traceSteps.length || 1}</span>
              <div className="flex items-center gap-2">
                <Sliders size={11} />
                <span className="capitalize">{activeSubmission?.verdict.replace(/_/g, " ")} trace</span>
              </div>
            </div>

            {/* Slider bar progress */}
            <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${((currentStep + 1) / (traceSteps.length || 1)) * 100}%` }}
              />
            </div>

            {/* Stepper buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={handleStepBackward}
                  disabled={currentStep === 0}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-primary)]/80 disabled:opacity-30 disabled:hover:bg-white/5 flex items-center justify-center border border-[var(--border)]/40 transition-all"
                  title="Step Backward"
                >
                  <SkipBack size={12} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-4 h-8 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-alt)] text-black font-semibold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_var(--glow)] transition-all"
                >
                  {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                  <span>{isPlaying ? "Pause" : "Play"}</span>
                </button>
                <button
                  onClick={handleStepForward}
                  disabled={currentStep === traceSteps.length - 1}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-primary)]/80 disabled:opacity-30 disabled:hover:bg-white/5 flex items-center justify-center border border-[var(--border)]/40 transition-all"
                  title="Step Forward"
                >
                  <SkipForward size={12} />
                </button>
                <button
                  onClick={handleReset}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-primary)]/80 flex items-center justify-center border border-[var(--border)]/40 transition-all"
                  title="Reset trace"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              {/* Speed Controller */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">Speed:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="bg-[var(--surface)] text-[10px] font-mono text-[var(--text-primary)] border border-[var(--border)]/50 rounded px-1.5 py-1"
                >
                  <option value={2000}>0.5x</option>
                  <option value={1500}>1.0x</option>
                  <option value={800}>2.0x</option>
                  <option value={400}>3.0x</option>
                </select>
              </div>
            </div>
          </PremiumCard>
        </div>

        {/* Right Column - Visual Canvas & Variables (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Visualization Canvas */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[var(--accent)] animate-pulse" />
              <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono font-semibold">
                Memory Canvas & Data structures
              </h2>
            </div>

            <PremiumCard className="min-h-[220px] flex flex-col justify-center items-center border-[var(--border)] bg-[#07070b]/60 relative overflow-hidden">
              <div className="absolute top-3 left-3 flex items-center gap-2 text-[9px] font-mono text-[var(--text-muted)]/50 uppercase tracking-widest">
                <Cpu size={10} /> Active Visual Block
              </div>

              <div className="w-full flex flex-col items-center justify-center py-6 px-4">
                {activeStep.treeData ? (
                  <TreeVisualizer tree={activeStep.treeData} focusNode={activeStep.focusNode} />
                ) : activeStep.linkedListData ? (
                  <LinkedListVisualizer list={activeStep.linkedListData} pointers={activeStep.pointers} />
                ) : activeStep.matrixData ? (
                  <MatrixVisualizer matrix={activeStep.matrixData} pointers={activeStep.pointers} />
                ) : activeStep.stackData ? (
                  <StackVisualizer stack={activeStep.stackData} />
                ) : activeStep.queueData ? (
                  <QueueVisualizer queue={activeStep.queueData} />
                ) : activeStep.arrayData ? (
                  <div className="flex flex-col items-center gap-8 w-full">
                    {/* Array visualization */}
                    <div className="flex flex-wrap justify-center items-center gap-2 max-w-full">
                      {activeStep.arrayData.map((val, idx) => {
                        const matchedPointers = Object.entries(activeStep.pointers || {})
                          .filter(([name, pointerIdx]) => name !== "links" && pointerIdx === idx)
                          .map(([name, _]) => name);

                        const isMid = activeStep.pointers?.mid === idx;
                        const isIndex = activeStep.pointers?.index === idx;

                        const getPointerColor = (pName: string) => {
                          if (pName === "low" || pName === "left" || pName === "l") return "bg-emerald-500 text-black";
                          if (pName === "high" || pName === "right" || pName === "r") return "bg-rose-500 text-white";
                          if (pName === "mid" || pName === "m") return "bg-amber-500 text-black";
                          if (pName === "i") return "bg-blue-500 text-white";
                          if (pName === "j") return "bg-purple-500 text-white";
                          return "bg-slate-500 text-white";
                        };

                        return (
                          <div key={idx} className="flex flex-col items-center gap-2 relative">
                            {/* Pointer pointers floating above */}
                            <div className="h-6 flex items-end justify-center gap-0.5 text-[8px] font-bold font-mono">
                              {matchedPointers.filter(p => p !== "mid").map((pName) => (
                                <span
                                  key={pName}
                                  className={clsx(
                                    "px-1.5 py-0.5 rounded shadow text-[7.5px] uppercase font-bold",
                                    getPointerColor(pName)
                                  )}
                                >
                                  {pName.charAt(0)}
                                </span>
                              ))}
                            </div>

                            {/* Main Box */}
                            <motion.div
                              layout
                              className={clsx(
                                "w-11 h-11 rounded-lg flex flex-col items-center justify-center border font-mono text-xs font-semibold select-none shadow transition-all duration-300 relative",
                                isMid
                                  ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold scale-110 shadow-[0_0_12px_var(--glow)]"
                                  : isIndex
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                                  : matchedPointers.length > 0
                                  ? "border-[var(--accent)]/55 bg-[var(--surface)] text-[var(--text-primary)]"
                                  : "border-white/[0.05] bg-white/[0.02] text-[var(--text-primary)]/55"
                              )}
                            >
                              <span>{val}</span>
                            </motion.div>

                            {/* Mid Pointer label */}
                            <div className="h-4 text-[9px] font-mono font-bold text-[var(--accent)] select-none">
                              {isMid && <span>mid</span>}
                            </div>

                            {/* Array Index numbers below */}
                            <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-35">
                              {idx}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-[var(--text-muted)]/40 font-mono text-[11px] gap-2 flex flex-col items-center">
                    <Layers size={24} className="opacity-30" />
                    <span>Rendering state diagrams. Keep stepping.</span>
                  </div>
                )}
              </div>
            </PremiumCard>
          </div>

          {/* Variables and Explanations Pane */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Explanation card (7 cols) */}
            <div className="md:col-span-7 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Info size={13} className="text-[var(--accent)]" />
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                  State explanation
                </span>
              </div>
              <PremiumCard className="flex-1 p-5 min-h-[148px] bg-[var(--surface)]/10 border-[var(--border)]/40 flex flex-col justify-between">
                <p className="text-xs text-[var(--text-primary)]/90 leading-relaxed font-medium">
                  {activeStep.explanation}
                </p>
                <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.04] mt-2">
                  <Terminal size={10} className="text-[var(--text-muted)]/50" />
                  <span className="text-[9px] font-mono text-[var(--text-muted)]/60">
                    Call Stack: {activeStep.stack?.join(" > ") || "None"}
                  </span>
                </div>
              </PremiumCard>
            </div>

            {/* Variable Watch List (5 cols) */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sliders size={13} className="text-[var(--accent)]" />
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                  Watch values
                </span>
              </div>
              <PremiumCard className="p-4 bg-[var(--surface)]/10 border-[var(--border)]/40 flex flex-col gap-2 min-h-[148px] overflow-y-auto">
                <div className="flex flex-col gap-2 font-mono text-[11px]">
                  {Object.keys(activeStep.variables || {}).length > 0 ? (
                    Object.entries(activeStep.variables).map(([name, val]) => {
                      const isUpdated = activeStep.updatedVar === name;
                      return (
                        <div
                          key={name}
                          className={clsx(
                            "flex justify-between items-center p-1.5 rounded transition-all duration-300",
                            isUpdated ? "bg-[var(--accent)]/15 border border-[var(--accent)]/30" : "border border-transparent"
                          )}
                        >
                          <span className={clsx("font-semibold", isUpdated ? "text-[var(--accent)]" : "text-[var(--text-primary)]/70")}>
                            {name}
                          </span>
                          <span className={clsx("font-bold text-right truncate max-w-[120px]", isUpdated ? "text-[var(--accent)] scale-105" : "text-[var(--text-primary)]/90")}>
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-[var(--text-muted)]/30 italic">
                      No tracked variables in scope
                    </div>
                  )}
                </div>
              </PremiumCard>
            </div>

          </div>

          {/* AI Coach Insights on this submission */}
          {activeSubmission?.ai_analysis && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-[var(--warning)]" />
                <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">
                  Diagnostics on failure
                </h3>
              </div>
              <PremiumCard className="p-5 border-[var(--warning)]/20 bg-gradient-to-br from-[var(--warning)]/5 to-transparent flex flex-col gap-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-[var(--warning)]" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Friction Sign: {activeSubmission.ai_analysis.failure_category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20 uppercase tracking-widest">
                    {activeSubmission.ai_analysis.severity}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-1 border-t border-[var(--warning)]/10 pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-rose-400 font-mono text-[9px] uppercase tracking-wider">
                      Incorrect Assumption:
                    </span>
                    <p className="text-[11.5px] text-[var(--text-primary)]/80 italic leading-relaxed">
                      "{activeSubmission.ai_analysis.what_they_thought}"
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-emerald-400 font-mono text-[9px] uppercase tracking-wider">
                      Optimal Reality:
                    </span>
                    <p className="text-[11.5px] text-[var(--text-primary)]/80 italic leading-relaxed">
                      "{activeSubmission.ai_analysis.what_is_actually_true}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 pt-3 border-t border-white/[0.04]">
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">
                    Evidence: <code className="bg-white/5 px-1 rounded text-[var(--text-primary)]">{activeSubmission.ai_analysis.code_evidence}</code>
                  </span>
                  <a
                    href={`/chat?problem=${activeSubmission.problem_slug}`}
                    className="text-[10px] font-mono text-[var(--accent)] hover:text-[var(--accent-alt)] font-semibold flex items-center gap-1"
                  >
                    Discuss fix details with Coach <ChevronRight size={10} />
                  </a>
                </div>
              </PremiumCard>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function VisualizerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
        <span className="text-xs font-mono text-[var(--text-muted)] animate-pulse">Initializing Visualization Engine...</span>
      </div>
    }>
      <VisualizerContent />
    </Suspense>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Premium Data Structure Visualizers
   ───────────────────────────────────────────────────────────────────────────── */

function MatrixVisualizer({ matrix, pointers }: { matrix: any[][]; pointers?: Record<string, any> }) {
  // Find row/col pointers
  const activeRow = pointers?.r !== undefined ? pointers.r : (pointers?.row !== undefined ? pointers.row : pointers?.i);
  const activeCol = pointers?.c !== undefined ? pointers.c : (pointers?.col !== undefined ? pointers.col : pointers?.j);

  return (
    <div className="flex flex-col items-center gap-2 max-w-full overflow-x-auto py-2">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${matrix[0]?.length || 0}, minmax(3.25rem, 1fr))` }}>
        {/* Header row: col indices */}
        <div className="h-6 w-8" />
        {matrix[0]?.map((_, colIdx) => (
          <div key={colIdx} className="text-[10px] font-mono text-center text-[var(--text-muted)] opacity-50 select-none">
            c{colIdx}
          </div>
        ))}

        {matrix.map((row, rowIdx) => (
          <React.Fragment key={rowIdx}>
            {/* Row index label */}
            <div className="text-[10px] font-mono pr-2 flex items-center justify-end text-[var(--text-muted)] opacity-50 select-none h-12 w-8">
              r{rowIdx}
            </div>

            {row.map((val, colIdx) => {
              const isActive = activeRow === rowIdx && activeCol === colIdx;
              const isRowBorder = activeRow === rowIdx;
              const isColBorder = activeCol === colIdx;

              return (
                <motion.div
                  key={colIdx}
                  layout
                  className={clsx(
                    "h-12 w-12 rounded-lg flex flex-col items-center justify-center border font-mono text-xs font-semibold select-none shadow transition-all duration-300 relative",
                    isActive
                      ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold scale-105 shadow-[0_0_12px_var(--glow)] z-10"
                      : isRowBorder || isColBorder
                      ? "border-[var(--accent)]/30 bg-[var(--surface)]/20 text-[var(--text-primary)]"
                      : "border-white/[0.05] bg-white/[0.02] text-[var(--text-primary)]/50"
                  )}
                >
                  <span className="text-xs">{val === null || val === undefined ? "0" : String(val)}</span>
                  {isActive && (
                    <span className="absolute bottom-0.5 text-[6.5px] font-mono uppercase text-black/60 font-bold">
                      active
                    </span>
                  )}
                </motion.div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function StackVisualizer({ stack }: { stack: any[] }) {
  return (
    <div className="flex flex-col items-center justify-end h-56 w-full py-2">
      <div className="relative flex flex-col-reverse gap-1.5 border-b-4 border-x-2 border-[var(--accent)]/30 rounded-b-xl px-4 pb-2 pt-6 w-40 min-h-[140px] bg-white/[0.01]">
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-[var(--text-muted)] opacity-30 select-none uppercase tracking-widest">
          Stack (LIFO)
        </span>
        
        {stack.length > 0 ? (
          stack.map((val, idx) => {
            const isTop = idx === stack.length - 1;
            const displayVal = typeof val === 'object' ? (val.val !== undefined ? val.val : JSON.stringify(val)) : String(val);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={clsx(
                  "h-10 rounded-lg flex items-center justify-center font-mono text-xs font-semibold select-none shadow border w-full relative",
                  isTop
                    ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold shadow-[0_0_10px_var(--glow)]"
                    : "border-white/[0.05] bg-[#393E46]/20 text-[var(--text-primary)]/80"
                )}
              >
                <span>{displayVal}</span>
                {isTop && (
                  <span className="absolute -right-14 text-[9px] font-mono font-bold text-[var(--accent)] select-none animate-pulse">
                    ◀ TOP
                  </span>
                )}
              </motion.div>
            );
          })
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[var(--text-muted)]/30 italic">
            Stack is empty
          </div>
        )}
      </div>
    </div>
  );
}

function QueueVisualizer({ queue }: { queue: any[] }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 w-full py-4">
      <div className="relative flex items-center gap-1.5 border-y-2 border-dashed border-[var(--accent)]/30 px-6 py-4 w-full max-w-[420px] min-h-[72px] bg-white/[0.01] rounded-lg">
        <span className="absolute top-1 left-4 text-[8px] font-mono text-[var(--text-muted)] opacity-30 select-none uppercase tracking-widest">
          Queue (FIFO)
        </span>
        
        <div className="absolute -left-6 text-[8px] font-mono text-emerald-400 font-bold flex flex-col items-center animate-pulse">
          <span>In</span>
          <span>➜</span>
        </div>
        <div className="absolute -right-6 text-[8px] font-mono text-rose-400 font-bold flex flex-col items-center animate-pulse">
          <span>Out</span>
          <span>➜</span>
        </div>

        <div className="flex-1 flex justify-center gap-1.5 overflow-x-auto no-scrollbar">
          {queue.length > 0 ? (
            queue.map((val, idx) => {
              const isFront = idx === 0;
              const isRear = idx === queue.length - 1;
              const displayVal = typeof val === 'object' ? (val.val !== undefined ? val.val : JSON.stringify(val)) : String(val);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={clsx(
                    "h-12 w-12 rounded-lg flex flex-col items-center justify-center font-mono text-xs font-semibold select-none shadow border relative shrink-0",
                    isFront
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-400 font-bold"
                      : isRear
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold"
                      : "border-white/[0.05] bg-[#393E46]/20 text-[var(--text-primary)]/80"
                  )}
                >
                  <span>{displayVal}</span>
                  {isFront && (
                    <span className="absolute -top-5 text-[8px] font-mono font-bold text-rose-400 uppercase select-none">
                      Front
                    </span>
                  )}
                  {isRear && (
                    <span className="absolute -bottom-5 text-[8px] font-mono font-bold text-emerald-400 uppercase select-none">
                      Rear
                    </span>
                  )}
                </motion.div>
              );
            })
          ) : (
            <div className="text-[10px] font-mono text-[var(--text-muted)]/30 italic">
              Queue is empty
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkedListVisualizer({ list, pointers }: { list: any[]; pointers?: Record<string, any> }) {
  const getPointersForNode = (val: any, idx: number) => {
    if (!pointers) return [];
    return Object.entries(pointers)
      .filter(([name, value]) => {
        if (name === "links") return false;
        return value === idx || value === val || (value && typeof value === 'object' && value.val === val);
      })
      .map(([name, _]) => name);
  };

  const getPointerColor = (pName: string) => {
    if (pName === "head") return "bg-emerald-500 text-black";
    if (pName === "curr") return "bg-[var(--accent)] text-black";
    if (pName === "prev") return "bg-rose-500 text-white";
    if (pName === "nxt" || pName === "next_node" || pName === "next") return "bg-blue-500 text-white";
    return "bg-slate-500 text-white";
  };

  const links = pointers?.links || [];
  
  return (
    <div className="flex flex-col items-center justify-center py-4 w-full overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 px-6 min-h-[96px]">
        {list.length > 0 ? (
          list.map((nodeVal, idx) => {
            const isLast = idx === list.length - 1;
            const nodePointers = getPointersForNode(nodeVal, idx);
            
            let linkDirection: "next" | "prev" | "null" = "next";
            if (links.length > 0) {
              const currentLink = links.find((l: any) => l.from === idx);
              if (currentLink) {
                if (currentLink.to === null) {
                  linkDirection = "null";
                } else if (currentLink.to < idx) {
                  linkDirection = "prev";
                } else {
                  linkDirection = "next";
                }
              }
            }

            return (
              <div key={idx} className="flex items-center gap-1.5 shrink-0">
                <div className="flex flex-col items-center gap-1.5 relative">
                  {/* Floating pointers */}
                  <div className="h-6 flex items-end justify-center gap-0.5 text-[8px] font-bold font-mono">
                    {nodePointers.map((pName) => (
                      <span
                        key={pName}
                        className={clsx(
                          "px-1.5 py-0.5 rounded shadow-sm text-[7.5px] uppercase font-bold",
                          getPointerColor(pName)
                        )}
                      >
                        {pName}
                      </span>
                    ))}
                  </div>

                  {/* Node Capsule */}
                  <motion.div
                    layout
                    className={clsx(
                      "flex rounded-lg border overflow-hidden font-mono text-xs font-semibold select-none shadow transition-all duration-300",
                      nodePointers.includes("curr")
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 scale-105 shadow-[0_0_12px_var(--glow)]"
                        : "border-white/[0.05] bg-white/[0.02]"
                    )}
                  >
                    <div className="px-3 py-2 text-[var(--text-primary)] border-r border-white/[0.05] bg-white/[0.01]">
                      {String(nodeVal)}
                    </div>
                    <div className="px-2 py-2 text-[var(--text-muted)] opacity-50 flex items-center justify-center text-[9px] w-8">
                      {linkDirection === "null" ? "null" : "ptr"}
                    </div>
                  </motion.div>

                  <span className="text-[8px] font-mono text-[var(--text-muted)] opacity-25">
                    idx {idx}
                  </span>
                </div>

                {/* Connecting Arrow */}
                {!isLast && linkDirection === "next" && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center text-[var(--accent)] opacity-60 text-sm select-none px-0.5 font-bold"
                  >
                    ➜
                  </motion.div>
                )}
                {!isLast && linkDirection === "prev" && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center text-rose-400 opacity-60 text-sm select-none px-0.5 font-bold"
                  >
                    ◀
                  </motion.div>
                )}
                {isLast && linkDirection === "null" && (
                  <div className="flex items-center text-[var(--text-muted)] opacity-20 text-sm select-none px-0.5 font-bold">
                    ➜
                    <span className="text-[8px] font-mono pl-1 text-[var(--text-muted)]">NULL</span>
                  </div>
                )}
                {!isLast && linkDirection === "null" && (
                  <div className="flex items-center text-[var(--text-muted)] opacity-20 text-sm select-none px-0.5 font-bold">
                    ⤏
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-[10px] font-mono text-[var(--text-muted)]/30 italic">
            List is empty
          </div>
        )}
      </div>
    </div>
  );
}

function TreeVisualizer({ tree, focusNode }: { tree: any; focusNode?: string | number | null }) {
  const nodes = tree?.nodes || [
    { id: 1, val: 1, x: 200, y: 30 },
    { id: 2, val: 2, x: 270, y: 90 },
    { id: 3, val: 3, x: 210, y: 150 }
  ];

  const lines = [
    { fromX: 200, fromY: 30 + 14, toX: 270, toY: 90 - 14 },
    { fromX: 270, fromY: 90 + 14, toX: 210, toY: 150 - 14 }
  ];

  return (
    <div className="relative w-[480px] h-[190px] bg-white/[0.01] rounded-xl border border-white/[0.03] overflow-hidden flex items-center justify-center py-2">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {lines.map((line, idx) => (
          <line
            key={idx}
            x1={line.fromX}
            y1={line.fromY}
            x2={line.toX}
            y2={line.toY}
            stroke="rgba(0,173,181,0.25)"
            strokeWidth={1.5}
            strokeDasharray={idx === 1 ? "3,3" : undefined}
          />
        ))}
      </svg>

      {nodes.map((node: any) => {
        const isFocused = focusNode === node.id || (focusNode && typeof focusNode === 'object' && (focusNode as any).val === node.val);
        return (
          <motion.div
            key={node.id}
            layout
            style={{ left: node.x - 14, top: node.y - 14 }}
            className="absolute"
          >
            <div
              className={clsx(
                "h-8 w-8 rounded-full border flex items-center justify-center font-mono text-xs font-semibold select-none shadow transition-all duration-300 relative",
                isFocused
                  ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold scale-110 shadow-[0_0_12px_var(--glow)] animate-pulse"
                  : "border-white/[0.05] bg-[#07070b]/60 text-[var(--text-primary)]/80"
              )}
            >
              {node.val}
              {isFocused && (
                <span className="absolute -top-4 text-[7px] font-mono uppercase bg-[var(--accent)] text-black px-1 rounded font-bold">
                  curr
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
