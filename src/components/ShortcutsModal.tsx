import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onOpenChange }) => {
  const shortcuts = [
    { key: '1, 2, 3, 4', desc: 'Select / Toggle option choices (or A, B, C, D)' },
    { key: 'Space / Enter', desc: 'Check answer (Study) or advance to next question' },
    { key: 'T', desc: 'Toggle Vietnamese translation (offline instant)' },
    { key: 'B', desc: 'Toggle bookmark on current question' },
    { key: 'E', desc: 'Toggle explanation & notes breakdown' },
    { key: 'F', desc: 'Flag / Unflag question for review (Exam Mode)' },
    { key: 'Ctrl + K', desc: 'Open Command Palette & fast switcher' },
    { key: 'Ctrl + Shift + F', desc: 'Toggle Zen / Fullscreen focus mode' },
    { key: 'Esc', desc: 'Return to Dashboard or close dialogs' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Keyboard First Controls</DialogTitle>
          <DialogDescription className="text-xs">
            Designed for 100% mouse-free workflow. All shortcuts are disabled when typing in inputs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 pt-2">
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <span className="text-muted-foreground">{item.desc}</span>
              <kbd className="inline-flex items-center font-mono font-medium px-2 py-0.5 rounded bg-muted border border-border text-foreground shadow-2xs">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
