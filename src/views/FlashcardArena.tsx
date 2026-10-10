import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  RotateCw, 
  Check, 
  X, 
  Languages, 
  Bookmark, 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  HelpCircle,
  AlertCircle,
  Sun,
  Moon,
  Undo2
} from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import type { Question, QuestionStats, ActiveSession } from '@/types/quiz';
import { dbService } from '@/services/db';
import { useTheme } from '@/lib/theme';
import { toast } from '@/components/ui/toast';
import { useAppMotionPreference } from '@/services/motionSettingsService';
import { Confetti, CountUp, ClickSpark } from '@/components/motion';

interface FlashcardArenaProps {
  deckTitle: string;
  questions: Question[];
  onExit: () => void;
  initialSession?: ActiveSession;
}

export const FlashcardArena: React.FC<FlashcardArenaProps> = ({
  deckTitle,
  questions: initialQuestions,
  onExit,
  initialSession,
}) => {
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(initialSession?.current_index || 0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<Record<string, 'mastered' | 'again'>>(() => {
    // If resuming from session, restore answers if any
    const restored: Record<string, 'mastered' | 'again'> = {};
    if (initialSession?.user_answers) {
      for (const [qId, val] of Object.entries(initialSession.user_answers)) {
        restored[qId] = val[0] === 1 ? 'mastered' : 'again';
      }
    }
    return restored;
  });
  const [localStats, setLocalStats] = useState<Record<string, QuestionStats>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  // Undo History Stack
  interface FlashcardHistoryItem {
    index: number;
    questionId: string;
    rating: 'again' | 'mastered';
    previousStats?: QuestionStats;
  }
  const [historyStack, setHistoryStack] = useState<FlashcardHistoryItem[]>([]);

  // Motion Settings
  const { effectiveMode } = useAppMotionPreference();
  const isReduced = effectiveMode === 'off' || effectiveMode === 'subtle';

  // Drag Motion Values & State
  const isDraggingRef = useRef(false);
  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, [-240, 0, 240], isReduced ? [0, 0, 0] : [-7, 0, 7]);
  const dragBadgeAgainOpacity = useTransform(dragX, [-120, -40, 0], [1, 0.4, 0]);
  const dragBadgeMasteredOpacity = useTransform(dragX, [0, 40, 120], [0, 0.4, 1]);

  // Generate or maintain session id for progress tracking
  const [sessionId] = useState<string>(() => initialSession?.id || `flashcard_${Date.now()}`);

  const currentQ = activeQuestions[currentIndex];
  const qId = currentQ?.id;
  const effectiveStats = qId ? localStats[qId] || currentQ?.stats : undefined;
  const isBookmarked = Boolean(effectiveStats?.is_bookmarked);

  // Reset drag position on card change
  useEffect(() => {
    dragX.set(0);
  }, [currentIndex, dragX]);

  // Counts
  const totalCount = activeQuestions.length;
  const masteredCount = Object.values(reviewHistory).filter((v) => v === 'mastered').length;
  const againCount = Object.values(reviewHistory).filter((v) => v === 'again').length;
  const progressPercent = totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0;

  // Save session progress in background
  const persistSessionProgress = useCallback(async (idx: number, history: Record<string, 'mastered' | 'again'>, completed: boolean) => {
    try {
      const userAnswersFormatted: Record<string, number[]> = {};
      for (const [id, val] of Object.entries(history)) {
        userAnswersFormatted[id] = [val === 'mastered' ? 1 : 0];
      }

      const sessionData: ActiveSession = {
        id: sessionId,
        deck_id: activeQuestions[0]?.deck_id || 'flashcard_deck',
        deck_title: deckTitle,
        mode: 'flashcard',
        current_index: idx,
        total_questions: activeQuestions.length,
        time_limit_sec: 0,
        time_remaining_sec: 0,
        question_ids: activeQuestions.map((q) => q.id),
        user_answers: userAnswersFormatted,
        flagged_ids: [],
        is_completed: completed,
        score: masteredCount,
        created_at: initialSession?.created_at || Date.now(),
        updated_at: Date.now(),
      };
      await dbService.saveSession(sessionData);
    } catch (err) {
      console.error('Failed to save flashcard session:', err);
    }
  }, [sessionId, activeQuestions, deckTitle, masteredCount, initialSession]);

  // Leitner Box labels
  const getBoxBadge = (box?: number) => {
    const b = box || 1;
    switch (b) {
      case 1:
        return <Badge variant="outline" className="text-[10.5px] border-red-500/40 text-red-400 font-bold bg-red-500/5">Hộp 1 · Mới / Hay sai</Badge>;
      case 2:
        return <Badge variant="outline" className="text-[10.5px] border-amber-500/40 text-amber-400 font-bold bg-amber-500/5">Hộp 2 · Đang ôn luyện</Badge>;
      case 3:
        return <Badge variant="outline" className="text-[10.5px] border-blue-500/40 text-blue-400 font-bold bg-blue-500/5">Hộp 3 · Quen thuộc</Badge>;
      case 4:
        return <Badge variant="outline" className="text-[10.5px] border-indigo-500/40 text-indigo-400 font-bold bg-indigo-500/5">Hộp 4 · Thành thạo</Badge>;
      case 5:
        return <Badge variant="outline" className="text-[10.5px] border-emerald-500/40 text-emerald-400 font-bold bg-emerald-500/5">Hộp 5 · Thuần thục</Badge>;
      default:
        return null;
    }
  };

  // Flip toggle
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Rate question: Again (Chưa nhớ) vs Mastered (Đã thuộc)
  const handleRate = useCallback(async (rating: 'again' | 'mastered') => {
    if (!currentQ || !qId) return;

    const isCorrect = rating === 'mastered';
    const newHistory = { ...reviewHistory, [qId]: rating };
    setReviewHistory(newHistory);

    // Save to Undo stack
    setHistoryStack((prev) => [
      ...prev,
      {
        index: currentIndex,
        questionId: qId,
        rating,
        previousStats: effectiveStats,
      },
    ]);

    // Update SQLite in background
    try {
      const updated = await dbService.updateQuestionStats(qId, isCorrect);
      setLocalStats((prev) => ({ ...prev, [qId]: updated }));
    } catch (err) {
      console.error('Failed to update stats in flashcard mode:', err);
    }

    // Advance to next card or complete
    if (currentIndex + 1 < activeQuestions.length) {
      const nextIdx = currentIndex + 1;
      setIsFlipped(false);
      setCurrentIndex(nextIdx);
      persistSessionProgress(nextIdx, newHistory, false);
    } else {
      setIsCompleted(true);
      persistSessionProgress(activeQuestions.length, newHistory, true);
    }
  }, [currentQ, qId, currentIndex, activeQuestions.length, reviewHistory, effectiveStats, persistSessionProgress]);

  // Undo last rating
  const handleUndo = useCallback(async () => {
    if (historyStack.length === 0) return;
    const lastItem = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));

    const updatedHistory = { ...reviewHistory };
    delete updatedHistory[lastItem.questionId];
    setReviewHistory(updatedHistory);

    setCurrentIndex(lastItem.index);
    setIsFlipped(false);
    setIsCompleted(false);

    if (lastItem.previousStats) {
      setLocalStats((prev) => ({
        ...prev,
        [lastItem.questionId]: lastItem.previousStats!,
      }));
    }

    persistSessionProgress(lastItem.index, updatedHistory, false);
    toast.info('Đã hoàn tác đánh giá thẻ vừa rồi');
  }, [historyStack, reviewHistory, persistSessionProgress]);

  // Toggle Bookmark
  const handleToggleBookmark = useCallback(async () => {
    if (!qId) return;
    try {
      const newStatus = await dbService.toggleBookmark(qId);
      setLocalStats((prev) => {
        const existing = prev[qId] || currentQ?.stats || {
          question_id: qId,
          leitner_box: 1,
          next_review_at: 0,
          correct_count: 0,
          incorrect_count: 0,
          streak: 0,
          is_bookmarked: false,
          last_reviewed_at: 0,
        };
        return {
          ...prev,
          [qId]: { ...existing, is_bookmarked: newStatus },
        };
      });
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  }, [qId, currentQ]);

  // Handle Exit Request
  const handleRequestExit = useCallback(() => {
    if (currentIndex > 0 && !isCompleted) {
      setExitConfirmOpen(true);
    } else {
      onExit();
    }
  }, [currentIndex, isCompleted, onExit]);

  // Confirm Exit
  const handleConfirmExit = async () => {
    await persistSessionProgress(currentIndex, reviewHistory, false);
    setExitConfirmOpen(false);
    onExit();
  };

  // Restart only missed questions
  const handleReviewMistakesOnly = () => {
    const missedQuestions = activeQuestions.filter((q) => reviewHistory[q.id] === 'again');
    if (missedQuestions.length === 0) return;
    setActiveQuestions(missedQuestions);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewHistory({});
    setIsCompleted(false);
  };

  // Restart all questions in this session
  const handleRestartAll = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewHistory({});
    setIsCompleted(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (exitConfirmOpen) {
        if (e.key === 'Escape') setExitConfirmOpen(false);
        return;
      }

      // Undo shortcut (Ctrl+Z, Cmd+Z or U)
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowLeft' || e.key === '1') {
        e.preventDefault();
        handleRate('again');
      } else if (e.key === 'ArrowRight' || e.key === '2') {
        e.preventDefault();
        handleRate('mastered');
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowVi((prev) => !prev);
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleBookmark();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleRate, handleUndo, handleToggleBookmark, handleRequestExit, exitConfirmOpen]);

  // If completed summary screen
  if (isCompleted) {
    const totalReviewed = activeQuestions.length;
    const ratePercent = totalReviewed > 0 ? Math.round((masteredCount / totalReviewed) * 100) : 0;
    const hasMistakes = againCount > 0;

    return (
      <ClickSpark sparkColor="rgba(99, 102, 241, 0.85)" sparkCount={8} className="w-full">
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 max-w-2xl mx-auto animate-in fade-in duration-300">
          {ratePercent >= 70 && <Confetti particleCount={55} />}
          <Card className="w-full p-6 sm:p-8 bg-card border-border/80 shadow-2xl rounded-3xl text-center space-y-6">
            <div className="size-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-xs">
              <Trophy className="size-8 text-amber-500 fill-amber-500/20" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                Hoàn thành phiên lật thẻ
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                Tổng kết Flashcard
              </h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Bạn đã lướt qua tất cả <strong>{totalReviewed}</strong> câu hỏi trong phiên này. Thứ hạng Hộp Leitner đã được cập nhật trực tiếp vào hệ thống.
              </p>
            </div>

            {/* Stats Badges */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/60">
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-foreground font-mono">
                  <CountUp to={ratePercent} />%
                </div>
                <div className="text-[11px] text-muted-foreground">Tỷ lệ thuộc bài</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono flex items-center justify-center gap-1">
                  <CheckCircle2 className="size-4.5" /> <CountUp to={masteredCount} />
                </div>
                <div className="text-[11px] text-muted-foreground">Đã thuộc (+1 Box)</div>
              </div>
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-red-400 font-mono flex items-center justify-center gap-1">
                  <XCircle className="size-4.5" /> <CountUp to={againCount} />
                </div>
                <div className="text-[11px] text-muted-foreground">Cần ôn lại (Box 1)</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {historyStack.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  className="flex-1 h-11 rounded-xl border-border/80 text-foreground font-semibold cursor-pointer active:scale-95"
                  title="Quay lại thẻ cuối cùng đã lật (Ctrl+Z)"
                >
                  <Undo2 className="size-4 mr-2" />
                  Hoàn tác thẻ cuối
                </Button>
              )}

              {hasMistakes && (
                <Button
                  variant="default"
                  onClick={handleReviewMistakesOnly}
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-2"
                >
                  <RotateCcw className="size-4" />
                  Ôn ngay {againCount} câu chưa nhớ
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleRestartAll}
                className="flex-1 h-11 rounded-xl border-border/80 text-foreground font-semibold cursor-pointer active:scale-95"
              >
                <RotateCw className="size-4 mr-2" />
                Luyện lại toàn bộ ({totalCount} câu)
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
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-base font-bold">Không tìm thấy câu hỏi nào trong phiên này.</div>
        <Button variant="default" onClick={onExit} className="rounded-xl">
          <ArrowLeft className="size-4 mr-2" /> Về Trang chủ
        </Button>
      </div>
    );
  }

  // Answer indices check helper
  const isCorrectOption = (idx: number) => {
    return currentQ?.answer?.includes(idx) ?? false;
  };

  return (
    <ClickSpark sparkColor="rgba(99, 102, 241, 0.85)" sparkCount={8} className="w-full">
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-3 sm:p-6 max-w-5xl mx-auto selection:bg-primary/20 select-none">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRequestExit}
            className="h-8.5 px-3 rounded-xl border border-border/60 hover:bg-muted text-xs font-semibold cursor-pointer active:scale-95 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 mr-1" />
            <span className="hidden sm:inline">Trang chủ</span> (Esc)
          </Button>

          <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
            {deckTitle}
          </span>
        </div>

        {/* Card Counter & Score tally */}
        <div className="flex items-center gap-2">
          {/* Undo Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            className={`h-8.5 px-2.5 rounded-xl border text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
              historyStack.length > 0
                ? 'border-border/80 text-foreground hover:bg-muted'
                : 'border-border/40 text-muted-foreground/40 pointer-events-none'
            }`}
            title="Hoàn tác thẻ vừa đánh giá (Ctrl+Z hoặc phím U)"
          >
            <Undo2 className="size-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Hoàn tác</span>
          </Button>

          <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 font-bold">
            Thẻ {currentIndex + 1} / {totalCount}
          </Badge>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/25">
              ✓ {masteredCount}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-red-500/10 text-red-400 font-bold border border-red-500/25">
              ✗ {againCount}
            </span>
          </div>

          {/* Toggle Bilingual */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVi((prev) => !prev)}
            className={`h-8.5 px-2.5 rounded-xl border text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
              showVi
                ? 'bg-blue-500/15 border-blue-500 text-blue-400 font-bold'
                : 'border-border/70 text-muted-foreground'
            }`}
            title="Nhấn phím T để bật/tắt dịch tiếng Việt"
          >
            <Languages className="size-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Tiếng Việt</span> (T)
          </Button>

          {/* Bookmark */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleBookmark}
            className={`size-8.5 rounded-xl border cursor-pointer active:scale-95 transition-all ${
              isBookmarked
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                : 'border-border/60 text-muted-foreground hover:text-foreground'
            }`}
            title="Đánh dấu câu hỏi (Phím B)"
          >
            <Bookmark className={`size-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-8.5 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer active:scale-95 transition-all"
            title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
          >
            {isDark ? (
              <Sun className="size-4 text-amber-400" />
            ) : (
              <Moon className="size-4 text-indigo-400" />
            )}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="py-2">
        <Progress value={progressPercent} className="h-1.5 w-full bg-secondary rounded-full" />
      </div>

      {/* Flashcard 3D Interactive Card */}
      <div className="flex-1 flex flex-col justify-center my-auto py-3">
        <div 
          className="perspective-1000 w-full min-h-[480px] sm:min-h-[520px] select-none relative"
        >
          {/* Stacked Under-Cards Depth Illusion */}
          {currentIndex < totalCount - 1 && (
            <>
              <div className="absolute inset-x-3 -bottom-2 h-full rounded-3xl bg-card/60 border border-border/40 shadow-sm -z-10 pointer-events-none scale-[0.98] translate-y-2 opacity-70" />
              {currentIndex < totalCount - 2 && (
                <div className="absolute inset-x-6 -bottom-4 h-full rounded-3xl bg-card/40 border border-border/30 shadow-xs -z-20 pointer-events-none scale-[0.96] translate-y-4 opacity-40" />
              )}
            </>
          )}

          <motion.div
            key={currentQ.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.65}
            dragSnapToOrigin={true}
            onDragStart={() => {
              isDraggingRef.current = true;
            }}
            onDragEnd={(_e, info) => {
              setTimeout(() => {
                isDraggingRef.current = false;
              }, 60);

              const threshold = 100;
              if (info.offset.x > threshold) {
                handleRate('mastered');
              } else if (info.offset.x < -threshold) {
                handleRate('again');
              }
            }}
            onClick={() => {
              if (isDraggingRef.current) return;
              handleFlip();
            }}
            style={{
              x: dragX,
              rotate: dragRotate,
              transformStyle: isReduced ? 'flat' : 'preserve-3d',
            }}
            animate={
              isReduced
                ? { opacity: 1 }
                : {
                    rotateY: isFlipped ? 180 : 0,
                  }
            }
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 24,
            }}
            className="relative w-full h-full min-h-[480px] sm:min-h-[520px] rounded-3xl border border-border/90 shadow-xl bg-card cursor-grab active:cursor-grabbing group hover:border-primary/40 transition-colors"
          >
            {/* Visual Drag Badges */}
            <motion.div
              style={{ opacity: dragBadgeMasteredOpacity }}
              className="absolute top-4 left-4 z-40 pointer-events-none px-3.5 py-1.5 rounded-full bg-emerald-500 text-white font-mono font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5"
            >
              <Check className="size-4 stroke-[3]" /> ĐÃ THUỘC (+1 Box)
            </motion.div>

            <motion.div
              style={{ opacity: dragBadgeAgainOpacity }}
              className="absolute top-4 right-4 z-40 pointer-events-none px-3.5 py-1.5 rounded-full bg-red-500 text-white font-mono font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5"
            >
              <X className="size-4 stroke-[3]" /> CHƯA NHỚ (Hộp 1)
            </motion.div>

            {/* FRONT FACE (Question + ALL 4 Options) */}
            <div className={`absolute inset-0 w-full h-full p-6 sm:p-8 flex flex-col justify-between rounded-3xl bg-card overflow-y-auto ${
              isReduced
                ? (isFlipped ? 'hidden pointer-events-none' : 'block')
                : (isFlipped ? 'pointer-events-none' : '')
            } ${!isReduced ? 'backface-hidden' : ''}`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                      MẶT TRƯỚC · CÂU HỎI
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {currentQ?.type === 'multi' ? 'Nhiều đáp án đúng' : '1 đáp án duy nhất'}
                    </Badge>
                  </div>
                  {getBoxBadge(effectiveStats?.leitner_box)}
                </div>

                {/* Question English - High Contrast & Large Font */}
                <div className="text-lg sm:text-xl font-black text-foreground leading-relaxed pt-1">
                  {currentQ?.question}
                </div>

                {/* Question Vietnamese (if active) */}
                {showVi && currentQ?.vi?.question && (
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs sm:text-sm text-blue-300 leading-relaxed space-y-1 animate-in fade-in">
                    <span className="text-[10px] uppercase font-bold text-blue-400 font-mono tracking-wider block">
                      Dịch nghĩa câu hỏi:
                    </span>
                    <p className="font-medium">{currentQ.vi.question}</p>
                  </div>
                )}

                {/* All Options Preview on Front Face */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider block">
                    Các lựa chọn đáp án:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {(currentQ?.options || []).map((optionText, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const viOption = showVi ? currentQ?.vi?.options?.[idx] : null;
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors flex items-start gap-3 text-left"
                        >
                          <span className="size-6.5 rounded-lg bg-muted text-foreground border border-border/80 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            {letter}
                          </span>
                          <div className="space-y-0.5 text-xs sm:text-sm">
                            <p className="font-semibold text-foreground leading-relaxed">{optionText}</p>
                            {viOption && (
                              <p className="text-xs text-muted-foreground leading-relaxed italic">{viOption}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom prompt */}
              <div className="pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground mt-4">
                <span className="flex items-center gap-1.5 group-hover:text-primary transition-colors font-medium">
                  <RotateCw className="size-3.5 group-hover:rotate-180 transition-transform duration-500" />
                  Bấm <strong className="text-foreground font-mono">Space</strong> hoặc click thẻ để xem đáp án chuẩn
                </span>
                <span className="text-[10.5px] opacity-70">
                  Vuốt ngang hoặc phím: 1 Chưa nhớ · 2 Đã thuộc
                </span>
              </div>
            </div>

            {/* BACK FACE (Highlighted Answer + ALL Options + Explanation) */}
            <div className={`absolute inset-0 w-full h-full p-6 sm:p-8 flex flex-col justify-between rounded-3xl bg-card overflow-y-auto ${
              isReduced
                ? (!isFlipped ? 'hidden pointer-events-none' : 'block')
                : (!isFlipped ? 'pointer-events-none' : '')
            } ${!isReduced ? 'backface-hidden rotate-y-180' : ''}`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="size-3 font-bold" /> MẶT SAU · ĐÁP ÁN CHUẨN
                    </span>
                  </div>
                  {getBoxBadge(effectiveStats?.leitner_box)}
                </div>

                {/* Question Reminder at Top */}
                <div className="text-sm sm:text-base font-bold text-foreground leading-snug">
                  {currentQ?.question}
                </div>

                {/* Back Face: Display ONLY the Correct Answer */}
                <div className="space-y-2.5 pt-1">
                  <span className="text-xs font-mono font-bold uppercase text-emerald-500 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    Đáp án chính xác:
                  </span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {(currentQ?.options || [])
                      .map((optionText, idx) => ({ optionText, idx }))
                      .filter(({ idx }) => isCorrectOption(idx))
                      .map(({ optionText, idx }) => {
                        const letter = String.fromCharCode(65 + idx);
                        const viOption = showVi ? currentQ?.vi?.options?.[idx] : null;

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl border-2 border-emerald-500/80 bg-emerald-500/10 dark:bg-emerald-500/15 text-foreground shadow-md flex items-start gap-3.5 text-left transition-all animate-in zoom-in-95 duration-200"
                          >
                            <span className="size-8 rounded-xl font-mono font-extrabold text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-xs bg-emerald-500 text-white">
                              {letter}
                            </span>
                            <div className="space-y-1 text-sm sm:text-base flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-black text-emerald-600 dark:text-emerald-400 leading-relaxed">
                                  {optionText}
                                </p>
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shrink-0 font-black uppercase">
                                  ✓ ĐÁP ÁN ĐÚNG
                                </Badge>
                              </div>
                              {viOption && (
                                <p className="text-xs sm:text-sm leading-relaxed italic text-emerald-700/80 dark:text-emerald-300/80 pt-0.5">
                                  {viOption}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Detailed Explanation */}
                {currentQ?.explanation && (
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 text-xs text-foreground/90 space-y-2 leading-relaxed">
                    <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <HelpCircle className="size-3.5 text-primary" /> Giải thích chi tiết & Ghi chú:
                    </span>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
                      {currentQ.explanation}
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom prompt on back */}
              <div className="pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground mt-4">
                <span className="flex items-center gap-1.5 group-hover:text-primary transition-colors font-medium">
                  <RotateCw className="size-3.5" />
                  Bấm <strong className="text-foreground font-mono">Space</strong> để lật lại câu hỏi
                </span>
                <span className="text-[10.5px] opacity-70">
                  Vuốt ngang hoặc phím: 1 Chưa nhớ · 2 Đã thuộc
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating Action Bar (Decision Controls) */}
      <div className="pt-3 pb-1 border-t border-border/50">
        <div className="grid grid-cols-3 gap-2.5 max-w-xl mx-auto">
          {/* Again / Chưa nhớ */}
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleRate('again');
            }}
            className="h-12 rounded-2xl border-red-500/40 hover:border-red-500 hover:bg-red-500/10 text-red-400 font-bold text-xs sm:text-sm cursor-pointer active:scale-95 shadow-sm transition-all flex items-center justify-center gap-2 group"
          >
            <div className="size-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <X className="size-3.5 stroke-[3]" />
            </div>
            <span>Chưa nhớ</span>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-muted/80 px-1.5 py-0.5 rounded border border-border/70 text-foreground">
              ← 1
            </kbd>
          </Button>

          {/* Flip / Lật thẻ */}
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleFlip();
            }}
            className="h-12 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer active:scale-95 shadow-sm transition-all flex items-center justify-center gap-2 border border-border/70 hover:bg-muted text-foreground"
          >
            <RotateCw className={`size-4 ${isFlipped ? 'rotate-180' : ''} transition-transform duration-300`} />
            <span>{isFlipped ? 'Lật câu hỏi' : 'Lật đáp án'}</span>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-background/80 px-1.5 py-0.5 rounded border border-border/70 text-muted-foreground">
              Space
            </kbd>
          </Button>

          {/* Mastered / Đã thuộc */}
          <Button
            variant="default"
            onClick={(e) => {
              e.stopPropagation();
              handleRate('mastered');
            }}
            className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm cursor-pointer active:scale-95 shadow-md transition-all flex items-center justify-center gap-2 group"
          >
            <div className="size-5 rounded-full bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <Check className="size-3.5 stroke-[3]" />
            </div>
            <span>Đã thuộc</span>
            <kbd className="hidden sm:inline font-mono text-[10px] bg-emerald-700/60 text-emerald-100 px-1.5 py-0.5 rounded border border-emerald-500/40">
              2 →
            </kbd>
          </Button>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <Dialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-card border-border/80 shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
              <AlertCircle className="size-4" />
              Tạm dừng phiên ôn tập
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Bạn có muốn rời khỏi phiên Flashcard?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn đã ôn được <strong className="text-foreground">{currentIndex}</strong> / {totalCount} thẻ. Kết quả Hộp Leitner và tiến trình ôn tập của các câu đã lật đã được tự động lưu. Bạn có thể tiếp tục bất cứ lúc nào!
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/40 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExitConfirmOpen(false)}
              className="flex-1 h-9.5 rounded-xl border-border/80 text-foreground font-semibold text-xs cursor-pointer active:scale-95"
            >
              Tiếp tục lật thẻ
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleConfirmExit}
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

