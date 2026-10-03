import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Clock, 
  Flag, 
  Languages, 
  ArrowLeft, 
  ArrowRight,
  Send, 
  AlertTriangle,
  Sun,
  Moon
} from 'lucide-react';
import type { Question, ActiveSession, ExamResultSummary } from '@/types/quiz';
import { prepareQuestionForSession, calculateExamResult, type ShuffledQuestion } from '@/services/session-engine';
import { dbService } from '@/services/db';
import { syncCloudImmediate } from '@/services/firebaseService';
import { useTheme } from '@/lib/theme';

interface ExamArenaProps {
  session: ActiveSession;
  questions: Question[];
  onFinishExam: (result: ExamResultSummary) => void;
  onExit: () => void;
  onUpdateSession: (session: ActiveSession) => void;
}

export const ExamArena = ({
  session,
  questions,
  onFinishExam,
  onExit,
  onUpdateSession,
}: ExamArenaProps) => {
  const [currentIndex, setCurrentIndex] = useState(session.current_index || 0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number[]>>(session.user_answers || {});
  const [flaggedIds, setFlaggedIds] = useState<string[]>(session.flagged_ids || []);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(
    session.time_remaining_sec > 0 ? session.time_remaining_sec : session.time_limit_sec || 3600
  );
  const [showVi, setShowVi] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitWarningModal, setShowExitWarningModal] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  // Memoize shuffled questions so options stay identical during navigation
  const preparedQuestions = useMemo<ShuffledQuestion[]>(() => {
    return questions.map((q) => prepareQuestionForSession(q, false));
  }, [questions]);

  const currentQ = preparedQuestions[currentIndex];
  const selectedOptions = currentQ ? userAnswers[currentQ.id] || [] : [];
  const isFlagged = currentQ ? flaggedIds.includes(currentQ.id) : false;

  // Submit and compute results
  const handleForceSubmit = useCallback(() => {
    const finalSession: ActiveSession = {
      ...session,
      current_index: currentIndex,
      time_remaining_sec: timeLeftSec,
      user_answers: userAnswers,
      flagged_ids: flaggedIds,
      is_completed: true,
      updated_at: Date.now(),
    };
    const result = calculateExamResult(finalSession, preparedQuestions);
    finalSession.score = result.score_percent;
    dbService.saveSession(finalSession);
    onFinishExam(result);
  }, [session, currentIndex, timeLeftSec, userAnswers, flaggedIds, preparedQuestions, onFinishExam]);

  // Keep a ref to the latest handleForceSubmit for the timer
  const submitRef = useRef(handleForceSubmit);
  useEffect(() => {
    submitRef.current = handleForceSubmit;
  }, [handleForceSubmit]);

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sync state to DB debounced
  useEffect(() => {
    const updated: ActiveSession = {
      ...session,
      current_index: currentIndex,
      time_remaining_sec: timeLeftSec,
      user_answers: userAnswers,
      flagged_ids: flaggedIds,
      updated_at: Date.now(),
    };
    onUpdateSession(updated);
    dbService.saveSession(updated);
  }, [currentIndex, userAnswers, flaggedIds, timeLeftSec, session, onUpdateSession]);

  // Handle option selection
  const handleSelectOption = useCallback((optionIdx: number) => {
    if (!currentQ) return;

    if (currentQ.type === 'single') {
      setUserAnswers((prev) => ({
        ...prev,
        [currentQ.id]: [optionIdx],
      }));
    } else {
      setUserAnswers((prev) => {
        const current = prev[currentQ.id] || [];
        const next = current.includes(optionIdx)
          ? current.filter((i) => i !== optionIdx)
          : [...current, optionIdx];
        return {
          ...prev,
          [currentQ.id]: next,
        };
      });
    }
  }, [currentQ]);

  // Toggle flag [F]
  const handleToggleFlag = useCallback(() => {
    if (!currentQ) return;
    setFlaggedIds((prev) =>
      prev.includes(currentQ.id)
        ? prev.filter((id) => id !== currentQ.id)
        : [...prev, currentQ.id]
    );
  }, [currentQ]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key, 10) - 1;
        if (currentQ && idx < currentQ.options.length) {
          handleSelectOption(idx);
        }
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
        const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 };
        const idx = letterMap[e.key];
        if (currentQ && idx !== undefined && idx < currentQ.options.length) {
          handleSelectOption(idx);
        }
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFlag();
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowVi((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowExitWarningModal(true);
      } else if (e.key === 'ArrowRight' && currentIndex < preparedQuestions.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQ, currentIndex, preparedQuestions.length, handleSelectOption, handleToggleFlag]);

  if (!currentQ) {
    return <div className="p-8 text-center text-muted-foreground">No questions found in this deck.</div>;
  }

  // Format timer MM:SS
  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = timeLeftSec < 300; // less than 5 min

  const answeredCount = Object.keys(userAnswers).filter((k) => (userAnswers[k] || []).length > 0).length;
  const totalCount = preparedQuestions.length;
  const unansweredCount = totalCount - answeredCount;
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header & Exam Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExitWarningModal(true)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="size-3.5" />
            Tạm dừng & Thoát (Esc)
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span>{session.deck_title}</span>
              <Badge variant="destructive" className="text-[10px] font-mono uppercase">
                Exam Mode
              </Badge>
            </div>
          </div>
        </div>

        {/* Center: Timer & Actions */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-semibold transition-colors ${
            isUrgent ? 'border-destructive bg-destructive/10 text-destructive animate-pulse' : 'border-border bg-card text-foreground'
          }`}>
            <Clock className="size-4" />
            <span>{timeFormatted}</span>
          </div>

          <Button
            variant={showVi ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowVi(!showVi)}
            className="text-xs gap-1.5 h-8"
          >
            <Languages className="size-3.5" />
            <span>Tiếng Việt</span>
            <kbd className="text-[9px] font-mono bg-background/20 px-1 rounded">T</kbd>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="text-xs gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
          >
            <Send className="size-3.5" />
            <span>Nộp bài thi</span>
          </Button>

          {/* Theme Switcher inside Exam */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleTheme}
            title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border-border/80"
          >
            {isDark ? (
              <Sun className="size-4 text-amber-400" />
            ) : (
              <Moon className="size-4 text-indigo-400" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Area (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6 space-y-6 border-border shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  Question {currentIndex + 1} of {totalCount}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {currentQ.type === 'multi' ? 'Multi-select' : 'Single-choice'}
                </Badge>
              </div>

              <Button
                variant={isFlagged ? 'warning' : 'outline'}
                size="sm"
                onClick={handleToggleFlag}
                className="text-xs gap-1.5 h-8"
              >
                <Flag className="size-3.5" fill={isFlagged ? 'currentColor' : 'none'} />
                <span>{isFlagged ? 'Flagged for Review' : 'Flag Question'}</span>
                <kbd className="text-[9px] font-mono bg-muted px-1 rounded">F</kbd>
              </Button>
            </div>

            {/* Question Text */}
            <div className="space-y-3">
              <h2 className="text-lg md:text-xl font-semibold leading-relaxed text-foreground">
                {currentQ.question}
              </h2>

              {showVi && currentQ.vi?.question && (
                <div className="p-3.5 rounded-lg bg-muted/50 border border-border/80 text-sm text-foreground/90 font-medium">
                  <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground block mb-1">
                    Bản dịch tiếng Việt:
                  </span>
                  {currentQ.vi.question}
                </div>
              )}
            </div>

            {/* Option Choices */}
            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedOptions.includes(idx);
                const letter = optionLetters[idx] || `${idx + 1}`;
                const viOption = currentQ.vi?.options ? currentQ.vi.options[idx] : null;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40'
                        : 'border-border/80 hover:border-foreground/30 hover:bg-muted/40'
                    }`}
                  >
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-mono font-semibold ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {letter}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium leading-normal">{opt}</div>
                      {showVi && viOption && (
                        <div className="text-xs text-muted-foreground font-normal">
                          {viOption}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="gap-1 text-xs"
              >
                <ArrowLeft className="size-3.5" />
                Previous
              </Button>

              <div className="text-xs text-muted-foreground font-mono">
                {answeredCount} / {totalCount} answered
              </div>

              {currentIndex < totalCount - 1 ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setCurrentIndex((i) => Math.min(totalCount - 1, i + 1))}
                  className="gap-1 text-xs cursor-pointer"
                >
                  Next
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowSubmitModal(true)}
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-md active:scale-95"
                >
                  <Send className="size-3.5" />
                  <span>Nộp bài thi</span>
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar: Question Matrix Grid (1 Col) */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4 border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Question Matrix</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click any number to jump directly.
              </p>
            </div>

            {/* Matrix Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-primary" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs border border-border bg-card" />
                <span>Unanswered ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-amber-500" />
                <span>Flagged ({flaggedIds.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs ring-2 ring-primary ring-offset-1" />
                <span>Current</span>
              </div>
            </div>

            {/* Grid of Boxes */}
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 pt-2 max-h-[380px] overflow-y-auto pr-1">
              {preparedQuestions.map((q, idx) => {
                const hasAnswer = (userAnswers[q.id] || []).length > 0;
                const flagged = flaggedIds.includes(q.id);
                const isCurrent = idx === currentIndex;

                let boxClass = 'border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/60';
                if (hasAnswer) {
                  boxClass = 'bg-primary text-primary-foreground font-semibold border-primary';
                }
                if (flagged) {
                  boxClass += ' ring-2 ring-amber-500 ring-offset-1';
                }
                if (isCurrent) {
                  boxClass += ' border-foreground font-bold underline';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-8 rounded-md border text-xs font-mono flex items-center justify-center transition-all cursor-pointer ${boxClass}`}
                    title={`Question ${idx + 1}${flagged ? ' (Flagged)' : ''}${hasAnswer ? ' (Answered)' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Quick Submit Button below Question Matrix */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowSubmitModal(true)}
                className="w-full gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-sm active:scale-95"
              >
                <Send className="size-3.5" />
                <span>Nộp bài thi ({answeredCount}/{totalCount})</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal Before Submit */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Submit Exam Confirmation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review your exam progress before finalizing your submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/40 border border-border text-center">
              <div>
                <span className="text-muted-foreground block text-[10px]">Answered</span>
                <span className="text-base font-bold text-foreground font-mono">{answeredCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Unanswered</span>
                <span className="text-base font-bold text-destructive font-mono">{unansweredCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Flagged</span>
                <span className="text-base font-bold text-amber-500 font-mono">{flaggedIds.length}</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-destructive font-medium">
                Warning: You still have {unansweredCount} unanswered questions! Unanswered questions will be scored as incorrect.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitModal(false)}>
              Keep Reviewing
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowSubmitModal(false);
                handleForceSubmit();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Submit & View Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Urgent Exam Exit Warning Dialog */}
      <Dialog open={showExitWarningModal} onOpenChange={setShowExitWarningModal}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-card border-destructive/50 shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="size-4 animate-bounce" />
              Cảnh báo quan trọng: Phòng thi đang diễn ra
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Bạn có chắc chắn muốn rời khỏi bài thi?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <span className="block">
                Đồng hồ bấm giờ còn lại: <strong className="text-destructive font-mono">{timeFormatted}</strong>.
              </span>
              <span className="block">
                Bạn đã trả lời <strong className="text-foreground">{answeredCount}</strong> / {totalCount} câu hỏi ({unansweredCount} câu chưa làm).
              </span>
              <span className="block text-[11px] text-muted-foreground/90 bg-muted/40 p-2.5 rounded-xl border border-border/60">
                Nếu tạm dừng, tiến trình làm bài sẽ được lưu lại để bạn tiếp tục sau. Bạn cũng có thể nộp bài và chấm điểm ngay lập tức.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2.5 pt-3 border-t border-border/40 mt-3">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowExitWarningModal(false)}
              className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs cursor-pointer active:scale-95 shadow-xs"
            >
              Ở lại tiếp tục làm bài
            </Button>

            <div className="grid grid-cols-2 gap-2.5 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowExitWarningModal(false);
                  handleForceSubmit();
                }}
                className="h-10 rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 font-bold text-xs cursor-pointer active:scale-95"
              >
                Nộp bài & Chấm điểm
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const updated: ActiveSession = {
                    ...session,
                    current_index: currentIndex,
                    time_remaining_sec: timeLeftSec,
                    user_answers: userAnswers,
                    flagged_ids: flaggedIds,
                    updated_at: Date.now(),
                  };
                  onUpdateSession(updated);
                  await dbService.saveSession(updated);
                  dbService.persistImmediate();
                  await syncCloudImmediate();
                  setShowExitWarningModal(false);
                  onExit();
                }}
                className="h-10 rounded-xl font-bold text-xs cursor-pointer active:scale-95 shadow-xs"
              >
                Tạm dừng & Thoát
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
