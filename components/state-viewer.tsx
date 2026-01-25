'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RoundData } from '@/lib/schemas';

interface StateViewerProps {
  rounds: RoundData[];
  debaterAName: string;
  debaterBName: string;
}

export function StateViewer({
  rounds,
  debaterAName,
  debaterBName,
}: StateViewerProps) {
  if (rounds.length === 0) return null;

  const latestRound = rounds[rounds.length - 1];

  // Get confidence history
  const confidenceHistory = rounds.map((r) => ({
    round: r.round,
    a: r.debaterAOutput.confidence,
    b: r.debaterBOutput.confidence,
  }));

  // Count total concessions
  const totalConcessionsA = rounds.reduce(
    (sum, r) => sum + (r.debaterAOutput.concessions?.length || 0),
    0
  );
  const totalConcessionsB = rounds.reduce(
    (sum, r) => sum + (r.debaterBOutput.concessions?.length || 0),
    0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Debate Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Round Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Round {rounds.length}</span>
            <Badge variant="outline">
              {latestRound.refereeOutput.verdict.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>

        {/* Confidence Chart */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Confidence Over Time</h4>
          <div className="h-24 flex items-end gap-1">
            {confidenceHistory.map((c, idx) => (
              <div
                key={idx}
                className="flex-1 flex gap-0.5"
                title={`Round ${c.round}`}
              >
                <div
                  className="flex-1 bg-debaterA rounded-t"
                  style={{ height: `${c.a * 100}%` }}
                />
                <div
                  className="flex-1 bg-debaterB rounded-t"
                  style={{ height: `${c.b * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-debaterA rounded" />
              {debaterAName}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-debaterB rounded" />
              {debaterBName}
            </span>
          </div>
        </div>

        {/* Concessions Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-2 bg-amber-50 rounded-md">
            <div className="text-2xl font-bold text-amber-600">
              {totalConcessionsA}
            </div>
            <div className="text-xs text-amber-700">{debaterAName} Concessions</div>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-md">
            <div className="text-2xl font-bold text-amber-600">
              {totalConcessionsB}
            </div>
            <div className="text-xs text-amber-700">{debaterBName} Concessions</div>
          </div>
        </div>

        {/* Current Argument Preview */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Latest Arguments</h4>
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="debaterA" className="text-xs">
                  {debaterAName}
                </Badge>
                <span className="text-xs">
                  {Math.round(latestRound.debaterAOutput.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {latestRound.debaterAOutput.argument.slice(0, 150)}...
              </p>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="debaterB" className="text-xs">
                  {debaterBName}
                </Badge>
                <span className="text-xs">
                  {Math.round(latestRound.debaterBOutput.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {latestRound.debaterBOutput.argument.slice(0, 150)}...
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
