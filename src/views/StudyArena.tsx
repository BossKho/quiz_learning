import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Check, 
  X, 
  Bookmark, 
  Languages, 
  ArrowLeft, 
  ArrowRight, 
  Info
} from 'lucide-react';
import type { Question, ActiveSession, QuestionStats } from '@/types/quiz';
import { prepareQuestionForSession, isAnswerCorrect, type ShuffledQuestion } from '@/services/session-engine';
import { dbService } from '@/services/db';

interface StudyArenaProps {
  session: ActiveSession;
  questions: Question[];
  onExit: () => void;
  onUpdateSession: (session: ActiveSession) => void;
}

export const StudyArena = ({
  session,
  questions,
  onExit,
  onUpdateSession,
}: StudyArenaProps) => {
  const [currentIndex, setCurrentIndex] = useState(session.current_index || 0);
  const [showVi, setShowVi] = useState(false);
  const [showExplanationOverride, setShowExplanationOverride] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number[]>>(session.user_answers || {});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const [id, answers] of Object.entries(session.user_answers || {})) {
      if (answers.length > 0) initial[id] = true;
    }
    return initial;
  });
  const [localStats, setLocalStats] = useState<Record<string, QuestionStats>>({});

  // Memoize shuffled questions for the session so options stay stable during review
  const preparedQuestions = useMemo<ShuffledQuestion[]>(() => {
    return questions.map((q) => prepareQuestionForSession(q, true));
  }, [questions]);

  const currentQ = preparedQuestions[currentIndex];
  const qId = currentQ?.id;
  const selectedOptions = useMemo(() => (qId ? userAnswers[qId] || [] : []), [userAnswers, qId]);
  const isAnswerSubmitted = Boolean(qId && submittedQuestions[qId]);
  const effectiveStats = qId ? localStats[qId] || currentQ?.stats : undefined;
  const isBookmarked = Boolean(effectiveStats?.is_bookmarked);

  // Handle option selection
  const handleSelectOption = useCallback((optionIdx: number) => {
    if (!qId || isAnswerSubmitted) return; // Locked once submitted

    if (currentQ.type === 'single') {
      setUserAnswers((prev) => ({
        ...prev,
        [qId]: [optionIdx],
      }));
    } else {
      // Multi-select toggle
      setUserAnswers((prev) => {
        const current = prev[qId] || [];
        const next = current.includes(optionIdx)
          ? current.filter((i) => i !== optionIdx)
          : [...current, optionIdx];
        return {
          ...prev,
          [qId]: next,
        };
      });
    }
  }, [currentQ, qId, isAnswerSubmitted]);

  // Submit Answer & update Leitner Box
  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQ || !qId || selectedOptions.length === 0) return;

    setSubmittedQuestions((prev) => ({ ...prev, [qId]: true }));
    setShowExplanationOverride(true);

    const correct = isAnswerCorrect(selectedOptions, currentQ.answer);
    try {
      const updatedStats = await dbService.updateQuestionStats(qId, correct);
      setLocalStats((prev) => ({ ...prev, [qId]: updatedStats }));
    } catch (err) {
      console.error('Failed to update Leitner stats:', err);
    }

    // Save session
    const updated: ActiveSession = {
      ...session,
      current_index: currentIndex,
      user_answers: userAnswers,
      updated_at: Date.now(),
    };
    onUpdateSession(updated);
    dbService.saveSession(updated);
  }, [currentQ, qId, selectedOptions, currentIndex, session, userAnswers, onUpdateSession]);

  // Advance to next question
  const handleNext = useCallback(() => {
    if (currentIndex < preparedQuestions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setShowExplanationOverride(false);

      const updated: ActiveSession = {
        ...session,
        current_index: nextIdx,
        user_answers: userAnswers,
        updated_at: Date.now(),
      };
      onUpdateSession(updated);
      dbService.saveSession(updated);
    }
  }, [currentIndex, preparedQuestions.length, session, userAnswers, onUpdateSession]);

  // Go to previous question
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setShowExplanationOverride(false);
    }
  }, [currentIndex]);

  // Toggle bookmark
  const handleToggleBookmark = useCallback(async () => {
    if (!qId) return;
    const nextState = await dbService.toggleBookmark(qId);
    setLocalStats((prev) => {
      const existing = prev[qId] || currentQ?.stats;
      return {
        ...prev,
        [qId]: existing
          ? { ...existing, is_bookmarked: nextState }
          : {
              question_id: qId,
              leitner_box: 1,
              next_review_at: 0,
              correct_count: 0,
              incorrect_count: 0,
              streak: 0,
              is_bookmarked: nextState,
              last_reviewed_at: 0,
            },
      };
    });
  }, [qId, currentQ]);

  // Keyboard shortcut listener
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
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isAnswerSubmitted && selectedOptions.length > 0) {
          handleSubmitAnswer();
        } else if (isAnswerSubmitted) {
          handleNext();
        }
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowVi((prev) => !prev);
      } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey) {
        e.preventDefault();
        handleToggleBookmark();
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowExplanationOverride((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key === 'ArrowRight' && isAnswerSubmitted) {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQ,
    selectedOptions,
    isAnswerSubmitted,
    handleSelectOption,
    handleSubmitAnswer,
    handleNext,
    handlePrev,
    handleToggleBookmark,
    onExit,
  ]);

  if (!currentQ) {
    return <div className="p-8 text-center text-muted-foreground">No questions found in this deck.</div>;
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const progressPercent = Math.round(((currentIndex + 1) / preparedQuestions.length) * 100);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header & Progress */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onExit} className="gap-1 text-xs">
            <ArrowLeft className="size-3.5" />
            Exit (Esc)
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span>{session.deck_title}</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Study Mode
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Translation Toggle */}
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

          {/* Bookmark Toggle */}
          <Button
            variant={isBookmarked ? 'secondary' : 'outline'}
            size="icon-sm"
            onClick={handleToggleBookmark}
            title="Bookmark (B)"
            className={isBookmarked ? 'text-sky-500' : 'text-muted-foreground'}
          >
            <Bookmark className="size-4" fill={isBookmarked ? 'currentColor' : 'none'} />
          </Button>
        </div>
      </div>

      {/* Progress Bar & Question Counter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Question {currentIndex + 1} of {preparedQuestions.length}</span>
          <span>{progressPercent}% Complete</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Question Card */}
      <Card className="p-6 space-y-6 border-border shadow-xs">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {currentQ.type === 'multi' ? 'Multiple Choice (Select all)' : 'Single Choice'}
            </Badge>

            {effectiveStats && (
              <Badge variant="outline" className="text-[10px] font-mono">
                Leitner Box {effectiveStats.leitner_box} / 5
              </Badge>
            )}
          </div>

          {/* English Question */}
          <h2 className="text-lg md:text-xl font-semibold leading-relaxed text-foreground">
            {currentQ.question}
          </h2>

          {/* Vietnamese Translation (when toggled) */}
          {showVi && currentQ.vi?.question && (
            <div className="p-3.5 rounded-lg bg-muted/50 border border-border/80 text-sm text-foreground/90 font-medium animate-in fade-in-50">
              <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground block mb-1">
                Bản dịch tiếng Việt:
              </span>
              {currentQ.vi.question}
            </div>
          )}
        </div>

        {/* Options List */}
        <div className="space-y-2.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOptions.includes(idx);
            const isCorrectOption = currentQ.answer.includes(idx);
            const letter = optionLetters[idx] || `${idx + 1}`;
            const viOption = currentQ.vi?.options ? currentQ.vi.options[idx] : null;

            let optionStyle = 'border-border/80 hover:border-foreground/30 hover:bg-muted/40';
            let badgeStyle = 'bg-muted text-muted-foreground border-border';
            let statusIcon = null;

            if (isAnswerSubmitted) {
              if (isCorrectOption) {
                optionStyle = 'border-emerald-500 bg-emerald-500/10 text-foreground';
                badgeStyle = 'bg-emerald-500 text-white border-emerald-600';
                statusIcon = <Check className="size-4 text-emerald-500 shrink-0" />;
              } else if (isSelected && !isCorrectOption) {
                optionStyle = 'border-destructive/80 bg-destructive/10 text-foreground';
                badgeStyle = 'bg-destructive text-white border-destructive';
                statusIcon = <X className="size-4 text-destructive shrink-0" />;
              } else {
                optionStyle = 'border-border/40 opacity-60';
              }
            } else if (isSelected) {
              optionStyle = 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40';
              badgeStyle = 'bg-primary text-primary-foreground border-primary';
            }

            return (
              <div
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${optionStyle}`}
              >
                <div className={`flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-mono font-semibold ${badgeStyle}`}>
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

                {statusIcon}
              </div>
            );
          })}
        </div>

        {/* Action Button: Check Answer or Next */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1 text-xs">
                <ArrowLeft className="size-3.5" />
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isAnswerSubmitted ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleSubmitAnswer}
                disabled={selectedOptions.length === 0}
                className="gap-1.5 px-5"
              >
                <span>Check Answer</span>
                <kbd className="font-mono text-[10px] bg-primary-foreground/20 px-1 py-0.5 rounded">
                  Space
                </kbd>
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleNext}
                className="gap-1.5 px-5"
              >
                <span>Next Question</span>
                <ArrowRight className="size-3.5" />
                <kbd className="font-mono text-[10px] bg-primary-foreground/20 px-1 py-0.5 rounded">
                  Space
                </kbd>
              </Button>
            )}
          </div>
        </div>

        {/* Explanation Breakdown (visible after answer submitted or toggled with E) */}
        {(isAnswerSubmitted || showExplanationOverride) && (
          <div className="pt-4 border-t border-border space-y-3 animate-in fade-in-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Info className="size-3.5 text-primary" />
                <span>Explanation & Context</span>
              </div>
              {currentQ.answer_source && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  Source: {currentQ.answer_source}
                </Badge>
              )}
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm leading-relaxed text-foreground/90 space-y-2">
              <p>{currentQ.explanation || 'No detailed explanation provided for this item.'}</p>
              {currentQ.note && (
                <div className="pt-2 text-xs text-muted-foreground border-t border-border/50">
                  <span className="font-semibold text-foreground">Note:</span> {currentQ.note}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Keyboard Shortcut Legend Bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 py-2 text-[11px] text-muted-foreground/80 border-t border-border/50">
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">1-4</kbd> Choose
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">Space</kbd> Check/Next
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">T</kbd> Tiếng Việt
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">B</kbd> Bookmark
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">Esc</kbd> Exit
        </span>
      </div>
    </div>
  );
};
