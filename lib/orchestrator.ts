import { runDebaterTurn, type DebaterConfig } from './debater';
import { runRefereeTurn, checkForDeadlock, type RefereeConfig } from './referee';
import { initSessionFiles, cleanupSession } from './tools/file-ops';
import type {
  DebateConfig,
  DebateState,
  RoundData,
  SSEEvent,
  SSEEventType,
} from './schemas';

export type EventEmitter = (event: SSEEvent) => void;

export interface OrchestratorOptions {
  config: DebateConfig;
  sessionId: string;
  contextFiles?: Array<{ name: string; content: string }>;
  onEvent: EventEmitter;
  existingState?: DebateState;
  userInput?: string;
}

function emitEvent(onEvent: EventEmitter, type: SSEEventType, data: unknown): void {
  onEvent({
    type,
    data,
    timestamp: new Date().toISOString(),
  });
}

export async function runDebate(options: OrchestratorOptions): Promise<DebateState> {
  const { config, sessionId, contextFiles, onEvent, existingState, userInput } = options;

  // Initialize or restore state
  let state: DebateState = existingState || {
    config,
    status: 'running',
    currentRound: 1,
    rounds: [],
    userInputs: [],
    startedAt: new Date().toISOString(),
  };

  // Handle user input if provided (resuming after USER_INPUT_NEEDED)
  if (userInput && state.rounds.length > 0) {
    state.userInputs.push({
      round: state.currentRound - 1,
      input: userInput,
      timestamp: new Date().toISOString(),
    });
  }

  // Initialize session files if provided
  if (contextFiles && contextFiles.length > 0) {
    await initSessionFiles(sessionId, contextFiles);
  }

  try {
    state.status = 'running';
    emitEvent(onEvent, 'debate_started', {
      topic: config.topic,
      maxRounds: config.maxRounds,
      models: config.models,
    });

    // Main debate loop
    while (state.currentRound <= config.maxRounds && state.status === 'running') {
      const round = state.currentRound;

      emitEvent(onEvent, 'round_started', { round });

      // Run Debater A
      const debaterAConfig: DebaterConfig = {
        name: config.debaterAName,
        model: config.models.debaterA,
        topic: config.topic,
        context: config.context,
        opponentName: config.debaterBName,
      };

      const debaterAResult = await runDebaterTurn(
        debaterAConfig,
        round,
        state.rounds,
        state.userInputs,
        sessionId,
        (thinking) => emitEvent(onEvent, 'debater_a_thinking', { thinking }),
        (text) => emitEvent(onEvent, 'debater_a_text', { text }),
        (name, input) => emitEvent(onEvent, 'debater_a_tool_use', { name, input })
      );

      emitEvent(onEvent, 'debater_a_complete', {
        output: debaterAResult.output,
        toolCalls: debaterAResult.toolCalls,
      });

      // Run Debater B
      const debaterBConfig: DebaterConfig = {
        name: config.debaterBName,
        model: config.models.debaterB,
        topic: config.topic,
        context: config.context,
        opponentName: config.debaterAName,
      };

      const debaterBResult = await runDebaterTurn(
        debaterBConfig,
        round,
        state.rounds,
        state.userInputs,
        sessionId,
        (thinking) => emitEvent(onEvent, 'debater_b_thinking', { thinking }),
        (text) => emitEvent(onEvent, 'debater_b_text', { text }),
        (name, input) => emitEvent(onEvent, 'debater_b_tool_use', { name, input })
      );

      emitEvent(onEvent, 'debater_b_complete', {
        output: debaterBResult.output,
        toolCalls: debaterBResult.toolCalls,
      });

      // Run Referee
      const refereeConfig: RefereeConfig = {
        model: config.models.referee,
        topic: config.topic,
        context: config.context,
        maxRounds: config.maxRounds,
        debaterAName: config.debaterAName,
        debaterBName: config.debaterBName,
      };

      const refereeResult = await runRefereeTurn(
        refereeConfig,
        round,
        debaterAResult.output,
        debaterBResult.output,
        state.rounds,
        state.userInputs,
        (thinking) => emitEvent(onEvent, 'referee_thinking', { thinking }),
        (text) => emitEvent(onEvent, 'referee_text', { text })
      );

      // Check for deadlock if referee says CONTINUE
      if (refereeResult.output.verdict === 'CONTINUE' && checkForDeadlock(state.rounds)) {
        refereeResult.output.verdict = 'DEADLOCK';
        refereeResult.output.deadlock_reason =
          'Positions have been stable for 3+ rounds with no significant progress.';
      }

      emitEvent(onEvent, 'referee_complete', { output: refereeResult.output });

      // Record round data
      const roundData: RoundData = {
        round,
        debaterAOutput: debaterAResult.output,
        debaterBOutput: debaterBResult.output,
        refereeOutput: refereeResult.output,
        timestamp: new Date().toISOString(),
      };

      state.rounds.push(roundData);

      emitEvent(onEvent, 'round_complete', { roundData });

      // Handle verdict
      switch (refereeResult.output.verdict) {
        case 'CONSENSUS_REACHED':
          state.status = 'completed';
          emitEvent(onEvent, 'debate_complete', {
            verdict: 'CONSENSUS_REACHED',
            consensus: refereeResult.output.consensus_statement,
            rounds: state.rounds.length,
          });
          break;

        case 'USER_INPUT_NEEDED':
          state.status = 'paused';
          emitEvent(onEvent, 'user_input_needed', {
            prompt: refereeResult.output.user_input_prompt,
            round,
          });
          return state; // Return state for resumption

        case 'DEADLOCK':
          state.status = 'completed';
          emitEvent(onEvent, 'debate_complete', {
            verdict: 'DEADLOCK',
            reason: refereeResult.output.deadlock_reason,
            rounds: state.rounds.length,
          });
          break;

        case 'MAX_ROUNDS_REACHED':
          state.status = 'completed';
          emitEvent(onEvent, 'debate_complete', {
            verdict: 'MAX_ROUNDS_REACHED',
            rounds: state.rounds.length,
          });
          break;

        case 'CONTINUE':
          state.currentRound++;
          break;
      }
    }

    // If we exit loop due to max rounds without explicit verdict
    if (state.currentRound > config.maxRounds && state.status === 'running') {
      state.status = 'completed';
      emitEvent(onEvent, 'debate_complete', {
        verdict: 'MAX_ROUNDS_REACHED',
        rounds: state.rounds.length,
      });
    }

    state.completedAt = new Date().toISOString();
    return state;
  } catch (error) {
    state.status = 'error';
    state.error = error instanceof Error ? error.message : 'Unknown error';
    emitEvent(onEvent, 'error', { error: state.error });
    throw error;
  } finally {
    // Cleanup session files
    if (state.status === 'completed' || state.status === 'error') {
      await cleanupSession(sessionId).catch(() => {});
    }
  }
}

// Helper to resume debate after user input
export async function resumeDebate(
  state: DebateState,
  sessionId: string,
  userInput: string,
  onEvent: EventEmitter
): Promise<DebateState> {
  return runDebate({
    config: state.config,
    sessionId,
    onEvent,
    existingState: {
      ...state,
      status: 'running',
    },
    userInput,
  });
}
