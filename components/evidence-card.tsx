'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClaimSource } from '@/lib/schemas';
import {
  Globe,
  FileText,
  Calculator,
  Brain,
  Link,
  Lightbulb,
  UserCheck,
} from 'lucide-react';

interface EvidenceCardProps {
  source: ClaimSource;
}

const sourceIcons: Record<string, React.ReactNode> = {
  web_search: <Globe className="h-4 w-4" />,
  web_fetch: <Link className="h-4 w-4" />,
  python_calculation: <Calculator className="h-4 w-4" />,
  file_evidence: <FileText className="h-4 w-4" />,
  logical_deduction: <Brain className="h-4 w-4" />,
  prior_knowledge: <Lightbulb className="h-4 w-4" />,
  opponent_concession: <UserCheck className="h-4 w-4" />,
};

const sourceLabels: Record<string, string> = {
  web_search: 'Web Search',
  web_fetch: 'Web Content',
  python_calculation: 'Calculation',
  file_evidence: 'File Evidence',
  logical_deduction: 'Logic',
  prior_knowledge: 'Prior Knowledge',
  opponent_concession: 'Opponent Concession',
};

export function EvidenceCard({ source }: EvidenceCardProps) {
  return (
    <Card className="evidence-card bg-muted/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-muted-foreground">
            {sourceIcons[source.type] || <FileText className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="text-xs mb-1">
              {sourceLabels[source.type] || source.type}
            </Badge>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {source.content}
            </p>
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline truncate block mt-1"
              >
                {source.url}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
