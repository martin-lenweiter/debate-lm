'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ModelType } from '@/lib/schemas';

interface ModelSelectorProps {
  label: string;
  value: ModelType;
  onChange: (value: ModelType) => void;
  disabled?: boolean;
}

export function ModelSelector({
  label,
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ModelType)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="haiku">
            <div className="flex flex-col items-start">
              <span className="font-medium">Haiku 4.5</span>
              <span className="text-xs text-muted-foreground">
                Fastest, most affordable
              </span>
            </div>
          </SelectItem>
          <SelectItem value="sonnet">
            <div className="flex flex-col items-start">
              <span className="font-medium">Sonnet 4.5</span>
              <span className="text-xs text-muted-foreground">
                Balanced speed & capability
              </span>
            </div>
          </SelectItem>
          <SelectItem value="opus">
            <div className="flex flex-col items-start">
              <span className="font-medium">Opus 4.5</span>
              <span className="text-xs text-muted-foreground">
                Most capable
              </span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
