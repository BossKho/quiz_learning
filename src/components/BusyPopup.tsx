import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Zap,
  Languages
} from 'lucide-react';
import type { Question } from '@/types/quiz';
import { busyModeService } from '@/services/busyModeService';

interface BusyPopupProps {
  question?: Question | null;
  onClose?: () => void;
  isStandaloneWindow?: boolean;
}

export const BusyPopup: React.FC<BusyPopupProps> = ({
  question: propQuestion,
  onClose,
  isStandaloneWindow = false,
}) => {
  const [question, setQuestion] = useState<Question | null>(propQuestion || null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctAnswers: number[];
    explanation: string;
    nextBox: number;
  } | null>(null);

  // Translation toggle state (persisted in localStorage)
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    try {
      return localStorage.getItem('busy_show_translation') === 'true';
    } catch {
      return false;
    }
  });

  const toggleTranslation = () => {
    setShowTranslation((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('busy_show_translation', String(next));
      } catch {}
      return next;
    });
  };

  // Keyboard shortcut 'T' to toggle translation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
          toggleTranslation();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const [countdown, setCountdown] = useState<number>(10);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync with busyModeService if question wasn't passed directly
  useEffect(() => {
    if (propQuestion) {
      setQuestion(propQuestion);
      return;
    }

    const unsub = busyModeService.subscribe((state) => {
      setQuestion(state.activeQuestion);
      if (!state.activeQuestion) {
        setIsAnswered(false);
        setSelectedOption(null);
        setResult(null);
      }
    });

    return () => unsub();
  }, [propQuestion]);

  // Reset local state when a new question arrives
  useEffect(() => {
    if (question) {
      setSelectedOption(null);
      setIsAnswered(false);
      setResult(null);
      setCountdown(10);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [question?.id]);

  // Handle auto-close countdown when answered
  useEffect(() => {
    if (!isAnswered) return;

    setCountdown(10);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAnswered]);

  const handleSelectOption = async (index: number) => {
    if (isAnswered || !question) return;

    setSelectedOption(index);
    setIsAnswered(true);

    const res = await busyModeService.submitAnswer(question.id, index);
    setResult(res);
  };

  const handleDismiss = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (onClose) {
      onClose();
    } else {
      busyModeService.hidePopup();
    }
  };

  const handleNextNow = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await busyModeService.triggerQuestionNow(true);
  };

  if (!question) {
    return null;
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const currentBox = question.stats?.leitner_box || 1;
  const hasTranslation = Boolean(
    (question.vi?.question && question.vi.question !== question.question) ||
    (question.vi?.options && question.vi.options.some((opt) => opt && opt.trim() !== ''))
  );

  return (
    <div 
      className={`relative flex flex-col select-none overflow-hidden transition-all duration-200 ${
        isStandaloneWindow
          ? 'h-full w-full rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 border border-slate-200/90 dark:border-slate-800 shadow-2xl'
          : 'w-[450px] max-h-[550px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4'
      }`}
    >
      {/* Minimal Top Controls */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
          <Zap className="size-3 fill-current text-amber-500" />
          Hộp {currentBox} • {currentBox === 1 ? 'Mới' : currentBox === 5 ? 'Thuần thục' : 'Đang học'}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Nút Bật/Tắt Dịch tiếng Việt */}
          {hasTranslation && (
            <button
              type="button"
              onClick={toggleTranslation}
              title={showTranslation ? "Ẩn dịch tiếng Việt (phím tắt T)" : "Hiện dịch tiếng Việt (phím tắt T)"}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none ${
                showTranslation
                  ? 'bg-blue-600 text-white dark:bg-blue-600 shadow-xs ring-1 ring-blue-400/40'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              }`}
            >
              <Languages className="size-3.5" />
              <span>Dịch</span>
              {showTranslation && (
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
          )}

          {/* Minimal Close Button */}
          <button
            type="button"
            onClick={handleDismiss}
            title="Đóng / Bỏ qua câu này"
            className="size-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Question Content Area (Scrollable if question is extraordinarily long) */}
      <div className="py-1.5 flex-1 min-h-0 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 pr-1">
        {/* Question Text */}
        <div className="space-y-1">
          <p className="text-[13px] sm:text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {question.question}
          </p>
          {showTranslation && question.vi?.question && question.vi.question !== question.question && (
            <p className="text-[11.5px] sm:text-[12px] text-slate-600 dark:text-slate-400 italic leading-snug animate-in fade-in-50 duration-150">
              {question.vi.question}
            </p>
          )}
        </div>

        {/* Options List (Optimized compact spacing so 4 options fit without scrolling) */}
        <div className="space-y-1.5 pt-0.5">
          {question.options.map((optText, idx) => {
            const letter = optionLetters[idx] || `${idx + 1}`;
            const isChosen = selectedOption === idx;
            const isCorrectOption = result?.correctAnswers.includes(idx);
            
            // Light / Dark mode responsive option styles
            let btnStyle = 'border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 text-slate-800 dark:text-slate-200';
            let badgeStyle = 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-bold';

            if (isAnswered) {
              if (isCorrectOption) {
                btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/40';
                badgeStyle = 'bg-emerald-600 text-white font-black';
              } else if (isChosen && !isCorrectOption) {
                btnStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/70 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/40';
                badgeStyle = 'bg-rose-600 text-white font-black';
              } else {
                btnStyle = 'border-slate-200/60 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 opacity-60';
                badgeStyle = 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600';
              }
            }

            const viOpt = question.vi?.options?.[idx];

            return (
              <button
                key={idx}
                type="button"
                disabled={isAnswered}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-2 sm:p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer disabled:cursor-default ${btnStyle}`}
              >
                <span className={`shrink-0 size-5 rounded-md flex items-center justify-center text-[10.5px] font-mono mt-0.5 ${badgeStyle}`}>
                  {letter}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] leading-snug font-medium break-words">
                    {optText}
                  </div>
                  {showTranslation && viOpt && viOpt !== optText && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-tight mt-0.5 break-words animate-in fade-in-50 duration-150">
                      {viOpt}
                    </div>
                  )}
                </div>
                {isAnswered && isCorrectOption && (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
                {isAnswered && isChosen && !isCorrectOption && (
                  <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Answer Feedback & Explanation (Appears after answer) */}
        {isAnswered && result && (
          <div className="pt-1.5 space-y-2 animate-in fade-in-50 duration-200">
            {/* Status Result Pill */}
            <div className={`p-2 rounded-xl flex items-center gap-2 text-xs font-bold ${
              result.isCorrect 
                ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
            }`}>
              {result.isCorrect ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Chính xác! Lên Hộp {result.nextBox} (+1) 🎉</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-4 text-rose-600 dark:text-rose-400" />
                  <span>Chưa đúng! Quay về Hộp 1 để củng cố.</span>
                </>
              )}
            </div>

            {/* Explanation Snippet if available */}
            {result.explanation && (
              <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Giải thích:</span>
                </div>
                <p className="leading-relaxed line-clamp-3">
                  {result.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer & Auto-Close Timer Bar */}
      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 shrink-0 space-y-2 mt-1">
        {isAnswered ? (
          <div className="space-y-1.5">
            {/* Countdown Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="size-3 text-amber-500" />
                Tự đóng sau <strong className="text-slate-900 dark:text-white font-bold">{countdown}s</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNextNow}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Câu khác
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Đóng ngay
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Chọn 1 đáp án để kiểm tra nhanh</span>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer text-[10.5px]"
            >
              Để sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
