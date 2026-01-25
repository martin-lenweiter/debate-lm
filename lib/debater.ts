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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    // Reset finalResponse each iteration - we only want text from the final response
    finalResponse = '';

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

      const myConcessions = myOutput.concessions?.length
        ? `\n**${debaterName} conceded**: ${myOutput.concessions.join('; ')}`
        : '';
      const theirConcessions = theirOutput.concessions?.length
        ? `\n**${opponentName} conceded**: ${theirOutput.concessions.join('; ')}`
        : '';

      return `### Round ${round.round}

**${debaterName}** (${Math.round(myOutput.confidence * 100)}% confident):
${myOutput.argument}${myConcessions}

**${opponentName}** (${Math.round(theirOutput.confidence * 100)}% confident):
${theirOutput.argument}${theirConcessions}

**Referee**: ${round.refereeOutput.summary}`;
    })
    .join('\n\n---\n\n');
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
    const validated = DebaterOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error('Failed to parse debater output:', error);

    // Try to extract just the prose before any JSON/code block as fallback
    let fallbackArgument = response;

    // Remove JSON code blocks
    fallbackArgument = fallbackArgument.replace(/```json[\s\S]*?```/g, '').trim();

    // Remove any remaining raw JSON objects (starting with { and ending with })
    const jsonStartIdx = fallbackArgument.indexOf('{"');
    if (jsonStartIdx > 0) {
      fallbackArgument = fallbackArgument.slice(0, jsonStartIdx).trim();
    }

    // Clean up any trailing incomplete markers
    fallbackArgument = fallbackArgument.replace(/```\s*$/, '').trim();

    return {
      confidence: 0.5,
      argument: fallbackArgument || response || 'Unable to parse argument',
    };
  }
}
