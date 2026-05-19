# 🎨 Next.js Dashboard - LeetCode AI Coaching Platform

## Overview
I need a production-grade **Next.js 14 dashboard** (App Router) for my LeetCode AI coaching platform. The dashboard should beautifully visualize user progress, AI insights, code errors, pattern mistakes, revision queues, and analytics with real-time updates.

---

## 🎯 Core Requirements

### **Tech Stack**
- **Next.js 14** (App Router, Server Components, Server Actions)
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** components
- **Framer Motion** for animations
- **Recharts** or **Chart.js** for visualizations
- **React Query (TanStack Query)** for data fetching
- **Zustand** for global state management
- **Socket.io-client** for real-time updates (optional)
- **Monaco Editor** or **CodeMirror** for code viewing
- **Prism.js** for syntax highlighting

### **Design Principles**
- Modern, clean, developer-focused aesthetic
- Dark mode + light mode support
- Responsive (mobile, tablet, desktop)
- Fast performance (target < 2s initial load)
- Accessibility (WCAG 2.1 AA compliant)
- Error boundaries for graceful failures

---

## 📊 Dashboard Pages & Features

### **1. Home Dashboard (`/dashboard`)**

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: Welcome back, [Name] | Streak: 🔥 12 days      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Problems     │  │ Accuracy     │  │ Current      │  │
│  │ Solved Today │  │ Rate         │  │ Streak       │  │
│  │     8        │  │    76%       │  │  12 days     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Daily Intelligence Report (AI-Generated)         │   │
│  │ ✓ Great progress on graphs today (+15%)          │   │
│  │ ⚠ 3 recurring mistakes in recursion base cases   │   │
│  │ 📚 Revision overdue: Dynamic Programming (12d)   │   │
│  │ 💡 Suggested focus: Sliding Window (avoidance)   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ Topic Strength      │  │ Recent Activity         │  │
│  │ (Radar Chart)       │  │ (Timeline)              │  │
│  │                     │  │ • Solved Two Sum        │  │
│  │    Graphs: 82       │  │   2 hours ago           │  │
│  │    DP: 41 ⚠️        │  │ • Failed LRU Cache      │  │
│  │    Binary: 76       │  │   5 hours ago           │  │
│  └─────────────────────┘  └─────────────────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Revision Queue (Next 5 problems)                 │   │
│  │ 1. Longest Increasing Subsequence (DP) Priority:9│   │
│  │ 2. Detect Cycle in Graph (Graphs) Priority: 8    │   │
│  │ 3. Binary Search Template (Binary) Priority: 7   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
// Stats Cards
<StatsCard 
  title="Problems Solved Today"
  value={8}
  trend="+3 from yesterday"
  icon={<CheckCircle />}
/>

// Daily Intelligence Report (AI-generated)
<IntelligenceReport 
  achievements={[...]}
  warnings={[...]}
  recommendations={[...]}
  date={new Date()}
/>

// Topic Strength Radar Chart
<TopicRadarChart 
  data={[
    { topic: 'Graphs', score: 82 },
    { topic: 'DP', score: 41 },
    { topic: 'Binary Search', score: 76 },
    // ...
  ]}
/>

// Recent Activity Timeline
<ActivityTimeline 
  activities={[
    { type: 'solved', problem: 'Two Sum', time: '2h ago' },
    { type: 'failed', problem: 'LRU Cache', time: '5h ago' },
  ]}
/>

// Revision Queue Preview
<RevisionQueuePreview 
  queue={[...]}
  onStartProblem={(id) => router.push(`/problems/${id}`)}
/>
```

---

### **2. Submissions Page (`/dashboard/submissions`)**

**Features:**
- **List View**: Table with filters (status, difficulty, topic, date range)
- **Card View**: Visual cards with code preview
- **Inline Code Viewer**: Click to expand and see full code
- **AI Analysis Badge**: Show if analysis is complete
- **Search**: By problem name or ID
- **Export**: Download submissions as CSV

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Submissions (428 total)                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ Filter  │ │ Sort    │ │ Search  │                   │
│  └─────────┘ └─────────┘ └─────────┘                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ ✅ Two Sum (Easy) · Arrays, Hash Table          │     │
│  │ Submitted 2 hours ago · Runtime: 48ms · 91%    │     │
│  │ [View Code] [AI Analysis] [See Evolution]      │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ ❌ LRU Cache (Medium) · Design, Hash, DLL       │     │
│  │ Submitted 5 hours ago · Wrong Answer           │     │
│  │ [View Code] [See Errors] [AI Review]           │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  Pagination: [1] [2] [3] ... [43]                       │
└─────────────────────────────────────────────────────────┘
```

**Key Components:**
```tsx
<SubmissionCard
  submission={{
    id: '...',
    problem: 'Two Sum',
    difficulty: 'easy',
    status: 'accepted',
    runtime: 48,
    memory: 15.2,
    language: 'python',
    submittedAt: '2 hours ago',
    topics: ['Arrays', 'Hash Table']
  }}
  onViewCode={() => {}}
  onViewAnalysis={() => {}}
/>

<SubmissionFilters
  filters={filters}
  onFilterChange={setFilters}
/>

<SubmissionTable
  submissions={submissions}
  loading={loading}
  onRowClick={handleRowClick}
/>
```

---

### **3. Code Viewer & Error Analysis (`/dashboard/submissions/[id]`)**

**This is the STAR FEATURE - where users see AI-powered error analysis**

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  LRU Cache (Medium) · Wrong Answer                      │
│  Submitted 5 hours ago · Attempt #3                     │
├───────────────────┬─────────────────────────────────────┤
│                   │                                      │
│  Code Editor      │  AI Analysis Panel                  │
│  (Read-only)      │                                      │
│                   │  📊 Analysis Summary                 │
│  1  class LRU:    │  Status: Wrong Answer                │
│  2    def __init  │  Time: O(n) → Should be O(1)        │
│  3      self.cap  │  Space: O(n) ✓                      │
│  4      self.cach │                                      │
│  5                │  🐛 Logical Errors (2)               │
│  6    def get(k): │  Line 12: Missing cache update       │
│  7      if k not  │           after get() operation      │
│  8        return  │  Line 18: Order not maintained       │
│  9      # BUG ⚠️  │           in doubly-linked list      │
│ 10      return .. │                                      │
│ 11                │  🔁 Pattern Mistakes (1)             │
│ 12    def put():  │  Missing OrderedDict usage           │
│ 13      ...       │  (You've done this 3 times in        │
│                   │   design problems)                   │
│  [Line highlights │                                      │
│   for errors]     │  ✨ Better Approach                  │
│                   │  Use collections.OrderedDict         │
│                   │  [Show Refactored Code]              │
│                   │                                      │
│                   │  📚 Learning Resources               │
│                   │  • LRU Cache explained               │
│                   │  • OrderedDict vs manual DLL         │
│                   │                                      │
└───────────────────┴─────────────────────────────────────┘
```

**Key Features:**
1. **Split-pane view**: Code on left, AI analysis on right
2. **Line highlighting**: Errors highlighted in code editor
3. **Inline annotations**: Hover over highlighted lines for tooltips
4. **Error categories**: 
   - 🐛 Logical Errors
   - 🔤 Syntax Issues
   - 🔁 Pattern Mistakes (recurring)
   - ⚡ Complexity Issues
   - 🎯 Edge Cases Missed
5. **Refactored code viewer**: Show optimized version
6. **Code diff**: Compare original vs refactored
7. **Execution trace**: Step-by-step what went wrong
8. **Test cases**: Show which test cases failed

**Components:**
```tsx
<CodeViewer
  code={submission.code}
  language={submission.language}
  errors={aiAnalysis.errors}
  highlights={[
    { line: 9, type: 'error', message: 'Missing cache update' },
    { line: 18, type: 'warning', message: 'Order not maintained' }
  ]}
  readOnly={true}
/>

<AIAnalysisPanel
  analysis={{
    logicalErrors: [...],
    patternMistakes: [...],
    syntaxIssues: [...],
    complexityAnalysis: {...},
    edgeCasesMissed: [...],
    betterApproach: "...",
    refactoredCode: "...",
    confidence: 0.92
  }}
  onShowRefactored={() => {}}
  onShowDiff={() => {}}
/>

<ErrorAnnotation
  line={9}
  type="logical"
  severity="high"
  message="Missing cache update after get() operation"
  suggestion="Add: self.cache.move_to_end(key)"
  patternId="cache-update-missing"
  occurrences={3}
/>

<CodeDiffViewer
  original={originalCode}
  refactored={refactoredCode}
  language="python"
  highlights={changes}
/>

<TestCaseResults
  testCases={[
    { input: '[["get",1]]', expected: '-1', actual: 'null', passed: false },
    { input: '[["put",1,1]]', expected: 'null', actual: 'null', passed: true }
  ]}
/>
```

**Error Visualization Patterns:**
```tsx
// Error badge with severity color
<ErrorBadge severity="high">Logical Error</ErrorBadge>

// Inline error tooltip
<Tooltip content={errorDetails}>
  <span className="underline-error">self.cache[key]</span>
</Tooltip>

// Error summary card
<ErrorSummaryCard
  title="Missing Cache Update"
  description="After retrieving a value with get(), you forgot to mark it as recently used"
  line={9}
  severity="high"
  pattern="cache-operations"
  occurrences={3}
  suggestion="Always call move_to_end() after accessing cached items"
/>

// Pattern mistake indicator
<PatternBadge count={3}>
  You've made this mistake 3 times in design problems
</PatternBadge>
```

---

### **4. Pattern Analysis Page (`/dashboard/patterns`)**

**Purpose**: Show all recurring mistakes across submissions

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Pattern Mistakes Detected: 12                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  🔴 Critical (3)  🟡 Medium (5)  🟢 Low (4)             │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ 🔴 Off-by-One Errors                            │     │
│  │ Detected 8 times across 6 problems              │     │
│  │ Topics: Arrays, Binary Search, Strings          │     │
│  │                                                  │     │
│  │ Common in:                                       │     │
│  │ • Loop boundaries (5 times)                     │     │
│  │ • Array indexing (3 times)                      │     │
│  │                                                  │     │
│  │ Last seen: 2 days ago in "Find Peak Element"   │     │
│  │                                                  │     │
│  │ [View Examples] [Practice Problems] [Mark Fixed]│     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ 🟡 Missing Base Case in Recursion               │     │
│  │ Detected 5 times across 4 problems              │     │
│  │ Topics: DP, Trees, Backtracking                 │     │
│  │                                                  │     │
│  │ Examples:                                        │     │
│  │ • Fibonacci (forgot n=0 case)                   │     │
│  │ • Tree traversal (forgot null check)            │     │
│  │                                                  │     │
│  │ [View Details] [See Code] [Get Practice Set]   │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
<PatternCard
  pattern={{
    id: '...',
    type: 'off_by_one',
    category: 'logical',
    severity: 'high',
    occurrences: 8,
    affectedProblems: 6,
    topics: ['Arrays', 'Binary Search'],
    commonIn: ['Loop boundaries', 'Array indexing'],
    lastSeen: '2 days ago',
    examples: [...],
    isResolved: false
  }}
  onViewExamples={() => {}}
  onGetPractice={() => {}}
  onMarkFixed={() => {}}
/>

<PatternTimeline
  patterns={patterns}
  dateRange={[startDate, endDate]}
/>

<PatternHeatmap
  data={[
    { date: '2024-01-01', count: 3 },
    { date: '2024-01-02', count: 1 },
    // ...
  ]}
/>
```

---

### **5. Code Evolution Viewer (`/dashboard/submissions/[id]/evolution`)**

**Purpose**: Show how code improved across multiple attempts

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  LRU Cache - Code Evolution (4 attempts)                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Timeline:                                               │
│  [v1] ────> [v2] ────> [v3] ────> [v4]                 │
│  Initial   Buggy     Fixed      Optimized               │
│  ❌ WA     ❌ TLE    ✅ AC       ✅ AC (faster)         │
│                                                           │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Version 1       │  │ Version 4       │              │
│  │ (Initial)       │  │ (Optimized)     │              │
│  │                 │  │                 │              │
│  │ class LRU:      │  │ from collections│              │
│  │   def __init    │  │ import OrderedD │              │
│  │     self.cache= │  │                 │              │
│  │     self.cap =  │  │ class LRU:      │              │
│  │                 │  │   def __init    │              │
│  │   def get(k):   │  │     self.cache= │              │
│  │     # manual    │  │     self.cap =  │              │
│  │     # O(n) ❌   │  │   def get(k):   │              │
│  │                 │  │     # O(1) ✅   │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                           │
│  Improvements:                                           │
│  v1 → v2: Fixed null pointer bug                        │
│  v2 → v3: Corrected update order                        │
│  v3 → v4: Used OrderedDict (O(n) → O(1))               │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
<CodeEvolutionTimeline
  versions={[
    { version: 1, stage: 'initial', status: 'wrong_answer', timestamp: '...' },
    { version: 2, stage: 'buggy', status: 'tle', timestamp: '...' },
    { version: 3, stage: 'fixed', status: 'accepted', timestamp: '...' },
    { version: 4, stage: 'optimized', status: 'accepted', timestamp: '...' }
  ]}
  onSelectVersion={(v) => {}}
/>

<CodeComparisonView
  leftCode={version1Code}
  rightCode={version4Code}
  leftLabel="Version 1 (Initial)"
  rightLabel="Version 4 (Optimized)"
  improvements={[
    { from: 1, to: 2, description: 'Fixed null pointer' },
    { from: 2, to: 3, description: 'Corrected update order' },
    { from: 3, to: 4, description: 'Used OrderedDict (O(n) → O(1))' }
  ]}
/>
```

---

### **6. Analytics Page (`/dashboard/analytics`)**

**Features:**
- Accuracy heatmap (calendar view)
- Topic performance radar chart
- Complexity progression graph
- Solve time trends
- Retry intelligence
- Confidence vs performance

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Analytics Dashboard                                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Accuracy Heatmap (Last 90 days)                  │   │
│  │ [GitHub-style contribution graph]                │   │
│  │ ■ ■ □ ■ ■ ■ □ ...                               │   │
│  │ Green = high accuracy, Red = low                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ Topic Performance   │  │ Complexity Progression  │  │
│  │ (Radar Chart)       │  │ (Line Chart)            │  │
│  │                     │  │ Brute Force → Optimal   │  │
│  └─────────────────────┘  └─────────────────────────┘  │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────────┐  │
│  │ Solve Time Trends   │  │ Retry Intelligence      │  │
│  │ (Area Chart)        │  │ (Bar Chart)             │  │
│  │ Getting faster?     │  │ Avg attempts before AC  │  │
│  └─────────────────────┘  └─────────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
<AccuracyHeatmap
  data={[
    { date: '2024-01-01', accuracy: 0.8, count: 5 },
    { date: '2024-01-02', accuracy: 0.6, count: 3 },
    // ...
  ]}
  dateRange={90}
/>

<ComplexityProgressionChart
  data={[
    { date: '2024-01', bruteForce: 60, optimal: 40 },
    { date: '2024-02', bruteForce: 45, optimal: 55 },
    { date: '2024-03', bruteForce: 30, optimal: 70 },
  ]}
/>

<RetryIntelligenceChart
  data={[
    { topic: 'Arrays', avgRetries: 1.2 },
    { topic: 'DP', avgRetries: 3.5 },
    { topic: 'Graphs', avgRetries: 2.1 },
  ]}
/>
```

---

### **7. Revision Queue Page (`/dashboard/revision`)**

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Revision Queue (23 problems)                           │
│  Smart Priority Algorithm Active                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Queue Type: [All] [Weak Topics] [Forgotten]           │
│              [Patterns] [Interview Prep]                │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ 🔴 Priority: 9.2/10                             │     │
│  │ Longest Increasing Subsequence                  │     │
│  │ Medium · Dynamic Programming                    │     │
│  │                                                  │     │
│  │ Why prioritized:                                │     │
│  │ • Weak in DP (score: 41/100)                    │     │
│  │ • Not practiced in 18 days                      │     │
│  │ • Failed 3 times previously                     │     │
│  │ • Related pattern mistake detected              │     │
│  │                                                  │     │
│  │ [Start Problem] [Skip] [More Info]              │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ 🟡 Priority: 7.8/10                             │     │
│  │ Detect Cycle in Graph                           │     │
│  │ Medium · Graphs, DFS                            │     │
│  │                                                  │     │
│  │ [Start Problem] [Skip]                          │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
<RevisionQueueCard
  item={{
    problem: 'Longest Increasing Subsequence',
    difficulty: 'medium',
    topics: ['DP'],
    priority: 9.2,
    reasons: [
      'Weak in DP (41/100)',
      'Not practiced in 18 days',
      'Failed 3 times previously',
      'Related pattern detected'
    ]
  }}
  onStart={() => {}}
  onSkip={() => {}}
/>

<QueueFilters
  activeFilter={filter}
  onChange={setFilter}
  counts={{
    all: 23,
    weakTopics: 8,
    forgotten: 5,
    patterns: 6,
    interviewPrep: 4
  }}
/>

<PriorityExplanation
  priority={9.2}
  breakdown={{
    weaknessScore: 3.0,
    avoidance: 2.5,
    daysSince: 1.8,
    failureCount: 1.5,
    confidenceGap: 0.4
  }}
/>
```

---

### **8. Roadmap Page (`/dashboard/roadmap`)**

**Purpose**: AI-generated personalized learning path

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Your Roadmap: "SDE-1 in 4 Months"                      │
│  Progress: 45% (Week 7/16)                              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ ✅ Week 1-2: Arrays & Hashing                   │     │
│  │ ✅ Week 3-4: Two Pointers & Sliding Window      │     │
│  │ ✅ Week 5-6: Stack & Queue                      │     │
│  │ 🔵 Week 7-8: Binary Search (Current)            │     │
│  │    Progress: 12/20 problems completed           │     │
│  │    [View Details] [Mark Complete]               │     │
│  │ ⏳ Week 9-10: Trees & Graphs                    │     │
│  │ ⏳ Week 11-12: Dynamic Programming              │     │
│  │ ⏳ Week 13-14: Advanced Topics                  │     │
│  │ ⏳ Week 15-16: Mock Interviews                  │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  This Week's Focus: Binary Search                       │
│  ┌────────────────────────────────────────────────┐     │
│  │ Planned Problems (20):                          │     │
│  │ ✅ Binary Search (Easy) - Completed              │     │
│  │ ✅ Search Insert Position (Easy) - Completed     │     │
│  │ 🔵 Find Peak Element (Medium) - In Progress      │     │
│  │ ⏳ Search in Rotated Array (Medium) - Todo       │     │
│  │ ... 16 more                                     │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
<RoadmapProgress
  roadmap={{
    goal: 'SDE-1 in 4 Months',
    timelineWeeks: 16,
    currentWeek: 7,
    completionPercentage: 45,
    milestones: [...]
  }}
/>

<WeeklyPlan
  week={7}
  topic="Binary Search"
  problems={[
    { title: 'Binary Search', status: 'completed', difficulty: 'easy' },
    { title: 'Find Peak Element', status: 'in_progress', difficulty: 'medium' },
    // ...
  ]}
  progress={{ completed: 12, total: 20 }}
/>

<MilestoneTracker
  milestones={[
    { week: 4, title: 'Master arrays', status: 'completed' },
    { week: 8, title: 'Master binary search', status: 'in_progress' },
    { week: 12, title: 'Master DP', status: 'pending' }
  ]}
/>
```

---

### **9. Interview Readiness (`/dashboard/interview`)**

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Interview Readiness Assessment                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Overall Readiness Score: 68/100                  │   │
│  │ [Progress Bar]                                   │   │
│  │                                                   │   │
│  │ Status: Approaching Readiness                    │   │
│  │ Estimated days to ready: 23 days                │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  Category Scores:                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Easy        │ │ Medium      │ │ Hard        │       │
│  │ 85/100 ✓    │ │ 62/100 ⚠️   │ │ 45/100 ❌   │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                           │
│  Topic Coverage:                                         │
│  ✅ Arrays (Strong)                                      │
│  ✅ Strings (Strong)                                     │
│  ⚠️  Binary Search (Moderate)                            │
│  ❌ DP (Weak) ← Focus here                              │
│  ❌ Graphs (Weak) ← Focus here                          │
│                                                           │
│  Recommended Actions:                                    │
│  1. Practice 10 more medium DP problems                 │
│  2. Review graph traversal algorithms                   │
│  3. Take a mock interview (blind75 mix)                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Components:**
```tsx
<ReadinessScore
  overall={68}
  breakdown={{
    easy: 85,
    medium: 62,
    hard: 45
  }}
  estimatedDays={23}
  status="approaching"
/>

<TopicCoverage
  topics={[
    { name: 'Arrays', status: 'strong', score: 90 },
    { name: 'DP', status: 'weak', score: 45 },
    { name: 'Graphs', status: 'weak', score: 48 }
  ]}
/>

<RecommendedActions
  actions={[
    { priority: 'high', action: 'Practice 10 more medium DP' },
    { priority: 'high', action: 'Review graph traversals' },
    { priority: 'medium', action: 'Take mock interview' }
  ]}
/>
```

---

## 🎨 Design System & UI Components

### **Color Palette**
```tsx
// Tailwind config
colors: {
  primary: {
    50: '#f0f9ff',
    // ...
    900: '#0c4a6e'
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Custom semantic colors
  accepted: '#10b981',
  wrong: '#ef4444',
  tle: '#f59e0b',
  mle: '#f97316',
  
  // Topic colors
  'topic-dp': '#8b5cf6',
  'topic-graphs': '#06b6d4',
  'topic-arrays': '#10b981',
  'topic-strings': '#f59e0b'
}
```

### **Key UI Components to Build**

```tsx
// Reusable components using shadcn/ui

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>

<Badge variant="success|warning|error|default">Text</Badge>

<Button variant="default|outline|ghost|destructive">Click</Button>

<Tabs>
  <TabsList>
    <TabsTrigger>Tab 1</TabsTrigger>
    <TabsTrigger>Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent>Content</TabsContent>
</Tabs>

<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    Content
    <DialogFooter>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Tooltip>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent>Tooltip text</TooltipContent>
</Tooltip>

<Separator />

<ScrollArea>Long content</ScrollArea>

<Skeleton className="h-4 w-full" />
```

### **Custom Components Library**

```tsx
// components/ui/stats-card.tsx
export function StatsCard({
  title,
  value,
  icon,
  trend,
  trendDirection
}: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p className={cn(
                "text-sm",
                trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
              )}>
                {trend}
              </p>
            )}
          </div>
          <div className="text-4xl">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// components/code-viewer/code-viewer.tsx
export function CodeViewer({
  code,
  language,
  highlights,
  readOnly = true,
  onLineClick
}: CodeViewerProps) {
  // Use Monaco Editor or CodeMirror
  return (
    <div className="relative">
      <MonacoEditor
        language={language}
        value={code}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false
        }}
        // Add line decorations for errors
      />
      {/* Render error annotations */}
    </div>
  )
}

// components/ai-analysis/error-card.tsx
export function ErrorCard({
  error
}: ErrorCardProps) {
  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{error.severity}</Badge>
          <CardTitle className="text-lg">{error.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{error.description}</p>
        <div className="mt-2">
          <p className="text-sm font-medium">Line {error.line}</p>
          <code className="text-xs">{error.codeSnippet}</code>
        </div>
        {error.suggestion && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-900">Suggestion:</p>
            <p className="text-sm text-green-700">{error.suggestion}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// components/charts/topic-radar.tsx
export function TopicRadarChart({ data }: TopicRadarProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="topic" />
        <PolarRadiusAxis angle={90} domain={[0, 100]} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.6}
        />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// components/heatmap/accuracy-heatmap.tsx
export function AccuracyHeatmap({ data }: HeatmapProps) {
  // GitHub-style contribution graph
  return (
    <div className="grid grid-cols-53 gap-1">
      {data.map((day) => (
        <Tooltip key={day.date}>
          <TooltipTrigger>
            <div
              className={cn(
                "w-3 h-3 rounded-sm",
                getHeatmapColor(day.accuracy)
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{day.date}</p>
            <p>{day.count} problems</p>
            <p>{Math.round(day.accuracy * 100)}% accuracy</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
```

---

## 🔌 API Integration

### **API Client Setup**
```tsx
// lib/api-client.ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add error handling interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh token logic
      await refreshToken()
      return apiClient.request(error.config)
    }
    return Promise.reject(error)
  }
)

export default apiClient
```

### **React Query Hooks**
```tsx
// hooks/use-submissions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'

export function useSubmissions(filters?: SubmissionFilters) {
  return useQuery({
    queryKey: ['submissions', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/submissions', { params: filters })
      return data
    },
    staleTime: 30000 // 30 seconds
  })
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ['submission', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/submissions/${id}`)
      return data
    }
  })
}

export function useAIAnalysis(submissionId: string) {
  return useQuery({
    queryKey: ['analysis', submissionId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analysis/${submissionId}`)
      return data
    },
    enabled: !!submissionId
  })
}

// hooks/use-patterns.ts
export function usePatterns() {
  return useQuery({
    queryKey: ['patterns'],
    queryFn: async () => {
      const { data } = await apiClient.get('/patterns')
      return data
    }
  })
}

// hooks/use-revision-queue.ts
export function useRevisionQueue(queueType?: string) {
  return useQuery({
    queryKey: ['revision-queue', queueType],
    queryFn: async () => {
      const { data } = await apiClient.get('/revision/queue', {
        params: { type: queueType }
      })
      return data
    }
  })
}

export function useGenerateQueue() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/revision/queue/generate')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revision-queue'] })
    }
  })
}

// hooks/use-analytics.ts
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/dashboard')
      return data
    },
    refetchInterval: 60000 // Refetch every minute
  })
}

export function useHeatmapData(type: string) {
  return useQuery({
    queryKey: ['heatmap', type],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analytics/heatmap/${type}`)
      return data
    }
  })
}

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: ['daily-report', date],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/reports/daily', {
        params: { date }
      })
      return data
    }
  })
}
```

---

## 🎭 State Management (Zustand)

```tsx
// stores/use-user-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  user: User | null
  accessToken: string | null
  setUser: (user: User) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      logout: () => set({ user: null, accessToken: null })
    }),
    {
      name: 'user-storage'
    }
  )
)

// stores/use-theme-store.ts
interface ThemeState {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'theme-storage'
    }
  )
)

// stores/use-filter-store.ts
interface FilterState {
  submissionFilters: SubmissionFilters
  setSubmissionFilters: (filters: SubmissionFilters) => void
  resetFilters: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  submissionFilters: {
    status: 'all',
    difficulty: 'all',
    topic: 'all',
    dateRange: null
  },
  setSubmissionFilters: (filters) => set({ submissionFilters: filters }),
  resetFilters: () => set({
    submissionFilters: {
      status: 'all',
      difficulty: 'all',
      topic: 'all',
      dateRange: null
    }
  })
}))
```

---

## 🚀 Performance Optimizations

### **Code Splitting**
```tsx
// app/dashboard/submissions/[id]/page.tsx
import dynamic from 'next/dynamic'

const CodeViewer = dynamic(() => import('@/components/code-viewer/code-viewer'), {
  loading: () => <Skeleton className="h-96 w-full" />,
  ssr: false
})

const AIAnalysisPanel = dynamic(() => import('@/components/ai-analysis/analysis-panel'), {
  loading: () => <Skeleton className="h-96 w-full" />
})
```

### **Image Optimization**
```tsx
import Image from 'next/image'

<Image
  src="/avatar.jpg"
  alt="User avatar"
  width={40}
  height={40}
  priority // For above-the-fold images
/>
```

### **Caching Strategy**
```tsx
// app/dashboard/page.tsx
export const revalidate = 60 // Revalidate every 60 seconds

// Or per-request caching
export async function getDashboardData() {
  const res = await fetch('http://localhost:8000/api/v1/analytics/dashboard', {
    next: { revalidate: 60 }
  })
  return res.json()
}
```

### **Virtualization for Long Lists**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const rowVirtualizer = useVirtualizer({
    count: submissions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <SubmissionCard submission={submissions[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 🧪 Testing

### **Component Tests**
```tsx
// __tests__/components/stats-card.test.tsx
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/ui/stats-card'

describe('StatsCard', () => {
  it('renders stats correctly', () => {
    render(
      <StatsCard
        title="Problems Solved"
        value={42}
        trend="+3 from yesterday"
        trendDirection="up"
      />
    )
    
    expect(screen.getByText('Problems Solved')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('+3 from yesterday')).toBeInTheDocument()
  })
})
```

### **Integration Tests**
```tsx
// __tests__/pages/dashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from '@/app/dashboard/page'

const queryClient = new QueryClient()

describe('Dashboard Page', () => {
  it('loads and displays dashboard data', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    )
    
    await waitFor(() => {
      expect(screen.getByText(/problems solved today/i)).toBeInTheDocument()
    })
  })
})
```

---

## 📁 Folder Structure

```
nextjs-dashboard/
├── app/
│   ├── layout.tsx                    # Root layout (theme provider)
│   ├── page.tsx                      # Landing page
│   ├── globals.css                   # Global styles
│   │
│   ├── (auth)/                       # Auth routes
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   └── dashboard/                    # Main dashboard
│       ├── layout.tsx                # Dashboard layout (sidebar, header)
│       ├── page.tsx                  # Home dashboard
│       │
│       ├── submissions/
│       │   ├── page.tsx              # List view
│       │   └── [id]/
│       │       ├── page.tsx          # Code viewer + AI analysis
│       │       └── evolution/
│       │           └── page.tsx      # Code evolution view
│       │
│       ├── patterns/
│       │   └── page.tsx              # Pattern analysis
│       │
│       ├── analytics/
│       │   └── page.tsx              # Analytics dashboard
│       │
│       ├── revision/
│       │   └── page.tsx              # Revision queue
│       │
│       ├── roadmap/
│       │   └── page.tsx              # Learning roadmap
│       │
│       └── interview/
│           └── page.tsx              # Interview readiness
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   └── ...
│   │
│   ├── dashboard/
│   │   ├── stats-card.tsx
│   │   ├── intelligence-report.tsx
│   │   ├── activity-timeline.tsx
│   │   ├── revision-queue-preview.tsx
│   │   └── sidebar.tsx
│   │
│   ├── code-viewer/
│   │   ├── code-viewer.tsx           # Monaco/CodeMirror wrapper
│   │   ├── code-diff.tsx             # Side-by-side diff
│   │   ├── error-annotation.tsx      # Inline error markers
│   │   └── syntax-highlighter.tsx
│   │
│   ├── ai-analysis/
│   │   ├── analysis-panel.tsx        # Right panel for AI insights
│   │   ├── error-card.tsx
│   │   ├── pattern-badge.tsx
│   │   ├── refactored-code-viewer.tsx
│   │   └── test-case-results.tsx
│   │
│   ├── patterns/
│   │   ├── pattern-card.tsx
│   │   ├── pattern-timeline.tsx
│   │   └── pattern-heatmap.tsx
│   │
│   ├── charts/
│   │   ├── topic-radar-chart.tsx
│   │   ├── accuracy-heatmap.tsx
│   │   ├── complexity-progression.tsx
│   │   ├── retry-intelligence-chart.tsx
│   │   └── solve-time-trends.tsx
│   │
│   ├── revision/
│   │   ├── revision-queue-card.tsx
│   │   ├── priority-explanation.tsx
│   │   └── queue-filters.tsx
│   │
│   ├── roadmap/
│   │   ├── roadmap-progress.tsx
│   │   ├── weekly-plan.tsx
│   │   └── milestone-tracker.tsx
│   │
│   └── submissions/
│       ├── submission-card.tsx
│       ├── submission-table.tsx
│       ├── submission-filters.tsx
│       └── code-evolution-timeline.tsx
│
├── hooks/
│   ├── use-submissions.ts            # React Query hooks
│   ├── use-analysis.ts
│   ├── use-patterns.ts
│   ├── use-revision-queue.ts
│   ├── use-analytics.ts
│   ├── use-roadmap.ts
│   └── use-auth.ts
│
├── stores/
│   ├── use-user-store.ts             # Zustand stores
│   ├── use-theme-store.ts
│   └── use-filter-store.ts
│
├── lib/
│   ├── api-client.ts                 # Axios instance
│   ├── utils.ts                      # Utility functions (cn, etc.)
│   └── constants.ts                  # App constants
│
├── types/
│   ├── submission.ts
│   ├── analysis.ts
│   ├── pattern.ts
│   ├── revision.ts
│   └── user.ts
│
├── styles/
│   └── monaco-theme.ts               # Custom Monaco editor theme
│
├── __tests__/
│   ├── components/
│   ├── pages/
│   └── integration/
│
├── public/
│   ├── icons/
│   └── images/
│
├── .env.local                        # Environment variables
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🔑 Environment Variables

```bash
# .env.local

# API
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Auth
NEXT_PUBLIC_JWT_SECRET=your-jwt-secret

# Features
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_SOCKET=true

# Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Sentry (Error tracking)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn

# Environment
NEXT_PUBLIC_ENV=development
```

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.3",
    
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    
    "@tanstack/react-query": "^5.17.0",
    "@tanstack/react-virtual": "^3.0.1",
    
    "zustand": "^4.5.0",
    
    "axios": "^1.6.5",
    
    "recharts": "^2.10.3",
    "framer-motion": "^11.0.3",
    
    "@monaco-editor/react": "^4.6.0",
    "prismjs": "^1.29.0",
    
    "date-fns": "^3.2.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    
    "lucide-react": "^0.314.0",
    
    "socket.io-client": "^4.6.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.33",
    "autoprefixer": "^10.4.17",
    
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "jest": "^29.7.0",
    
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.1.0",
    "prettier": "^3.2.4"
  }
}
```

---

## 🎯 Key Features Checklist

### **Code Error Visualization ✅**
- [x] Syntax highlighting with error markers
- [x] Inline error annotations with tooltips
- [x] Error categorization (logical, syntax, pattern, complexity)
- [x] Severity indicators (critical, high, medium, low)
- [x] Line-by-line error highlighting in code editor
- [x] Side panel with detailed error explanations
- [x] Suggestions and fixes for each error
- [x] Pattern mistake tracking across submissions
- [x] Test case results with input/output/expected
- [x] Execution trace visualization

### **AI Analysis Integration ✅**
- [x] Real-time analysis status updates
- [x] Confidence scores for AI insights
- [x] Refactored code comparison (diff view)
- [x] Better approach recommendations
- [x] Complexity analysis (time & space)
- [x] Edge cases identification

### **Data Visualization ✅**
- [x] Topic strength radar chart
- [x] Accuracy heatmap (GitHub-style)
- [x] Complexity progression line chart
- [x] Retry intelligence bar chart
- [x] Daily activity timeline
- [x] Code evolution flow diagram

### **Interactive Features ✅**
- [x] Filterable submission list
- [x] Searchable problem database
- [x] Sortable tables
- [x] Expandable code viewers
- [x] Collapsible error sections
- [x] Tabbed navigation
- [x] Modal dialogs for detailed views

### **Real-time Updates ✅**
- [x] WebSocket connection for live sync
- [x] Real-time analysis completion notifications
- [x] Live revision queue updates
- [x] Toast notifications for events

### **Performance ✅**
- [x] Code splitting for heavy components
- [x] Virtual scrolling for long lists
- [x] Image optimization
- [x] Server-side rendering where applicable
- [x] Client-side caching with React Query
- [x] Lazy loading for charts and editors

---

## 🚀 Implementation Steps

### **Phase 1: Setup (Days 1-2)**
1. Initialize Next.js 14 project with TypeScript
2. Install and configure Tailwind CSS
3. Install shadcn/ui components
4. Setup API client with axios
5. Configure React Query
6. Setup Zustand stores
7. Create base layouts (auth, dashboard)

### **Phase 2: Core Dashboard (Days 3-5)**
1. Build home dashboard page
2. Implement stats cards
3. Add intelligence report component
4. Create topic radar chart
5. Build activity timeline
6. Add revision queue preview

### **Phase 3: Submissions & Code Viewer (Days 6-9)**
1. Build submissions list page
2. Add filters and search
3. Create submission cards
4. **Implement code viewer with Monaco**
5. **Build error annotation system**
6. **Create AI analysis panel**
7. **Add inline error tooltips**
8. **Implement error categorization UI**

### **Phase 4: Error Analysis & Patterns (Days 10-12)**
1. **Build detailed error cards**
2. **Create pattern detection page**
3. **Implement pattern timeline**
4. **Add pattern heatmap**
5. **Build code diff viewer**
6. **Create refactored code comparison**

### **Phase 5: Analytics (Days 13-15)**
1. Build analytics dashboard
2. Implement accuracy heatmap
3. Add complexity progression chart
4. Create retry intelligence visualization
5. Build solve time trends

### **Phase 6: Revision & Roadmap (Days 16-18)**
1. Build revision queue page
2. Implement priority explanation
3. Create roadmap progress tracker
4. Add weekly plan component
5. Build milestone tracker

### **Phase 7: Polish & Testing (Days 19-21)**
1. Add loading states and skeletons
2. Implement error boundaries
3. Add animations with Framer Motion
4. Write unit tests for components
5. Write integration tests
6. Performance optimization
7. Accessibility audit
8. Dark mode polish

---

## 🎨 UI/UX Best Practices

1. **Loading States**: Always show skeletons while loading
2. **Empty States**: Friendly messages when no data
3. **Error States**: Clear error messages with retry options
4. **Responsive**: Mobile-first design approach
5. **Animations**: Subtle, purposeful motion
6. **Accessibility**: Keyboard navigation, ARIA labels, focus states
7. **Feedback**: Toast notifications for actions
8. **Progressive Disclosure**: Show details on demand
9. **Consistent Spacing**: Use Tailwind's spacing scale
10. **Clear CTAs**: Prominent action buttons

---

## 🎁 Bonus Features

1. **Export Data**: Download submissions as CSV/JSON
2. **Share Progress**: Shareable links for profiles
3. **Dark Mode**: Complete theme support
4. **Keyboard Shortcuts**: Power user features
5. **PWA**: Install as app on mobile
6. **Offline Support**: Cache dashboard data
7. **Customizable Dashboard**: Drag-and-drop widgets
8. **AI Chat**: Ask questions about your progress
9. **Gamification**: Badges, achievements, leaderboards
10. **Social**: Compare with friends (opt-in)

---

## 📚 Resources

- **Next.js Docs**: https://nextjs.org/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Query**: https://tanstack.com/query/latest
- **Zustand**: https://github.com/pmndrs/zustand
- **Monaco Editor**: https://microsoft.github.io/monaco-editor
- **Recharts**: https://recharts.org
- **Framer Motion**: https://www.framer.com/motion

---

## ✅ Final Deliverables

1. ✅ Complete Next.js 14 project with all pages
2. ✅ All UI components built with shadcn/ui
3. ✅ Code viewer with error highlighting
4. ✅ AI analysis panel with categorized errors
5. ✅ Pattern detection visualization
6. ✅ All charts and graphs
7. ✅ Responsive design (mobile, tablet, desktop)
8. ✅ Dark mode support
9. ✅ API integration with React Query
10. ✅ State management with Zustand
11. ✅ Unit and integration tests
12. ✅ README with setup instructions
13. ✅ Environment variables template
14. ✅ TypeScript types for all entities

---

Ready to build the most beautiful LeetCode dashboard? 🎨✨

This dashboard will make your AI coaching platform stand out with crystal-clear error visualization and actionable insights! 🚀