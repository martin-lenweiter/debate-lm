'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ModelSelector } from './model-selector';
import { DebaterView } from './debater-view';
import { RefereeView } from './referee-view';
import { StateViewer } from './state-viewer';
import { UserInputModal } from './user-input-modal';
import type {
  ModelConfig,
  DebateConfig,
  RoundData,
  DebaterOutput,
  RefereeOutput,
  SSEEvent,
} from '@/lib/schemas';
import {
  Play,
  Upload,
  X,
  ArrowLeft,
  Users,
  Settings,
  FileText,
  Loader2,
} from 'lucide-react';

type DebateStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

interface CurrentRoundState {
  debaterAOutput?: DebaterOutput;
  debaterBOutput?: DebaterOutput;
  refereeOutput?: RefereeOutput;
  debaterAThinking?: string;
  debaterBThinking?: string;
  refereeThinking?: string;
  debaterAToolUse?: { name: string; input: unknown };
  debaterBToolUse?: { name: string; input: unknown };
  activeAgent?: 'debaterA' | 'debaterB' | 'referee';
}

export function DebateInterface() {
  // Setup state
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [maxRounds, setMaxRounds] = useState(5);
  const [debaterAName, setDebaterAName] = useState('Debater A');
  const [debaterBName, setDebaterBName] = useState('Debater B');
  const [models, setModels] = useState<ModelConfig>({
    debaterA: 'sonnet',
    debaterB: 'sonnet',
    referee: 'sonnet',
  });

  // Debate state
  const [status, setStatus] = useState<DebateStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [currentRound, setCurrentRound] = useState<CurrentRoundState>({});
  const [roundNumber, setRoundNumber] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // User input modal
  const [userInputPrompt, setUserInputPrompt] = useState<string | null>(null);

  // File upload
  const [contextFiles, setContextFiles] = useState<
    Array<{ name: string; content: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: Array<{ name: string; content: string }> = [];
    const fileArray = Array.from(files);
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const content = await file.text();
        newFiles.push({ name: file.name, content });
      } catch (err) {
        console.error(`Failed to read file ${file.name}:`, err);
      }
    }
    setContextFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setContextFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'debate_started':
        setSessionId((event.data as { sessionId?: string }).sessionId || null);
        break;

      case 'round_started':
        setRoundNumber((event.data as { round: number }).round);
        setCurrentRound({});
        break;

      case 'debater_a_thinking':
        setCurrentRound((prev) => ({
          ...prev,
          activeAgent: 'debaterA',
          debaterAThinking: (event.data as { thinking: string }).thinking,
        }));
        break;

      case 'debater_a_complete':
        setCurrentRound((prev) => ({
          ...prev,
          debaterAOutput: (event.data as { output: DebaterOutput }).output,
          debaterAThinking: undefined,
          debaterAToolUse: undefined,
          activeAgent: undefined,
        }));
        break;

      case 'debater_a_tool_use':
        setCurrentRound((prev) => ({
          ...prev,
          activeAgent: 'debaterA',
          debaterAToolUse: event.data as { name: string; input: unknown },
        }));
        break;

      case 'debater_b_thinking':
        setCurrentRound((prev) => ({
          ...prev,
          activeAgent: 'debaterB',
          debaterBThinking: (event.data as { thinking: string }).thinking,
        }));
        break;

      case 'debater_b_complete':
        setCurrentRound((prev) => ({
          ...prev,
          debaterBOutput: (event.data as { output: DebaterOutput }).output,
          debaterBThinking: undefined,
          debaterBToolUse: undefined,
          activeAgent: undefined,
        }));
        break;

      case 'debater_b_tool_use':
        setCurrentRound((prev) => ({
          ...prev,
          activeAgent: 'debaterB',
          debaterBToolUse: event.data as { name: string; input: unknown },
        }));
        break;

      case 'referee_thinking':
        setCurrentRound((prev) => ({
          ...prev,
          activeAgent: 'referee',
          refereeThinking: (event.data as { thinking: string }).thinking,
        }));
        break;

      case 'referee_complete':
        setCurrentRound((prev) => ({
          ...prev,
          refereeOutput: (event.data as { output: RefereeOutput }).output,
          refereeThinking: undefined,
          activeAgent: undefined,
        }));
        break;

      case 'round_complete': {
        const roundData = (event.data as { roundData: RoundData }).roundData;
        setRounds((prev) => [...prev, roundData]);
        setCurrentRound({});
        break;
      }

      case 'user_input_needed':
        setStatus('paused');
        setUserInputPrompt((event.data as { prompt: string }).prompt);
        break;

      case 'debate_complete':
        setStatus('completed');
        break;

      case 'error':
        setError((event.data as { error: string }).error);
        setStatus('error');
        break;
    }
  }, []);

  const startDebate = useCallback(async () => {
    if (!topic.trim()) return;

    setStatus('running');
    setError(null);
    setRounds([]);
    setCurrentRound({});
    setRoundNumber(1);

    const config: DebateConfig = {
      topic: topic.trim(),
      context: context.trim() || undefined,
      maxRounds,
      models,
      debaterAName,
      debaterBName,
    };

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          contextFiles,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start debate');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              handleSSEEvent(event);
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // Detect common network/timeout errors and provide helpful messages
      if (message.toLowerCase().includes('network') ||
          message.toLowerCase().includes('failed to fetch') ||
          message.toLowerCase().includes('aborted')) {
        setError('Connection lost. The server may have timed out. Try a simpler topic or refresh the page.');
      } else {
        setError(message);
      }
      setStatus('error');
    }
  }, [
    topic,
    context,
    maxRounds,
    models,
    debaterAName,
    debaterBName,
    contextFiles,
    handleSSEEvent,
  ]);

  const submitUserInput = useCallback(
    async (input: string) => {
      if (!sessionId) return;

      setUserInputPrompt(null);
      setStatus('running');

      try {
        const response = await fetch('/api/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeSessionId: sessionId,
            userInput: input,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to resume debate');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6));
                handleSSEEvent(event);
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [sessionId, handleSSEEvent]
  );

  const cancelDebate = useCallback(() => {
    setUserInputPrompt(null);
    setStatus('completed');
  }, []);

  const resetDebate = useCallback(() => {
    setStatus('idle');
    setSessionId(null);
    setRounds([]);
    setCurrentRound({});
    setRoundNumber(0);
    setError(null);
    setUserInputPrompt(null);
  }, []);

  // Full-page Setup Screen
  if (status === 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto py-12 px-4 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3">DebateLM</h1>
            <p className="text-lg text-muted-foreground">
              Multi-LLM debate system for truth-seeking through structured
              argumentation
            </p>
          </div>

          {/* Main Setup Card */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configure Your Debate
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Topic Section */}
              <div className="space-y-3">
                <Label htmlFor="topic" className="text-base font-medium">
                  Debate Topic
                </Label>
                <Textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What question or topic should the debaters explore? Be specific for better results..."
                  className="min-h-[120px] text-base"
                />
              </div>

              {/* Context Section */}
              <div className="space-y-3">
                <Label htmlFor="context" className="text-base font-medium">
                  Additional Context{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Provide background information, constraints, or specific angles to consider..."
                  className="min-h-[100px]"
                />
              </div>

              {/* File Upload Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Context Files{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Upload documents for debaters to reference
                  </p>
                </div>
                {contextFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {contextFiles.map((file, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="pl-3 pr-1 py-1.5 flex items-center gap-2"
                      >
                        <FileText className="h-3 w-3" />
                        {file.name}
                        <button
                          onClick={() => removeFile(idx)}
                          className="ml-1 hover:bg-muted rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Debaters Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Debaters
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-l-4 border-l-debaterA">
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="debaterA">Name</Label>
                        <Input
                          id="debaterA"
                          value={debaterAName}
                          onChange={(e) => setDebaterAName(e.target.value)}
                        />
                      </div>
                      <ModelSelector
                        label="Model"
                        value={models.debaterA}
                        onChange={(v) =>
                          setModels((m) => ({ ...m, debaterA: v }))
                        }
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-debaterB">
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="debaterB">Name</Label>
                        <Input
                          id="debaterB"
                          value={debaterBName}
                          onChange={(e) => setDebaterBName(e.target.value)}
                        />
                      </div>
                      <ModelSelector
                        label="Model"
                        value={models.debaterB}
                        onChange={(v) =>
                          setModels((m) => ({ ...m, debaterB: v }))
                        }
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Settings Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxRounds">Maximum Rounds</Label>
                  <Input
                    id="maxRounds"
                    type="number"
                    min={1}
                    max={20}
                    value={maxRounds}
                    onChange={(e) =>
                      setMaxRounds(parseInt(e.target.value) || 5)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <ModelSelector
                    label="Referee Model"
                    value={models.referee}
                    onChange={(v) => setModels((m) => ({ ...m, referee: v }))}
                  />
                </div>
              </div>

              {/* Start Button */}
              <div className="pt-4">
                <Button
                  onClick={startDebate}
                  disabled={!topic.trim()}
                  size="lg"
                  className="w-full text-lg h-14"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start Debate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Full-page Debate Screen
  return (
    <div className="min-h-screen flex flex-col">
      {/* Debate Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold truncate">{topic}</h1>
                <Badge
                  variant={
                    status === 'running'
                      ? 'default'
                      : status === 'completed'
                        ? 'secondary'
                        : status === 'error'
                          ? 'destructive'
                          : 'outline'
                  }
                >
                  {status === 'running' && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  <span className="text-debaterA font-medium">
                    {debaterAName}
                  </span>{' '}
                  vs{' '}
                  <span className="text-debaterB font-medium">
                    {debaterBName}
                  </span>
                </span>
                <span>Round {roundNumber} / {maxRounds}</span>
                {contextFiles.length > 0 && (
                  <span>{contextFiles.length} file(s)</span>
                )}
                {context && <span>+ context</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(status === 'completed' || status === 'error') && (
                <Button onClick={resetDebate} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  New Debate
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Debate Content */}
          <div className="xl:col-span-3">
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Tabs defaultValue="current" className="space-y-4">
              <TabsList>
                <TabsTrigger value="current">
                  Current Round {roundNumber > 0 && `(${roundNumber})`}
                </TabsTrigger>
                <TabsTrigger value="history" disabled={rounds.length === 0}>
                  History ({rounds.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DebaterView
                    name={debaterAName}
                    model={models.debaterA}
                    output={currentRound.debaterAOutput}
                    isThinking={currentRound.activeAgent === 'debaterA'}
                    thinkingText={currentRound.debaterAThinking}
                    toolUse={currentRound.debaterAToolUse}
                    variant="A"
                  />
                  <DebaterView
                    name={debaterBName}
                    model={models.debaterB}
                    output={currentRound.debaterBOutput}
                    isThinking={currentRound.activeAgent === 'debaterB'}
                    thinkingText={currentRound.debaterBThinking}
                    toolUse={currentRound.debaterBToolUse}
                    variant="B"
                  />
                </div>
                <RefereeView
                  model={models.referee}
                  output={currentRound.refereeOutput}
                  isThinking={currentRound.activeAgent === 'referee'}
                  thinkingText={currentRound.refereeThinking}
                  debaterAName={debaterAName}
                  debaterBName={debaterBName}
                />
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                {rounds.map((round, idx) => (
                  <div key={idx} className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">
                      Round {round.round}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DebaterView
                        name={debaterAName}
                        model={models.debaterA}
                        output={round.debaterAOutput}
                        variant="A"
                      />
                      <DebaterView
                        name={debaterBName}
                        model={models.debaterB}
                        output={round.debaterBOutput}
                        variant="B"
                      />
                    </div>
                    <RefereeView
                      model={models.referee}
                      output={round.refereeOutput}
                      debaterAName={debaterAName}
                      debaterBName={debaterBName}
                    />
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* State Viewer Sidebar */}
          <div className="xl:col-span-1">
            {rounds.length > 0 && (
              <StateViewer
                rounds={rounds}
                debaterAName={debaterAName}
                debaterBName={debaterBName}
              />
            )}
          </div>
        </div>
      </main>

      {/* User Input Modal */}
      <UserInputModal
        open={!!userInputPrompt}
        prompt={userInputPrompt || ''}
        onSubmit={submitUserInput}
        onCancel={cancelDebate}
      />
    </div>
  );
}
