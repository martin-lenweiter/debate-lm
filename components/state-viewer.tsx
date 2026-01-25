'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

  // Calculate agreement count
  const agreementCount =
    latestRound.refereeOutput.areas_of_agreement.length;
  const disagreementCount =
    latestRound.refereeOutput.areas_of_disagreement.length;

  // Get confidence history
  const confidenceHistory = rounds.map((r) => ({
    round: r.round,
    a: r.debaterAOutput.confidence,
    b: r.debaterBOutput.confidence,
  }));

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

        {/* Agreement/Disagreement Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-2 bg-green-50 rounded-md">
            <div className="text-2xl font-bold text-green-600">
              {agreementCount}
            </div>
            <div className="text-xs text-green-700">Agreements</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-md">
            <div className="text-2xl font-bold text-red-600">
              {disagreementCount}
            </div>
            <div className="text-xs text-red-700">Disagreements</div>
          </div>
        </div>

        {/* Position Tracker */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Current Positions</h4>
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
                {latestRound.debaterAOutput.position}
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
                {latestRound.debaterBOutput.position}
              </p>
            </div>
          </div>
        </div>

        {/* Evidence Quality */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Evidence Quality</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 truncate">{debaterAName}</span>
              <Progress
                value={
                  latestRound.refereeOutput.debater_a_assessment
                    .evidence_quality * 100
                }
                className="flex-1 h-2"
              />
              <span className="text-xs w-8">
                {Math.round(
                  latestRound.refereeOutput.debater_a_assessment
                    .evidence_quality * 100
                )}
                %
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 truncate">{debaterBName}</span>
              <Progress
                value={
                  latestRound.refereeOutput.debater_b_assessment
                    .evidence_quality * 100
                }
                className="flex-1 h-2"
              />
              <span className="text-xs w-8">
                {Math.round(
                  latestRound.refereeOutput.debater_b_assessment
                    .evidence_quality * 100
                )}
                %
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
