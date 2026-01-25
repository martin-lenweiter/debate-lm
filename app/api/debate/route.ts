import { NextRequest } from 'next/server';
import { runDebate, resumeDebate } from '@/lib/orchestrator';
import { DebateConfigSchema, type SSEEvent, type DebateState } from '@/lib/schemas';

export const maxDuration = 300; // 5 minutes

// Store active debate states (in production, use Redis or database)
const debateStates = new Map<string, DebateState>();

function generateSessionId(): string {
  return `debate-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();

    // Check if this is a resume request
    if (body.resumeSessionId && body.userInput) {
      const existingState = debateStates.get(body.resumeSessionId);
      if (!existingState) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: SSEEvent) => {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          try {
            const finalState = await resumeDebate(
              existingState,
              body.resumeSessionId,
              body.userInput,
              sendEvent
            );

            debateStates.set(body.resumeSessionId, finalState);

            // Send final state
            sendEvent({
              type: 'debate_complete',
              data: { state: finalState },
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            sendEvent({
              type: 'error',
              data: { error: message },
              timestamp: new Date().toISOString(),
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // New debate request
    const parseResult = DebateConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid configuration',
          details: parseResult.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = parseResult.data;
    const sessionId = generateSessionId();

    // Parse context files if provided
    const contextFiles: Array<{ name: string; content: string }> = [];
    if (body.contextFiles && Array.isArray(body.contextFiles)) {
      for (const file of body.contextFiles) {
        if (file.name && file.content) {
          contextFiles.push({ name: file.name, content: file.content });
        }
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: SSEEvent) => {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        // Send session ID first
        sendEvent({
          type: 'debate_started',
          data: { sessionId },
          timestamp: new Date().toISOString(),
        });

        try {
          const finalState = await runDebate({
            config,
            sessionId,
            contextFiles,
            onEvent: sendEvent,
          });

          debateStates.set(sessionId, finalState);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          sendEvent({
            type: 'error',
            data: { error: message },
            timestamp: new Date().toISOString(),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Get debate state
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const state = debateStates.get(sessionId);

  if (!state) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  });
}
