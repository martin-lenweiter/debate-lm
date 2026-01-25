'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EvidenceCard } from './evidence-card';
import type { DebaterOutput, ModelType } from '@/lib/schemas';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

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
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());

  const badgeVariant = variant === 'A' ? 'debaterA' : 'debaterB';
  const borderColor =
    variant === 'A' ? 'border-l-debaterA' : 'border-l-debaterB';

  const toggleClaim = (index: number) => {
    const next = new Set(expandedClaims);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setExpandedClaims(next);
  };

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
            {/* Position */}
            <div>
              <h4 className="text-sm font-semibold mb-1">Position</h4>
              <p className="text-sm">{output.position}</p>
            </div>

            {/* Claims */}
            {output.claims.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Claims ({output.claims.length})
                </h4>
                <div className="space-y-2">
                  {output.claims.map((claim, idx) => (
                    <div
                      key={idx}
                      className="border rounded-md overflow-hidden"
                    >
                      <button
                        onClick={() => toggleClaim(idx)}
                        className="w-full p-3 text-left hover:bg-muted/50 flex items-start justify-between gap-2"
                      >
                        <div className="flex-1">
                          <p className="text-sm">{claim.statement}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {Math.round(claim.confidence * 100)}% confident
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {claim.sources.length} source
                              {claim.sources.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        {expandedClaims.has(idx) ? (
                          <ChevronUp className="h-4 w-4 mt-1 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
                        )}
                      </button>
                      {expandedClaims.has(idx) && (
                        <div className="p-3 pt-0 space-y-2">
                          {claim.sources.map((source, sIdx) => (
                            <EvidenceCard key={sIdx} source={source} />
                          ))}
                          {claim.rebuttals_considered &&
                            claim.rebuttals_considered.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-2">
                                <span className="font-medium">
                                  Rebuttals considered:
                                </span>{' '}
                                {claim.rebuttals_considered.join('; ')}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Counterarguments */}
            {output.counterarguments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Counterarguments</h4>
                <div className="space-y-2">
                  {output.counterarguments.map((ca, idx) => (
                    <div key={idx} className="p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">
                        Re: {ca.target_claim}
                      </p>
                      <p className="text-sm">{ca.rebuttal}</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {Math.round(ca.confidence * 100)}% confident
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concessions */}
            {output.concessions && output.concessions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Concessions</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {output.concessions.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Position Changes */}
            {output.position_changes && output.position_changes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Position Changes</h4>
                <div className="space-y-2">
                  {output.position_changes.map((pc, idx) => (
                    <div key={idx} className="p-2 border rounded-md text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground line-through">
                          {pc.from}
                        </span>
                        <span>→</span>
                        <span className="font-medium">{pc.to}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trigger: {pc.trigger} (Round {pc.round})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning Summary */}
            <div>
              <h4 className="text-sm font-semibold mb-1">Reasoning Summary</h4>
              <p className="text-sm text-muted-foreground">
                {output.reasoning_summary}
              </p>
            </div>
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
