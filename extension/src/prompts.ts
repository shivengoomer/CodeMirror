export const ERROR_TYPES = [
  "off_by_one",
  "null_check_missing",
  "empty_input_unhandled",
  "wrong_base_case",
  "infinite_loop",
  "wrong_data_structure",
  "integer_overflow",
  "wrong_traversal_order",
  "missed_edge_case",
  "logic_error",
  "tle_wrong_complexity",
  "tle_constant_factor",
  "mle_large_allocation",
  "compile_error_syntax",
  "compile_error_type",
  "runtime_error_index",
  "runtime_error_zerodiv",
  "runtime_error_stack",
  "wrong_return_type",
  "output_format_mismatch"
] as const;

export const CONCEPTS = [
  "arrays",
  "strings",
  "linked_lists",
  "trees",
  "graphs",
  "dynamic_programming",
  "recursion",
  "backtracking",
  "binary_search",
  "two_pointers",
  "sliding_window",
  "hash_maps",
  "hash_sets",
  "stacks",
  "queues",
  "heaps",
  "sorting",
  "greedy",
  "bit_manipulation",
  "math",
  "tries",
  "segment_trees",
  "union_find",
  "matrix",
  "intervals",
  "prefix_sum"
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];
export type Concept = (typeof CONCEPTS)[number];
export type Severity = "low" | "medium" | "high";
export type Verdict =
  | "wrong_answer"
  | "tle"
  | "mle"
  | "runtime_error"
  | "compile_error";

export interface GroqConfig {
  model: "llama-3.3-70b-versatile";
  temperature: number;
  max_tokens: number;
  response_format: { type: "json_object" };
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface FailingCase {
  input: string;
  expected: string;
  got: string;
}

export interface KnownPattern {
  id: string;
  tag: string;
  occurrence_count: number;
  last_seen_days_ago: number;
}

export interface SubmissionTaggerInput {
  platform: string;
  problem_title: string;
  problem_slug: string;
  language: string;
  verdict: Verdict;
  error_message?: string | null;
  failing_cases: FailingCase[];
  code: string;
  known_patterns: KnownPattern[];
}

export interface OverlayCopy {
  headline: string;
  body: string;
  call_to_action: string;
  badge_label: string;
}

export interface SubmissionTaggerResult {
  error_types: ErrorType[];
  concepts: Concept[];
  description: string;
  failing_pattern: string;
  confidence: number;
  severity: Severity;
  is_recurring: boolean;
  matched_pattern_ids: string[];
  overlay: OverlayCopy;
}

export interface PatternHistory {
  title: string;
  tag: string;
  occurrence_count: number;
  first_seen_days_ago: number;
  evidence: string[];
  impact: string;
}

export interface RecurringOverlayInput {
  problem_title: string;
  platform: string;
  verdict: Verdict;
  error_type: ErrorType;
  description: string;
  pattern: PatternHistory;
  in_revision_queue: boolean;
}

export interface RecurringOverlayResult extends OverlayCopy {
  show_revision_reminder: boolean;
}

export const EXT1_GROQ_CONFIG: GroqConfig = {
  model: "llama-3.3-70b-versatile",
  temperature: 0.1,
  max_tokens: 500,
  response_format: { type: "json_object" }
};

export const EXT2_GROQ_CONFIG: GroqConfig = {
  model: "llama-3.3-70b-versatile",
  temperature: 0.4,
  max_tokens: 300,
  response_format: { type: "json_object" }
};

export const EXT1_SYSTEM_PROMPT = `You are a coding mistake tagger embedded in a browser extension. You receive one failed submission and return a structured JSON object. This runs in real-time — the user is waiting.

You are NOT a tutor. Never reveal the solution, algorithm, or correct approach. Your output feeds a database and a browser overlay card.

RULES:
1. Respond with valid JSON only. No prose, no markdown fences, no preamble.
2. Never hint at the correct solution in any field.
3. Keep all strings concise — overlay_message max 35 words, description max 15 words.
4. Pick the most specific error_type first.
5. Set is_recurring = true only if the submission matches one of the known_patterns provided.

ERROR TYPE TAXONOMY:
off_by_one | null_check_missing | empty_input_unhandled | wrong_base_case |
infinite_loop | wrong_data_structure | integer_overflow | wrong_traversal_order |
missed_edge_case | logic_error | tle_wrong_complexity | tle_constant_factor |
mle_large_allocation | compile_error_syntax | compile_error_type |
runtime_error_index | runtime_error_zerodiv | runtime_error_stack |
wrong_return_type | output_format_mismatch

CONCEPT TAXONOMY:
arrays | strings | linked_lists | trees | graphs | dynamic_programming |
recursion | backtracking | binary_search | two_pointers | sliding_window |
hash_maps | hash_sets | stacks | queues | heaps | sorting | greedy |
bit_manipulation | math | tries | segment_trees | union_find | matrix |
intervals | prefix_sum

OUTPUT SCHEMA:
{
  "error_types": ["<primary>", "<secondary_if_applicable>"],
  "concepts": ["<concept1>", "<concept2>"],
  "description": "<what specifically went wrong, max 15 words>",
  "failing_pattern": "<generalised pattern beyond this problem, max 15 words>",
  "confidence": <float 0.0-1.0>,
  "severity": "<low|medium|high>",
  "is_recurring": <true|false>,
  "matched_pattern_ids": ["<id>"] or [],
  "overlay": {
    "headline": "<max 8 words, names the mistake>",
    "body": "<max 25 words, what went wrong — no solution hint>",
    "call_to_action": "<max 15 words, a self-reflection question, not a hint>",
    "badge_label": "<2-3 words, e.g. 'First occurrence' or 'Seen 3 times'>"
  }
}`;

export const EXT2_SYSTEM_PROMPT = `You write the copy for a browser overlay card shown immediately after a recurring coding mistake is detected. The user has made this exact type of mistake before.

Tone: direct, coach-like, non-judgmental. Like a coach who's spotted a pattern — not a teacher explaining a concept. Short, sharp, no fluff.

RULES:
1. Respond with JSON only.
2. Never hint at the solution or correct approach.
3. Always reference the specific recurrence count and past problems.
4. call_to_action must make them reflect on WHY — not WHAT to fix.
5. headline: max 8 words. body: max 30 words. call_to_action: max 15 words.

OUTPUT SCHEMA:
{
  "headline": "<names the recurring pattern, max 8 words>",
  "body": "<references how many times + which past problems, max 30 words, no solution hint>",
  "call_to_action": "<self-reflection question about WHY this keeps happening, max 15 words>",
  "badge_label": "<e.g. 'Seen 4 times'>",
  "show_revision_reminder": <true|false — true if this problem is not already in revision queue>
}`;

export function buildExt1Messages(input: SubmissionTaggerInput): ChatMessage[] {
  return [
    { role: "system", content: EXT1_SYSTEM_PROMPT },
    { role: "user", content: buildExt1UserPrompt(input) }
  ];
}

export function buildExt2Messages(input: RecurringOverlayInput): ChatMessage[] {
  return [
    { role: "system", content: EXT2_SYSTEM_PROMPT },
    { role: "user", content: buildExt2UserPrompt(input) }
  ];
}

export function buildExt1UserPrompt(input: SubmissionTaggerInput): string {
  const cases = input.failing_cases.length
    ? input.failing_cases.slice(0, 3).map(formatFailingCase).join("\n")
    : "  Not available — infer from code and error message.";

  const patterns = input.known_patterns.length
    ? input.known_patterns.map(formatKnownPattern).join("\n")
    : "None yet.";

  return `SUBMISSION:
Platform: ${input.platform}
Problem: ${input.problem_title} (${input.problem_slug})
Language: ${input.language}
Verdict: ${input.verdict}
Error message: ${input.error_message || "none"}

Failing test cases:
${cases}

Code:
\`\`\`${input.language}
${escapeCodeFence(input.code)}
\`\`\`

User's known patterns (for recurrence detection):
${patterns}

Return JSON only.`;
}

export function buildExt2UserPrompt(input: RecurringOverlayInput): string {
  return `RECURRING PATTERN:
Problem: ${input.problem_title} on ${input.platform}
Verdict: ${input.verdict}
Error type: ${input.error_type}
Description: ${input.description}

Pattern history:
- Title: ${input.pattern.title}
- Tag: ${input.pattern.tag}
- Total occurrences (including this): ${input.pattern.occurrence_count}
- First seen: ${input.pattern.first_seen_days_ago} days ago
- Past problems: ${input.pattern.evidence.join(", ")}
- Impact: ${input.pattern.impact}

Already in revision queue: ${input.in_revision_queue}

Return JSON only.`;
}

export function shouldCallRecurringOverlay(
  result: Pick<SubmissionTaggerResult, "is_recurring" | "matched_pattern_ids">
): boolean {
  return result.is_recurring && result.matched_pattern_ids.length > 0;
}

export function overlayFromExt1(result: SubmissionTaggerResult): OverlayCopy {
  return result.overlay;
}

function formatFailingCase(testCase: FailingCase): string {
  return `  Input:    ${testCase.input}
  Expected: ${testCase.expected}
  Got:      ${testCase.got}`;
}

function formatKnownPattern(pattern: KnownPattern): string {
  return `- id: ${pattern.id} | tag: ${pattern.tag} | occurrences: ${pattern.occurrence_count} | last: ${pattern.last_seen_days_ago}d ago`;
}

function escapeCodeFence(code: string): string {
  return code.replaceAll("```", "`\u200b``");
}
