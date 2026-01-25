import { describe, it, expect, vi } from 'vitest';
import type { DebateState, SSEEvent } from '@/lib/schemas';

// Mock the debater and referee modules to avoid actual API calls
vi.mock('@/lib/debater', () => ({
  runDebaterTurn: vi.fn().mockResolvedValue({
    output: {
      position: 'Test position',
      confidence: 0.8,
      claims: [],
      counterarguments: [],
      reasoning_summary: 'Test reasoning',
    },
    toolCalls: [],
    thinkingBlocks: [],
    rawResponse: '{}',
  }),
}));

vi.mock('@/lib/referee', () => ({
  runRefereeTurn: vi.fn(),
  checkForDeadlock: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/tools/file-ops', () => ({
  initSessionFiles: vi.fn().mockResolvedValue(undefined),
  cleanupSession: vi.fn().mockResolvedValue(undefined),
}));

describe('Orchestrator', () => {
  describe('USER_INPUT_NEEDED handling', () => {
    it('should increment currentRound when USER_INPUT_NEEDED so resume continues to next round', async () => {
      const { runRefereeTurn } = await import('@/lib/referee');
      const { runDebate, resumeDebate } = await import('@/lib/orchestrator');

      // First call returns USER_INPUT_NEEDED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'Need user input',
          debater_a_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          debater_b_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          areas_of_agreement: [],
          areas_of_disagreement: [],
          user_input_prompt: 'Please clarify your question',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      // Second call (after resume) returns CONSENSUS_REACHED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'CONSENSUS_REACHED',
          round_summary: 'Consensus reached',
          debater_a_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          debater_b_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          areas_of_agreement: ['All agree'],
          areas_of_disagreement: [],
          consensus_statement: 'We agree',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      const events: SSEEvent[] = [];
      const onEvent = (event: SSEEvent) => events.push(event);

      // Run initial debate - should pause at USER_INPUT_NEEDED
      const pausedState = await runDebate({
        config: {
          topic: 'Test topic',
          maxRounds: 5,
          models: { debaterA: 'haiku', debaterB: 'haiku', referee: 'haiku' },
          debaterAName: 'A',
          debaterBName: 'B',
        },
        sessionId: 'test-session',
        onEvent,
      });

      expect(pausedState.status).toBe('paused');
      expect(pausedState.rounds.length).toBe(1);
      // Critical: currentRound should be 2 after USER_INPUT_NEEDED in round 1
      expect(pausedState.currentRound).toBe(2);

      // Resume with user input
      const resumedState = await resumeDebate(
        pausedState,
        'test-session',
        'User provided clarification',
        onEvent
      );

      expect(resumedState.status).toBe('completed');
      // Should have 2 rounds total (round 1 before pause, round 2 after resume)
      expect(resumedState.rounds.length).toBe(2);
      // User input should be recorded
      expect(resumedState.userInputs.length).toBe(1);
      expect(resumedState.userInputs[0].input).toBe('User provided clarification');
    });

    it('should not re-run the same round after resuming from USER_INPUT_NEEDED', async () => {
      const { runRefereeTurn } = await import('@/lib/referee');
      const { runDebaterTurn } = await import('@/lib/debater');
      const { runDebate, resumeDebate } = await import('@/lib/orchestrator');

      // Reset mocks
      vi.mocked(runDebaterTurn).mockClear();
      vi.mocked(runRefereeTurn).mockClear();

      // First call returns USER_INPUT_NEEDED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'Need input',
          debater_a_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          debater_b_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          areas_of_agreement: [],
          areas_of_disagreement: [],
          user_input_prompt: 'Clarify',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      // Second call returns MAX_ROUNDS_REACHED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'MAX_ROUNDS_REACHED',
          round_summary: 'Done',
          debater_a_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          debater_b_assessment: {
            strengths: [],
            weaknesses: [],
            evidence_quality: 0.5,
            reasoning_quality: 0.5,
          },
          areas_of_agreement: [],
          areas_of_disagreement: [],
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      const events: SSEEvent[] = [];
      const onEvent = (event: SSEEvent) => events.push(event);

      // Run initial debate
      const pausedState = await runDebate({
        config: {
          topic: 'Test',
          maxRounds: 5,
          models: { debaterA: 'haiku', debaterB: 'haiku', referee: 'haiku' },
          debaterAName: 'A',
          debaterBName: 'B',
        },
        sessionId: 'test-session-2',
        onEvent,
      });

      // Count debater calls before resume
      const debaterCallsBeforeResume = vi.mocked(runDebaterTurn).mock.calls.length;
      expect(debaterCallsBeforeResume).toBe(2); // A and B for round 1

      // Resume
      await resumeDebate(pausedState, 'test-session-2', 'User input', onEvent);

      // Should have called debaters 2 more times (A and B for round 2)
      const debaterCallsAfterResume = vi.mocked(runDebaterTurn).mock.calls.length;
      expect(debaterCallsAfterResume).toBe(4); // 2 + 2 = 4 total

      // Verify rounds are different
      const roundsStarted = events.filter((e) => e.type === 'round_started');
      const roundNumbers = roundsStarted.map((e) => (e.data as { round: number }).round);
      // Should be [1, 2], not [1, 1]
      expect(roundNumbers).toEqual([1, 2]);
    });
  });
});
