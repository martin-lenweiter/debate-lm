'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RefereeOutput, ModelType } from '@/lib/schemas';
import { CheckCircle, XCircle, AlertCircle, HelpCircle, Clock } from 'lucide-react';

interface RefereeViewProps {
  model: ModelType;
  output?: RefereeOutput;
  isThinking?: boolean;
  thinkingText?: string;
  debaterAName: string;
  debaterBName: string;
}

const verdictIcons: Record<string, React.ReactNode> = {
  CONTINUE: <Clock className="h-5 w-5 text-blue-500" />,
  CONSENSUS_REACHED: <CheckCircle className="h-5 w-5 text-green-500" />,
  USER_INPUT_NEEDED: <HelpCircle className="h-5 w-5 text-yellow-500" />,
  DEADLOCK: <XCircle className="h-5 w-5 text-red-500" />,
  MAX_ROUNDS_REACHED: <AlertCircle className="h-5 w-5 text-orange-500" />,
};

const verdictColors: Record<string, string> = {
  CONTINUE: 'bg-blue-100 text-blue-800 border-blue-200',
  CONSENSUS_REACHED: 'bg-green-100 text-green-800 border-green-200',
  USER_INPUT_NEEDED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  DEADLOCK: 'bg-red-100 text-red-800 border-red-200',
  MAX_ROUNDS_REACHED: 'bg-orange-100 text-orange-800 border-orange-200',
};

export function RefereeView({
  model,
  output,
  isThinking,
  thinkingText,
}: RefereeViewProps) {
  return (
    <Card className="border-l-4 border-l-referee">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Referee
            <Badge variant="referee" className="text-xs">
              {model === 'opus' ? 'Opus 4.5' : 'Sonnet 4.5'}
            </Badge>
          </CardTitle>
          {output && (
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                verdictColors[output.verdict]
              }`}
            >
              {verdictIcons[output.verdict]}
              <span className="text-sm font-medium">
                {output.verdict.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isThinking && (
          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="thinking-dots">Evaluating</span>
            </div>
            {thinkingText && (
              <p className="text-sm mt-2 italic text-muted-foreground line-clamp-3">
                {thinkingText}
              </p>
            )}
          </div>
        )}

        {output && (
          <>
            {/* Summary */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Analysis</h4>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {output.summary}
              </div>
            </div>

            {/* Consensus Statement */}
            {output.consensus_statement && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <h4 className="text-sm font-semibold text-green-800 mb-1">
                  Consensus Reached
                </h4>
                <p className="text-sm text-green-700">
                  {output.consensus_statement}
                </p>
              </div>
            )}

            {/* User Input Prompt */}
            {output.user_input_prompt && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                  Input Needed
                </h4>
                <p className="text-sm text-yellow-700">
                  {output.user_input_prompt}
                </p>
              </div>
            )}

            {/* Deadlock Reason */}
            {output.deadlock_reason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <h4 className="text-sm font-semibold text-red-800 mb-1">
                  Deadlock
                </h4>
                <p className="text-sm text-red-700">{output.deadlock_reason}</p>
              </div>
            )}
          </>
        )}

        {!output && !isThinking && (
          <p className="text-sm text-muted-foreground italic">
            Waiting for debaters...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
