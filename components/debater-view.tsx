'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { DebaterOutput, ModelType } from '@/lib/schemas';
import { ExternalLink } from 'lucide-react';

interface DebaterViewProps {
  name: string;
  model: ModelType;
  output?: DebaterOutput;
  isThinking?: boolean;
  thinkingText?: string;
  variant: 'A' | 'B';
}

export function DebaterView({
  name,
  model,
  output,
  isThinking,
  thinkingText,
  variant,
}: DebaterViewProps) {
  const badgeVariant = variant === 'A' ? 'debaterA' : 'debaterB';
  const borderColor =
    variant === 'A' ? 'border-l-debaterA' : 'border-l-debaterB';

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {name}
            <Badge variant={badgeVariant} className="text-xs">
              {model === 'opus' ? 'Opus 4.5' : 'Sonnet 4.5'}
            </Badge>
          </CardTitle>
          {output && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <Progress
                value={output.confidence * 100}
                className="w-24 h-2"
              />
              <span className="text-sm font-medium">
                {Math.round(output.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isThinking && (
          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="thinking-dots">Thinking</span>
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
            {/* Argument */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Argument</h4>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {output.argument}
              </div>
            </div>

            {/* Sources */}
            {output.sources && output.sources.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Sources</h4>
                <div className="space-y-1">
                  {output.sources.map((source, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Badge variant="outline" className="text-xs">
                        {source.type}
                      </Badge>
                      <span>{source.label}</span>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concessions */}
            {output.concessions && output.concessions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-amber-600">
                  Concessions
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {output.concessions.map((c, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {!output && !isThinking && (
          <p className="text-sm text-muted-foreground italic">
            Waiting for turn...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
