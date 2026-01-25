'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface UserInputModalProps {
  open: boolean;
  prompt: string;
  onSubmit: (input: string) => void;
  onCancel: () => void;
}

export function UserInputModal({
  open,
  prompt,
  onSubmit,
  onCancel,
}: UserInputModalProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Needed</DialogTitle>
          <DialogDescription>{prompt}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your response..."
          className="min-h-[100px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel Debate
          </Button>
          <Button onClick={handleSubmit} disabled={!input.trim()}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
