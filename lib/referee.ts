import Anthropic from '@anthropic-ai/sdk';
import { createRefereePrompt } from './prompts';
import {
  MODEL_IDS,
  RefereeOutputSchema,
  type ModelType,
  type RefereeOutput,
  type DebaterOutput,
  type RoundData,
} from './schemas';

const client = new Anthropic();

export interface RefereeConfig {
  model: ModelType;
  topic: string;
  context?: string;
  maxRounds: number;
  debaterAName: string;
  debaterBName: string;
}

export interface RefereeTurnResult {
  output: RefereeOutput;
  thinkingBlocks: string[];
  rawResponse: string;
}

export async function runRefereeTurn(
  config: RefereeConfig,
  round: number,
  debaterAOutput: DebaterOutput,
  debaterBOutput: DebaterOutput,
  history: RoundData[],
  userInputs: Array<{ round: number; input: string }>,
  onThinking?: (thinking: string) => void,
  onText?: (text: string) => void
): Promise<RefereeTurnResult> {
  const modelId = MODEL_IDS[config.model];

  // Format history for the prompt
  const historyStr = formatHistory(history);
  const userInputsStr = formatUserInputs(userInputs);

  // Create the prompt
  const prompt = createRefereePrompt(
    config.topic,
    config.context,
    round,
    config.maxRounds,
    config.debaterAName,
    config.debaterBName,
    JSON.stringify(debaterAOutput, null, 2),
    JSON.stringify(debaterBOutput, null, 2),
    historyStr,
    userInputsStr
  );

  const thinkingBlocks: string[] = [];
  let finalResponse = '';

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 8000,
    thinking: {
      type: 'enabled',
      budget_tokens: 6000,
    },
    messages: [{ role: 'user', content: prompt }],
  });

  // Process content blocks
  for (const block of response.content) {
    if (block.type === 'thinking') {
      const thinkingBlock = block as unknown as { type: 'thinking'; thinking: string };
      thinkingBlocks.push(thinkingBlock.thinking);
      onThinking?.(thinkingBlock.thinking);
    } else if (block.type === 'text') {
      finalResponse += block.text;
      onText?.(block.text);
    }
  }

  // Parse the JSON output
  const output = parseRefereeOutput(finalResponse, round, config.maxRounds);

  return {
    output,
    thinkingBlocks,
    rawResponse: finalResponse,
  };
}

function formatHistory(history: RoundData[]): string {
  if (history.length === 0) return '';

  return history
    .map((round) => {
      return `### Round ${round.round}
${round.refereeOutput.summary}
Verdict: ${round.refereeOutput.verdict}`;
    })
    .join('\n\n');
}

function formatUserInputs(
  userInputs: Array<{ round: number; input: string }>
): string {
  if (userInputs.length === 0) return '';

  return userInputs
    .map((u) => `[After Round ${u.round}] User clarification: ${u.input}`)
    .join('\n');
}

function parseRefereeOutput(
  response: string,
  round: number,
  maxRounds: number
): RefereeOutput {
  // Try to find JSON in code block first
  const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr = '';

  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    // Fallback: find JSON object boundaries
    const startIdx = response.indexOf('{');
    const endIdx = response.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = response.slice(startIdx, endIdx + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // If we're at max rounds and verdict is CONTINUE, change to MAX_ROUNDS_REACHED
    if (round >= maxRounds && parsed.verdict === 'CONTINUE') {
      parsed.verdict = 'MAX_ROUNDS_REACHED';
    }

    const validated = RefereeOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    // Return a minimal valid output with raw response as summary
    console.error('Failed to parse referee output:', error);
    return {
      verdict: round >= maxRounds ? 'MAX_ROUNDS_REACHED' : 'CONTINUE',
      summary: response || 'Unable to parse referee analysis',
    };
  }
}

// Helper to check for deadlock
export function checkForDeadlock(history: RoundData[]): boolean {
  if (history.length < 3) return false;

  // Get the last 3 rounds
  const recent = history.slice(-3);

  // Check if arguments have been stable (similar content)
  const argumentsA = recent.map((r) => r.debaterAOutput.argument);
  const argumentsB = recent.map((r) => r.debaterBOutput.argument);

  const aStable = argumentsA.every(
    (a) => similarity(a, argumentsA[0]) > 0.8
  );
  const bStable = argumentsB.every(
    (a) => similarity(a, argumentsB[0]) > 0.8
  );

  // Check if confidence levels are stable
  const confidenceAStable =
    Math.max(...recent.map((r) => r.debaterAOutput.confidence)) -
      Math.min(...recent.map((r) => r.debaterAOutput.confidence)) <
    0.1;
  const confidenceBStable =
    Math.max(...recent.map((r) => r.debaterBOutput.confidence)) -
      Math.min(...recent.map((r) => r.debaterBOutput.confidence)) <
    0.1;

  return aStable && bStable && confidenceAStable && confidenceBStable;
}

// Simple similarity check based on common words
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const wordsAArray = Array.from(wordsA);
  const wordsBArray = Array.from(wordsB);

  const intersection = new Set(wordsAArray.filter((x) => wordsB.has(x)));
  const union = new Set(wordsAArray.concat(wordsBArray));

  return intersection.size / union.size;
}
