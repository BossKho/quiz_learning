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
  const generalShortcuts = [
    { key: '1, 2, 3, 4', desc: 'Select option choices (or A, B, C, D)' },
    { key: 'Space / Enter', desc: 'Advance to next question / Check answer' },
    { key: 'T', desc: 'Toggle Vietnamese translation (offline instant)' },
    { key: 'B', desc: 'Toggle bookmark on current question' },
    { key: 'E', desc: 'Toggle explanation breakdown' },
    { key: 'F', desc: 'Flag / Unflag question for review (Exam Mode)' },
    { key: 'Ctrl + K', desc: 'Open Command Palette & fast switcher' },
    { key: 'Esc', desc: 'Return to Dashboard or close dialogs' },
  ];

  const flashcardShortcuts = [
    { key: 'Space', desc: 'Lật thẻ 3D xem câu hỏi / đáp án chuẩn' },
    { key: '1 / ←', desc: 'Chưa nhớ (Hạ về Hộp Leitner 1)' },
    { key: '2 / →', desc: 'Đã thuộc (Thăng hạng Hộp Leitner +1)' },
    { key: 'T', desc: 'Bật / Tắt dịch nghĩa tiếng Việt' },
    { key: 'B', desc: 'Đánh dấu sao (Bookmark)' },
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

        <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wide block mb-1.5">
              Chế độ Luyện thẻ Flashcard 3D
            </span>
            <div className="space-y-1.5">
              {flashcardShortcuts.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-amber-500/5 border border-amber-500/15"
                >
                  <span className="text-foreground font-medium">{item.desc}</span>
                  <kbd className="inline-flex items-center font-mono font-bold px-2 py-0.5 rounded bg-background border border-amber-500/30 text-amber-400 shadow-2xs">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Chung & Học tập / Thi thử
            </span>
            <div className="space-y-1.5">
              {generalShortcuts.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground">{item.desc}</span>
                  <kbd className="inline-flex items-center font-mono font-medium px-2 py-0.5 rounded bg-muted border border-border text-foreground shadow-2xs">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
