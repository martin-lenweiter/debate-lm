import Anthropic from '@anthropic-ai/sdk';
import { DEBATER_TOOLS, executeTool, formatToolResult } from './tools';
import { createDebaterPrompt } from './prompts';
import {
  MODEL_IDS,
  DebaterOutputSchema,
  type ModelType,
  type DebaterOutput,
  type RoundData,
} from './schemas';

const client = new Anthropic();

export interface DebaterConfig {
  name: string;
  model: ModelType;
  topic: string;
  context?: string;
  opponentName: string;
}

export interface DebaterTurnResult {
  output: DebaterOutput;
  thinkingBlocks: string[];
  toolCalls: Array<{ name: string; input: unknown; result: string }>;
  rawResponse: string;
}

type Messages = Array<{ role: 'user' | 'assistant'; content: string | unknown[] }>;

export async function runDebaterTurn(
  config: DebaterConfig,
  round: number,
  history: RoundData[],
  userInputs: Array<{ round: number; input: string }>,
  sessionId: string,
  onThinking?: (thinking: string) => void,
  onText?: (text: string) => void,
  onToolUse?: (name: string, input: unknown) => void
): Promise<DebaterTurnResult> {
  const modelId = MODEL_IDS[config.model];

  // Format history for the prompt
  const historyStr = formatHistory(history, config.name, config.opponentName);
  const userInputsStr = formatUserInputs(userInputs);

  // Create the initial prompt
  const prompt = createDebaterPrompt(
    config.name,
    config.topic,
    config.context,
    round,
    config.opponentName,
    historyStr,
    userInputsStr
  );

  const messages: Messages = [{ role: 'user', content: prompt }];
  const thinkingBlocks: string[] = [];
  const toolCalls: Array<{ name: string; input: unknown; result: string }> = [];

  // Tool use loop
  let continueLoop = true;
  let finalResponse = '';

  while (continueLoop) {
    // Use extended thinking with tools
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000,
      },
      tools: DEBATER_TOOLS as Anthropic.Messages.Tool[],
      messages: messages as Anthropic.Messages.MessageParam[],
    });

    // Process content blocks and build assistant content
    const assistantContent: unknown[] = [];

    for (const block of response.content) {
      if (block.type === 'thinking') {
        const thinkingBlock = block as unknown as { type: 'thinking'; thinking: string };
        thinkingBlocks.push(thinkingBlock.thinking);
        assistantContent.push(block);
        onThinking?.(thinkingBlock.thinking);
      } else if (block.type === 'text') {
        finalResponse += block.text;
        assistantContent.push(block);
        onText?.(block.text);
      } else if (block.type === 'tool_use') {
        assistantContent.push(block);
        onToolUse?.(block.name, block.input);
      }
    }

    // Check if we need to handle tool calls
    if (response.stop_reason === 'tool_use') {
      // Add assistant message with all content (including thinking)
      messages.push({ role: 'assistant', content: assistantContent });

      // Execute tools and collect results
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            sessionId
          );
          const formattedResult = formatToolResult(result);

          toolCalls.push({
            name: block.name,
            input: block.input,
            result: formattedResult,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: formattedResult,
          });
        }
      }

      // Add tool results as user message
      messages.push({ role: 'user', content: toolResults });
    } else {
      // end_turn or other stop reason
      continueLoop = false;
    }
  }

  // Parse the final JSON output
  const output = parseDebaterOutput(finalResponse);

  return {
    output,
    thinkingBlocks,
    toolCalls,
    rawResponse: finalResponse,
  };
}

function formatHistory(
  history: RoundData[],
  debaterName: string,
  opponentName: string
): string {
  if (history.length === 0) return '';

  return history
    .map((round) => {
      const isDebaterA = debaterName.includes('A');
      const myOutput = isDebaterA ? round.debaterAOutput : round.debaterBOutput;
      const theirOutput = isDebaterA ? round.debaterBOutput : round.debaterAOutput;

      return `### Round ${round.round}

**${debaterName}'s position**: ${myOutput.position}
**${debaterName}'s confidence**: ${myOutput.confidence}
**${debaterName}'s key claims**:
${myOutput.claims.map((c) => `- ${c.statement} (confidence: ${c.confidence})`).join('\n')}

**${opponentName}'s position**: ${theirOutput.position}
**${opponentName}'s confidence**: ${theirOutput.confidence}
**${opponentName}'s key claims**:
${theirOutput.claims.map((c) => `- ${c.statement} (confidence: ${c.confidence})`).join('\n')}

**Referee summary**: ${round.refereeOutput.round_summary}
**Areas of agreement**: ${round.refereeOutput.areas_of_agreement.join(', ') || 'None yet'}
**Areas of disagreement**: ${round.refereeOutput.areas_of_disagreement.join(', ') || 'None identified'}`;
    })
    .join('\n\n');
}

function formatUserInputs(
  userInputs: Array<{ round: number; input: string }>
): string {
  if (userInputs.length === 0) return '';

  return userInputs
    .map((u) => `[Round ${u.round}] User clarification: ${u.input}`)
    .join('\n');
}

function parseDebaterOutput(response: string): DebaterOutput {
  // Most reliable: find JSON object boundaries directly
  const startIdx = response.indexOf('{');
  const endIdx = response.lastIndexOf('}');

  let jsonStr = response;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonStr = response.slice(startIdx, endIdx + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const validated = DebaterOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    // Return a minimal valid output if parsing fails
    console.error('Failed to parse debater output:', error);
    return {
      position: 'Unable to parse position',
      confidence: 0.5,
      claims: [],
      counterarguments: [],
      reasoning_summary: `Parse error: ${response.slice(0, 200)}...`,
    };
  }
}
