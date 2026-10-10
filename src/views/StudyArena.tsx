import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sun,
  Moon,
  Trophy,
  RotateCcw,
  RotateCw,
  Zap
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Question, ActiveSession, QuestionStats } from '@/types/quiz';
import { prepareQuestionForSession, isAnswerCorrect, type ShuffledQuestion } from '@/services/session-engine';
import { dbService } from '@/services/db';
import { triggerAutoCloudSync, syncCloudImmediate } from '@/services/firebaseService';
import { useTheme } from '@/lib/theme';
import { motion } from 'motion/react';
import { ClickSpark, Confetti } from '@/components/motion';

interface StudyArenaProps {
  session: ActiveSession;
  questions: Question[];
  onExit: () => void;
  onUpdateSession: (session: ActiveSession) => void;
  onPracticeWrongQuestions?: (wrongQuestions: Question[], deckId: string, deckTitle: string) => void;
}

export const StudyArena: React.FC<StudyArenaProps> = ({
  session,
  questions,
  onExit,
  onUpdateSession,
  onPracticeWrongQuestions,
}) => {
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
  const [isCompleted, setIsCompleted] = useState(session.is_completed || false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const { isDark, toggleTheme } = useTheme();

  // Reset state whenever active session ID changes
  useEffect(() => {
    setCurrentIndex(session.current_index || 0);
    setUserAnswers(session.user_answers || {});
    const initial: Record<string, boolean> = {};
    for (const [id, answers] of Object.entries(session.user_answers || {})) {
      if (answers.length > 0) initial[id] = true;
    }
    setSubmittedQuestions(initial);
    setIsCompleted(session.is_completed || false);
    setShowExplanationOverride(false);
  }, [session.id]);

  // Memoize questions for the session with stable option positions across reloads
  const preparedQuestions = useMemo<ShuffledQuestion[]>(() => {
    return questions.map((q) => prepareQuestionForSession(q, false));
  }, [questions]);

  const currentQ = preparedQuestions[currentIndex];
  const qId = currentQ?.id;
  const selectedOptions = useMemo(() => (qId ? userAnswers[qId] || [] : []), [userAnswers, qId]);
  const isAnswerSubmitted = Boolean(qId && submittedQuestions[qId]);
  const effectiveStats = qId ? localStats[qId] || currentQ?.stats : undefined;
  const isBookmarked = Boolean(effectiveStats?.is_bookmarked);

  // Handle option selection (Single choice submits & scores immediately!)
  const handleSelectOption = useCallback(async (optionIdx: number) => {
    if (!currentQ || !qId || isAnswerSubmitted) return;

    if (currentQ.type === 'single') {
      const newAnswers = {
        ...userAnswers,
        [qId]: [optionIdx],
      };
      setUserAnswers(newAnswers);
      setSubmittedQuestions((prev) => ({ ...prev, [qId]: true }));
      setShowExplanationOverride(true);

      const correct = isAnswerCorrect([optionIdx], currentQ.answer);
      if (correct) {
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }
      try {
        const updatedStats = await dbService.updateQuestionStats(qId, correct);
        setLocalStats((prev) => ({ ...prev, [qId]: updatedStats }));
      } catch (err) {
        console.error('Failed to update Leitner stats:', err);
      }

      // Save session immediately
      const updated: ActiveSession = {
        ...session,
        current_index: currentIndex,
        user_answers: newAnswers,
        updated_at: Date.now(),
      };
      onUpdateSession(updated);
      await dbService.saveSession(updated);
      dbService.persistImmediate();
      triggerAutoCloudSync();
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
  }, [currentQ, qId, isAnswerSubmitted, userAnswers, session, currentIndex, onUpdateSession]);

  // Submit Answer for multi-select
  const handleSubmitMultiAnswer = useCallback(async () => {
    if (!currentQ || !qId || selectedOptions.length === 0) return;

    setSubmittedQuestions((prev) => ({ ...prev, [qId]: true }));
    setShowExplanationOverride(true);

    const correct = isAnswerCorrect(selectedOptions, currentQ.answer);
    if (correct) {
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }
    try {
      const updatedStats = await dbService.updateQuestionStats(qId, correct);
      setLocalStats((prev) => ({ ...prev, [qId]: updatedStats }));
    } catch (err) {
      console.error('Failed to update Leitner stats:', err);
    }

    const updated: ActiveSession = {
      ...session,
      current_index: currentIndex,
      user_answers: userAnswers,
      updated_at: Date.now(),
    };
    onUpdateSession(updated);
    await dbService.saveSession(updated);
    dbService.persistImmediate();
    triggerAutoCloudSync();
  }, [currentQ, qId, selectedOptions, currentIndex, session, userAnswers, onUpdateSession]);

  // Statistics calculation for study progress & completion
  const studyStats = useMemo(() => {
    let correctCount = 0;
    let incorrectCount = 0;
    const incorrectQuestions: ShuffledQuestion[] = [];

    for (const q of preparedQuestions) {
      const ans = userAnswers[q.id];
      if (ans && ans.length > 0) {
        if (isAnswerCorrect(ans, q.answer)) {
          correctCount++;
        } else {
          incorrectCount++;
          incorrectQuestions.push(q);
        }
      }
    }

    const answeredCount = Object.keys(userAnswers).filter(
      (id) => userAnswers[id] && userAnswers[id].length > 0
    ).length;
    const totalCount = preparedQuestions.length;
    const accuracyPercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

    return {
      answeredCount,
      totalCount,
      correctCount,
      incorrectCount,
      accuracyPercent,
      incorrectQuestions,
    };
  }, [preparedQuestions, userAnswers]);

  // Finish study session & save completion to DB
  const handleFinishStudy = useCallback(async () => {
    const finalSession: ActiveSession = {
      ...session,
      current_index: currentIndex,
      user_answers: userAnswers,
      is_completed: true,
      score: studyStats.accuracyPercent,
      updated_at: Date.now(),
    };
    onUpdateSession(finalSession);
    await dbService.saveSession(finalSession);
    dbService.persistImmediate();
    triggerAutoCloudSync();
    setIsCompleted(true);
  }, [currentIndex, session, userAnswers, studyStats.accuracyPercent, onUpdateSession]);

  // Advance to next question (or finish if on the last question)
  const handleNext = useCallback(async () => {
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
      await dbService.saveSession(updated);
      dbService.persistImmediate();
      triggerAutoCloudSync();
    } else {
      // Reached the end of the deck (question 60/60) -> finish and show completion!
      await handleFinishStudy();
    }
  }, [currentIndex, preparedQuestions.length, session, userAnswers, onUpdateSession, handleFinishStudy]);

  const handleRestartAll = useCallback(async () => {
    setCurrentIndex(0);
    setUserAnswers({});
    setSubmittedQuestions({});
    setShowExplanationOverride(false);
    setIsCompleted(false);

    const restarted: ActiveSession = {
      ...session,
      current_index: 0,
      user_answers: {},
      is_completed: false,
      score: undefined,
      updated_at: Date.now(),
    };
    onUpdateSession(restarted);
    await dbService.saveSession(restarted);
    dbService.persistImmediate();
    triggerAutoCloudSync();
  }, [session, onUpdateSession]);

  const handleReviewMistakesOnly = useCallback(async () => {
    if (studyStats.incorrectQuestions.length === 0) return;
    const firstMistakeQ = studyStats.incorrectQuestions[0];
    const targetIdx = preparedQuestions.findIndex((q) => q.id === firstMistakeQ.id);
    const newAnswers = { ...userAnswers };
    const newSubmitted = { ...submittedQuestions };
    for (const q of studyStats.incorrectQuestions) {
      delete newAnswers[q.id];
      delete newSubmitted[q.id];
    }
    setUserAnswers(newAnswers);
    setSubmittedQuestions(newSubmitted);
    setCurrentIndex(targetIdx >= 0 ? targetIdx : 0);
    setShowExplanationOverride(false);
    setIsCompleted(false);

    const updated: ActiveSession = {
      ...session,
      current_index: targetIdx >= 0 ? targetIdx : 0,
      user_answers: newAnswers,
      is_completed: false,
      updated_at: Date.now(),
    };
    onUpdateSession(updated);
    await dbService.saveSession(updated);
    dbService.persistImmediate();
    triggerAutoCloudSync();
  }, [studyStats.incorrectQuestions, preparedQuestions, userAnswers, submittedQuestions, session, onUpdateSession]);

  // Go to previous question
  const handlePrev = useCallback(async () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setShowExplanationOverride(false);

      const updated: ActiveSession = {
        ...session,
        current_index: prevIdx,
        user_answers: userAnswers,
        updated_at: Date.now(),
      };
      onUpdateSession(updated);
      await dbService.saveSession(updated);
      dbService.persistImmediate();
    }
  }, [currentIndex, session, userAnswers, onUpdateSession]);

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

  // Handle request to exit
  const handleRequestExit = useCallback(() => {
    if (currentIndex > 0 || Object.keys(userAnswers).length > 0) {
      setExitConfirmOpen(true);
    } else {
      onExit();
    }
  }, [currentIndex, userAnswers, onExit]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (currentQ && idx < currentQ.options.length) {
          handleSelectOption(idx);
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (isAnswerSubmitted) {
          handleNext();
        } else if (currentQ?.type === 'multi' && selectedOptions.length > 0) {
          handleSubmitMultiAnswer();
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
        handleRequestExit();
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
    handleSubmitMultiAnswer,
    handleNext,
    handlePrev,
    handleToggleBookmark,
    handleRequestExit,
    exitConfirmOpen,
  ]);

  if (isCompleted) {
    const hasMistakes = studyStats.incorrectQuestions.length > 0;
    return (
      <ClickSpark sparkColor="rgba(245, 158, 11, 0.85)" sparkCount={8} sparkSize={9} className="w-full">
        {studyStats.accuracyPercent >= 70 && <Confetti durationMs={3200} />}
        <div className="max-w-2xl mx-auto px-6 py-12 animate-in fade-in-50 duration-300">
          <Card className="p-8 sm:p-10 text-center space-y-6 border-border bg-card shadow-xl rounded-3xl">
            <div className="size-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-primary/20 to-emerald-500/20 flex items-center justify-center mx-auto text-amber-500 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Trophy className="size-10 text-amber-500" />
            </div>

            <div className="space-y-2">
              <Badge variant="outline" className="text-xs font-mono uppercase tracking-wider font-bold text-primary border-primary/30 bg-primary/5">
                Hoàn thành bài học
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                Tổng Kết Phiên Học Tập
              </h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Bạn đã hoàn thành bộ đề <strong>{session.deck_title}</strong>. Tiến độ học và thứ hạng hộp Leitner đã được tự động lưu trữ và đồng bộ an toàn.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/80">
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-foreground font-mono">
                  {studyStats.accuracyPercent}%
                </div>
                <div className="text-[11px] text-muted-foreground">Độ chính xác</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-emerald-500 font-mono flex items-center justify-center gap-1">
                  <CheckCircle2 className="size-4.5" /> {studyStats.correctCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Trả lời đúng</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-destructive font-mono flex items-center justify-center gap-1">
                  <XCircle className="size-4.5" /> {studyStats.incorrectCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Cần xem lại</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {hasMistakes && (
                <Button
                  variant="default"
                  onClick={() => {
                    if (onPracticeWrongQuestions) {
                      onPracticeWrongQuestions(studyStats.incorrectQuestions, session.deck_id, session.deck_title);
                    } else {
                      handleReviewMistakesOnly();
                    }
                  }}
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-2"
                >
                  <RotateCcw className="size-4" />
                  Ôn ngay {studyStats.incorrectCount} câu sai
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleRestartAll}
                className="flex-1 h-11 rounded-xl border-border/80 text-foreground font-semibold cursor-pointer active:scale-95"
              >
                <RotateCw className="size-4 mr-2" />
                Luyện lại toàn bộ ({studyStats.totalCount} câu)
              </Button>

              <Button
                variant="secondary"
                onClick={onExit}
                className="flex-1 h-11 rounded-xl font-bold cursor-pointer active:scale-95"
              >
                <ArrowLeft className="size-4 mr-2" />
                Về Trang chủ
              </Button>
            </div>
          </Card>
        </div>
      </ClickSpark>
    );
  }

  if (!currentQ) {
    return <div className="p-8 text-center text-muted-foreground">No questions found in this deck.</div>;
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const progressPercent = Math.round(((currentIndex + 1) / preparedQuestions.length) * 100);
  const isCorrect = isAnswerSubmitted ? isAnswerCorrect(selectedOptions, currentQ.answer) : false;

  return (
    <ClickSpark sparkColor="rgba(245, 158, 11, 0.85)" sparkCount={8} sparkSize={9} className="w-full">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6 animate-in fade-in-50 duration-200">
        {/* Top Header & Navigation */}
        <div className="flex items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleRequestExit} className="gap-1.5 text-xs font-semibold cursor-pointer active:scale-95">
              <ArrowLeft className="size-3.5" />
              Thoát (Esc)
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{session.deck_title}</span>
              <Badge variant="success" className="text-[10px] font-mono uppercase">
                Chế độ Học tập
              </Badge>
              {streak >= 3 && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold animate-pulse shadow-xs">
                  <Zap className="size-3.5 fill-current" />
                  <span>Chuỗi {streak} đúng! 🔥</span>
                </div>
              )}
            </div>
          </div>

        <div className="flex items-center gap-2">
          {/* Finish / Nộp bài sớm */}
          {Object.keys(userAnswers).length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleFinishStudy}
              className="text-xs gap-1.5 h-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95"
              title="Hoàn thành bài học và xem bảng tổng kết kết quả"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Nộp bài học</span>
            </Button>
          )}

          {/* Translation Toggle */}
          <Button
            variant={showVi ? 'study' : 'outline'}
            size="sm"
            onClick={() => setShowVi(!showVi)}
            className="text-xs gap-1.5 h-8 font-medium"
          >
            <Languages className="size-3.5" />
            <span>Tiếng Việt</span>
            <kbd className="text-[9px] font-mono bg-background/30 px-1 rounded">T</kbd>
          </Button>

          {/* Bookmark Toggle */}
          <Button
            variant={isBookmarked ? 'accent' : 'outline'}
            size="icon-sm"
            onClick={handleToggleBookmark}
            title={isBookmarked ? 'Đã bookmark (Nhấn B để bỏ)' : 'Bookmark câu này (Nhấn B)'}
            className={isBookmarked ? 'text-white' : 'text-muted-foreground'}
          >
            <Bookmark className="size-4" fill={isBookmarked ? 'currentColor' : 'none'} />
          </Button>

          {/* Theme Toggle */}
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

      {/* Progress Bar & Question Counter */}
      <div className="space-y-1.5 bg-card/60 p-3 rounded-xl border border-border/80">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="font-semibold text-foreground">
            Câu hỏi {currentIndex + 1} / {preparedQuestions.length}
          </span>
          <span>{progressPercent}% Hoàn thành</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Question Card */}
      <motion.div
        key={currentQ.id}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <Card className={`p-6 md:p-8 space-y-6 bg-card transition-all duration-300 ${streak >= 3 ? 'border-amber-500/50 shadow-lg shadow-amber-500/15 ring-1 ring-amber-500/30' : 'border-border shadow-sm'}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="font-mono text-xs font-semibold bg-muted/60">
              {currentQ.type === 'multi' ? 'Chọn nhiều đáp án' : 'Chọn 1 đáp án (Chấm tức thì)'}
            </Badge>

            {effectiveStats && (
              <Badge 
                variant={effectiveStats.leitner_box === 5 ? 'success' : effectiveStats.leitner_box > 1 ? 'warning' : 'outline'}
                className="text-xs font-mono font-semibold"
              >
                Hộp Leitner {effectiveStats.leitner_box} / 5
              </Badge>
            )}
          </div>

          {/* English Question */}
          <h2 className="text-lg md:text-xl font-semibold leading-relaxed text-foreground">
            {currentQ.question}
          </h2>

          {/* Vietnamese Translation (when toggled) */}
          {showVi && currentQ.vi?.question && (
            <div className="p-4 rounded-xl bg-muted/70 border border-border text-sm text-foreground/90 font-medium animate-in fade-in-50 leading-relaxed">
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block mb-1">
                Bản dịch tiếng Việt:
              </span>
              {currentQ.vi.question}
            </div>
          )}
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOptions.includes(idx);
            const isCorrectOption = currentQ.answer.includes(idx);
            const letter = optionLetters[idx] || `${idx + 1}`;
            const viOption = currentQ.vi?.options ? currentQ.vi.options[idx] : null;

            let optionStyle = 'border-border/80 bg-background/50 hover:border-primary/60 hover:bg-muted/50 cursor-pointer';
            let badgeStyle = 'bg-muted text-foreground border-border/80 font-bold';
            let statusIcon = null;

            if (isAnswerSubmitted) {
              if (isCorrectOption) {
                optionStyle = 'border-emerald-500 bg-emerald-500/15 text-foreground ring-1 ring-emerald-500/40 cursor-default';
                badgeStyle = 'bg-emerald-600 text-white border-emerald-600';
                statusIcon = <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />;
              } else if (isSelected && !isCorrectOption) {
                optionStyle = 'border-destructive bg-destructive/15 text-foreground ring-1 ring-destructive/40 cursor-default';
                badgeStyle = 'bg-destructive text-white border-destructive';
                statusIcon = <X className="size-4 text-destructive shrink-0 mt-0.5" />;
              } else {
                optionStyle = 'border-border/40 opacity-50 cursor-default';
              }
            } else if (isSelected) {
              optionStyle = 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40';
              badgeStyle = 'bg-primary text-primary-foreground border-primary';
            }

            const isIncorrectSelection = isAnswerSubmitted && isSelected && !isCorrectOption;
            const isCorrectSelection = isAnswerSubmitted && isCorrectOption;

            return (
              <motion.div
                key={idx}
                whileTap={!isAnswerSubmitted ? { scale: 0.985 } : undefined}
                animate={
                  isIncorrectSelection 
                    ? { x: [-3, 3, -2, 2, 0] } 
                    : isCorrectSelection 
                    ? { scale: [1, 1.015, 1] } 
                    : {}
                }
                transition={{ duration: 0.2 }}
                onClick={() => handleSelectOption(idx)}
                className={`flex items-start gap-3.5 p-4 rounded-xl border transition-colors select-none shadow-2xs ${optionStyle}`}
              >
                <div className={`flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-mono ${badgeStyle}`}>
                  {letter}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="text-sm font-medium leading-normal">{opt}</div>
                  {showVi && viOption && (
                    <div className="text-xs text-muted-foreground font-normal leading-relaxed">
                      {viOption}
                    </div>
                  )}
                </div>

                {statusIcon}
              </motion.div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div className="flex items-center gap-2">
            {currentIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1 text-xs font-medium">
                <ArrowLeft className="size-3.5" />
                Câu trước
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-select submit button */}
            {currentQ.type === 'multi' && !isAnswerSubmitted && (
              <Button
                variant="study"
                size="sm"
                onClick={handleSubmitMultiAnswer}
                disabled={selectedOptions.length === 0}
                className="gap-1.5 px-5 font-semibold text-xs"
              >
                <span>Kiểm tra đáp án</span>
                <kbd className="font-mono text-[10px] bg-white/20 px-1 py-0.5 rounded">
                  Space
                </kbd>
              </Button>
            )}

            {/* Next or Finish button */}
            {isAnswerSubmitted ? (
              <Button
                variant={currentIndex < preparedQuestions.length - 1 ? 'study' : 'default'}
                size="sm"
                onClick={handleNext}
                className={`gap-2 px-6 font-semibold text-xs cursor-pointer active:scale-95 shadow-xs ${
                  currentIndex >= preparedQuestions.length - 1
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : ''
                }`}
              >
                <span>{currentIndex < preparedQuestions.length - 1 ? 'Sang câu tiếp theo' : 'Hoàn thành bài học'}</span>
                {currentIndex < preparedQuestions.length - 1 ? (
                  <ArrowRight className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-white" />
                )}
                <kbd className="font-mono text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                  Space
                </kbd>
              </Button>
            ) : currentIndex === preparedQuestions.length - 1 ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleFinishStudy}
                className="gap-2 px-6 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-xs"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Nộp bài & Hoàn thành</span>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Explanation Breakdown (visible after answer submitted) */}
        {(isAnswerSubmitted || showExplanationOverride) && (
          <div className="pt-5 border-t border-border space-y-3 animate-in fade-in-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                {isCorrect ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>{isCorrect ? 'Chính xác!' : 'Chưa chính xác'} — Giải thích & Kiến thức:</span>
              </div>
              {currentQ.answer_source && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono bg-muted/50">
                  Nguồn: {currentQ.answer_source}
                </Badge>
              )}
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/80 text-sm leading-relaxed text-foreground/90 space-y-2">
              <p>{currentQ.explanation || 'Không có giải thích chi tiết cho câu hỏi này.'}</p>
              {currentQ.note && (
                <div className="pt-2 text-xs text-muted-foreground border-t border-border/50">
                  <span className="font-semibold text-foreground">Ghi chú:</span> {currentQ.note}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
      </motion.div>

      {/* Keyboard Shortcut Legend Bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 py-2 text-[11px] text-muted-foreground/80 border-t border-border/50">
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">1-4 / Click</kbd> Chọn & Chấm
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">Space</kbd> Câu tiếp
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">T</kbd> Tiếng Việt
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">B</kbd> Bookmark
        </span>
        <span className="flex items-center gap-1">
          <kbd className="font-mono px-1 rounded bg-muted border border-border text-[10px]">Esc</kbd> Thoát
        </span>
      </div>

      {/* Exit Confirmation Dialog */}
      <Dialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-card border-border/80 shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <AlertCircle className="size-4" />
              Tạm dừng phiên học tập
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Bạn có muốn rời khỏi phiên học?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn đang ở câu <strong className="text-foreground">{currentIndex + 1}</strong> / {preparedQuestions.length}. Mọi câu trả lời và cập nhật Hộp Leitner đã được tự động lưu. Bạn có thể tiếp tục học bất kỳ lúc nào từ Trang chủ.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/40 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExitConfirmOpen(false)}
              className="flex-1 h-9.5 rounded-xl border-border/80 text-foreground font-semibold text-xs cursor-pointer active:scale-95"
            >
              Tiếp tục học
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                const updated: ActiveSession = {
                  ...session,
                  current_index: currentIndex,
                  user_answers: userAnswers,
                  updated_at: Date.now(),
                };
                onUpdateSession(updated);
                await dbService.saveSession(updated);
                dbService.persistImmediate();
                await syncCloudImmediate();
                setExitConfirmOpen(false);
                onExit();
              }}
              className="flex-1 h-9.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer active:scale-95 shadow-xs"
            >
              Lưu & Về Trang chủ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </ClickSpark>
  );
};
