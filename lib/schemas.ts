import { z } from 'zod';

// Model configuration
export const MODEL_IDS = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
} as const;

export type ModelType = keyof typeof MODEL_IDS;

export const ModelConfigSchema = z.object({
  debaterA: z.enum(['opus', 'sonnet', 'haiku']),
  debaterB: z.enum(['opus', 'sonnet', 'haiku']),
  referee: z.enum(['opus', 'sonnet', 'haiku']),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Source reference (simplified)
export const SourceRefSchema = z.object({
  type: z.enum(['web_search', 'web_fetch', 'python_calc', 'file', 'deduction', 'prior']),
  label: z.string(),
  url: z.string().optional(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

// Debater output (conversational format)
export const DebaterOutputSchema = z.object({
  confidence: z.number().min(0).max(1),
  argument: z.string(), // Natural prose with inline [source:X] markers
  concessions: z.array(z.string()).nullish(),
  sources: z.array(SourceRefSchema).nullish(), // Referenced sources
});

export type DebaterOutput = z.infer<typeof DebaterOutputSchema>;

// Verdict types
export const VerdictTypeSchema = z.enum([
  'CONTINUE',
  'CONSENSUS_REACHED',
  'USER_INPUT_NEEDED',
  'DEADLOCK',
  'MAX_ROUNDS_REACHED'
]);

export type VerdictType = z.infer<typeof VerdictTypeSchema>;

// Referee output (conversational format)
export const RefereeOutputSchema = z.object({
  verdict: VerdictTypeSchema,
  summary: z.string(), // Natural prose analysis
  consensus_statement: z.string().nullish(),
  user_input_prompt: z.string().nullish(),
  deadlock_reason: z.string().nullish(),
});

export type RefereeOutput = z.infer<typeof RefereeOutputSchema>;

// Debate configuration
export const DebateConfigSchema = z.object({
  topic: z.string().min(1),
  context: z.string().optional(),
  maxRounds: z.number().min(1).max(20).default(10),
  models: ModelConfigSchema,
  debaterAName: z.string().default('Debater A'),
  debaterBName: z.string().default('Debater B'),
});

export type DebateConfig = z.infer<typeof DebateConfigSchema>;

// Round data
export const RoundDataSchema = z.object({
  round: z.number(),
  debaterAOutput: DebaterOutputSchema,
  debaterBOutput: DebaterOutputSchema,
  refereeOutput: RefereeOutputSchema,
  timestamp: z.string(),
});

export type RoundData = z.infer<typeof RoundDataSchema>;

// Debate state
export const DebateStateSchema = z.object({
  config: DebateConfigSchema,
  status: z.enum(['idle', 'running', 'paused', 'completed', 'error']),
  currentRound: z.number(),
  rounds: z.array(RoundDataSchema),
  userInputs: z.array(z.object({
    round: z.number(),
    input: z.string(),
    timestamp: z.string(),
  })),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type DebateState = z.infer<typeof DebateStateSchema>;

// SSE event types
export type SSEEventType =
  | 'debate_started'
  | 'round_started'
  | 'debater_a_thinking'
  | 'debater_a_text'
  | 'debater_a_tool_use'
  | 'debater_a_complete'
  | 'debater_b_thinking'
  | 'debater_b_text'
  | 'debater_b_tool_use'
  | 'debater_b_complete'
  | 'referee_thinking'
  | 'referee_text'
  | 'referee_complete'
  | 'round_complete'
  | 'user_input_needed'
  | 'debate_complete'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}

// Tool result types
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebFetchResult {
  url: string;
  content: string;
  title?: string;
}

export interface PythonExecResult {
  output: string;
  error?: string;
}

export interface FileReadResult {
  path: string;
  content: string;
}

export interface FileWriteResult {
  path: string;
  success: boolean;
}

export type ToolResult =
  | { type: 'web_search'; results: WebSearchResult[] }
  | { type: 'web_fetch'; result: WebFetchResult }
  | { type: 'python_exec'; result: PythonExecResult }
  | { type: 'file_read'; result: FileReadResult }
  | { type: 'file_write'; result: FileWriteResult }
  | { type: 'error'; error: string };
