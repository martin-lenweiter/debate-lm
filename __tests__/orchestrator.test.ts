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

    it('should emit user_input_needed event with correct prompt and round', async () => {
      const { runRefereeTurn } = await import('@/lib/referee');
      const { runDebate } = await import('@/lib/orchestrator');

      vi.mocked(runRefereeTurn).mockClear();
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'Ambiguous topic',
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
          user_input_prompt: 'What specific aspect would you like us to focus on?',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      const events: SSEEvent[] = [];
      const onEvent = (event: SSEEvent) => events.push(event);

      await runDebate({
        config: {
          topic: 'Test',
          maxRounds: 5,
          models: { debaterA: 'haiku', debaterB: 'haiku', referee: 'haiku' },
          debaterAName: 'A',
          debaterBName: 'B',
        },
        sessionId: 'test-session-events',
        onEvent,
      });

      const userInputEvent = events.find((e) => e.type === 'user_input_needed');
      expect(userInputEvent).toBeDefined();
      expect((userInputEvent?.data as { prompt: string; round: number }).prompt).toBe(
        'What specific aspect would you like us to focus on?'
      );
      expect((userInputEvent?.data as { prompt: string; round: number }).round).toBe(1);
    });

    it('should record user input with correct round number (round before pause)', async () => {
      const { runRefereeTurn } = await import('@/lib/referee');
      const { runDebate, resumeDebate } = await import('@/lib/orchestrator');

      vi.mocked(runRefereeTurn).mockClear();

      // Round 1: CONTINUE
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'CONTINUE',
          round_summary: 'Good progress',
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

      // Round 2: USER_INPUT_NEEDED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'Need clarification',
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
          user_input_prompt: 'Clarify please',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      // Round 3: CONSENSUS_REACHED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'CONSENSUS_REACHED',
          round_summary: 'Agreement',
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
          areas_of_agreement: ['All'],
          areas_of_disagreement: [],
          consensus_statement: 'Done',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      const events: SSEEvent[] = [];
      const onEvent = (event: SSEEvent) => events.push(event);

      const pausedState = await runDebate({
        config: {
          topic: 'Test',
          maxRounds: 5,
          models: { debaterA: 'haiku', debaterB: 'haiku', referee: 'haiku' },
          debaterAName: 'A',
          debaterBName: 'B',
        },
        sessionId: 'test-session-round-tracking',
        onEvent,
      });

      // Paused after round 2
      expect(pausedState.rounds.length).toBe(2);
      expect(pausedState.currentRound).toBe(3);

      const finalState = await resumeDebate(
        pausedState,
        'test-session-round-tracking',
        'My clarification',
        onEvent
      );

      // User input should be recorded for round 2 (the round where pause occurred)
      expect(finalState.userInputs.length).toBe(1);
      expect(finalState.userInputs[0].round).toBe(2);
      expect(finalState.userInputs[0].input).toBe('My clarification');
      expect(finalState.userInputs[0].timestamp).toBeDefined();
    });

    it('should handle multiple USER_INPUT_NEEDED cycles correctly', async () => {
      const { runRefereeTurn } = await import('@/lib/referee');
      const { runDebaterTurn } = await import('@/lib/debater');
      const { runDebate, resumeDebate } = await import('@/lib/orchestrator');

      vi.mocked(runRefereeTurn).mockClear();
      vi.mocked(runDebaterTurn).mockClear();

      // Round 1: USER_INPUT_NEEDED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'First pause',
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
          user_input_prompt: 'First question',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      // Round 2: USER_INPUT_NEEDED again
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'Second pause',
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
          user_input_prompt: 'Second question',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      // Round 3: CONSENSUS_REACHED
      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'CONSENSUS_REACHED',
          round_summary: 'Final',
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
          areas_of_agreement: ['All'],
          areas_of_disagreement: [],
          consensus_statement: 'Agreed',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      const events: SSEEvent[] = [];
      const onEvent = (event: SSEEvent) => events.push(event);

      // First run - pause at round 1
      const state1 = await runDebate({
        config: {
          topic: 'Test',
          maxRounds: 5,
          models: { debaterA: 'haiku', debaterB: 'haiku', referee: 'haiku' },
          debaterAName: 'A',
          debaterBName: 'B',
        },
        sessionId: 'test-multi-pause',
        onEvent,
      });

      expect(state1.status).toBe('paused');
      expect(state1.rounds.length).toBe(1);
      expect(state1.currentRound).toBe(2);

      // First resume - pause again at round 2
      const state2 = await resumeDebate(state1, 'test-multi-pause', 'First answer', onEvent);

      expect(state2.status).toBe('paused');
      expect(state2.rounds.length).toBe(2);
      expect(state2.currentRound).toBe(3);
      expect(state2.userInputs.length).toBe(1);
      expect(state2.userInputs[0].input).toBe('First answer');
      expect(state2.userInputs[0].round).toBe(1);

      // Second resume - complete
      const state3 = await resumeDebate(state2, 'test-multi-pause', 'Second answer', onEvent);

      expect(state3.status).toBe('completed');
      expect(state3.rounds.length).toBe(3);
      expect(state3.userInputs.length).toBe(2);
      expect(state3.userInputs[1].input).toBe('Second answer');
      expect(state3.userInputs[1].round).toBe(2);

      // Verify debater calls: 2 per round * 3 rounds = 6 total
      expect(vi.mocked(runDebaterTurn).mock.calls.length).toBe(6);

      // Verify events: 3 round_started events
      const roundsStarted = events.filter((e) => e.type === 'round_started');
      expect(roundsStarted.length).toBe(3);
      expect(roundsStarted.map((e) => (e.data as { round: number }).round)).toEqual([1, 2, 3]);
    });

    it('should preserve existing state data when resuming', async () => {
      const { runRefereeTurn } = await import('@/lib/referee');
      const { runDebate, resumeDebate } = await import('@/lib/orchestrator');

      vi.mocked(runRefereeTurn).mockClear();

      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'USER_INPUT_NEEDED',
          round_summary: 'Need input',
          debater_a_assessment: {
            strengths: ['Strong argument'],
            weaknesses: ['Lacks evidence'],
            evidence_quality: 0.7,
            reasoning_quality: 0.8,
          },
          debater_b_assessment: {
            strengths: ['Good logic'],
            weaknesses: ['Too verbose'],
            evidence_quality: 0.6,
            reasoning_quality: 0.9,
          },
          areas_of_agreement: ['Point 1'],
          areas_of_disagreement: ['Point 2'],
          user_input_prompt: 'Please help',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      vi.mocked(runRefereeTurn).mockResolvedValueOnce({
        output: {
          verdict: 'CONSENSUS_REACHED',
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
          areas_of_agreement: ['All'],
          areas_of_disagreement: [],
          consensus_statement: 'Agreed',
        },
        thinkingBlocks: [],
        rawResponse: '{}',
      });

      const events: SSEEvent[] = [];
      const onEvent = (event: SSEEvent) => events.push(event);

      const pausedState = await runDebate({
        config: {
          topic: 'Preservation test',
          maxRounds: 5,
          models: { debaterA: 'haiku', debaterB: 'haiku', referee: 'haiku' },
          debaterAName: 'Alice',
          debaterBName: 'Bob',
        },
        sessionId: 'test-preserve',
        onEvent,
      });

      // Capture round 1 data
      const round1Data = pausedState.rounds[0];
      expect(round1Data.refereeOutput.debater_a_assessment.strengths).toContain('Strong argument');

      const finalState = await resumeDebate(pausedState, 'test-preserve', 'User input', onEvent);

      // Original round data should be preserved
      expect(finalState.rounds[0]).toEqual(round1Data);
      expect(finalState.config.topic).toBe('Preservation test');
      expect(finalState.config.debaterAName).toBe('Alice');
      expect(finalState.config.debaterBName).toBe('Bob');
      expect(finalState.startedAt).toBe(pausedState.startedAt);
    });
  });
});
