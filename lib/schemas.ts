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

// Claim source types
export const ClaimSourceTypeSchema = z.enum([
  'web_search',
  'web_fetch',
  'python_calculation',
  'file_evidence',
  'logical_deduction',
  'prior_knowledge',
  'opponent_concession'
]);

export type ClaimSourceType = z.infer<typeof ClaimSourceTypeSchema>;

export const ClaimSourceSchema = z.object({
  type: ClaimSourceTypeSchema,
  content: z.string(),
  url: z.string().optional(),
  timestamp: z.string().optional(),
});

export type ClaimSource = z.infer<typeof ClaimSourceSchema>;

// Claim structure
export const ClaimSchema = z.object({
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(ClaimSourceSchema),
  rebuttals_considered: z.array(z.string()).optional(),
});

export type Claim = z.infer<typeof ClaimSchema>;

// Position change tracking
export const PositionChangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string(),
  round: z.number(),
});

export type PositionChange = z.infer<typeof PositionChangeSchema>;

// Agreement tracking
export const AgreementSchema = z.object({
  claim: z.string(),
  since_round: z.number(),
  confidence: z.number().min(0).max(1),
});

export type Agreement = z.infer<typeof AgreementSchema>;

// Debater output
export const DebaterOutputSchema = z.object({
  position: z.string(),
  confidence: z.number().min(0).max(1),
  claims: z.array(ClaimSchema),
  counterarguments: z.array(z.object({
    target_claim: z.string(),
    rebuttal: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  concessions: z.array(z.string()).nullish(),
  position_changes: z.array(PositionChangeSchema).nullish(),
  agreements_with_opponent: z.array(AgreementSchema).nullish(),
  open_questions: z.array(z.string()).nullish(),
  reasoning_summary: z.string(),
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

// Referee output
export const RefereeOutputSchema = z.object({
  verdict: VerdictTypeSchema,
  round_summary: z.string(),
  debater_a_assessment: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    evidence_quality: z.number().min(0).max(1),
    reasoning_quality: z.number().min(0).max(1),
  }),
  debater_b_assessment: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    evidence_quality: z.number().min(0).max(1),
    reasoning_quality: z.number().min(0).max(1),
  }),
  areas_of_agreement: z.array(z.string()),
  areas_of_disagreement: z.array(z.string()),
  consensus_statement: z.string().nullish(),
  user_input_prompt: z.string().nullish(),
  deadlock_reason: z.string().nullish(),
  recommendations: z.array(z.string()).nullish(),
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
