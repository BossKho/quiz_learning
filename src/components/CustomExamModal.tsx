import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  GraduationCap, 
  BookOpen, 
  Clock, 
  Filter, 
  Sparkles, 
  Layers, 
  Loader2 
} from 'lucide-react';
import type { Deck, Question, QuestionScope } from '@/types/quiz';
import { dbService } from '@/services/db';
import { toast } from '@/components/ui/toast';

interface CustomExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decks: Deck[];
  onStartCustomSession: (
    questions: Question[],
    mode: 'study' | 'exam',
    title: string,
    timeLimitSec: number
  ) => void;
}

export const CustomExamModal: React.FC<CustomExamModalProps> = ({
  open,
  onOpenChange,
  decks,
  onStartCustomSession,
}) => {
  const [scope, setScope] = useState<QuestionScope>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [questionCount, setQuestionCount] = useState<number>(15);
  const [mode, setMode] = useState<'study' | 'exam'>('exam');
  const [timeOption, setTimeOption] = useState<'match_count' | '15' | '30' | '60' | 'none'>('match_count');
  const [availableCount, setAvailableCount] = useState<number>(0);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Filter out the pseudo "all" aggregate deck from deck options list
  const selectableDecks = decks.filter((d) => d.id !== '_all' && d.id !== 'all');

  // Recalculate available count whenever scope or deck selection changes
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoadingCount(true);

    const deckIds = selectedDeckId === 'all' ? undefined : [selectedDeckId];
    dbService
      .countAvailableQuestions({ scope, deckIds })
      .then((count) => {
        if (isMounted) {
          setAvailableCount(count);
          setIsLoadingCount(false);
        }
      })
      .catch((err) => {
        console.error('Failed to count custom questions:', err);
        if (isMounted) setIsLoadingCount(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, scope, selectedDeckId]);

  const handleStart = async () => {
    if (availableCount === 0) {
      toast.warning('Không có câu hỏi nào thỏa mãn các điều kiện đã chọn.');
      return;
    }

    setIsStarting(true);
    try {
      const deckIds = selectedDeckId === 'all' ? undefined : [selectedDeckId];
      const count = Math.min(questionCount, availableCount);
      const questions = await dbService.getCustomQuestions({
        count,
        scope,
        deckIds,
        shuffle: true,
      });

      if (questions.length === 0) {
        toast.warning('Không thể tạo bộ câu hỏi. Vui lòng thử lại.');
        return;
      }

      // Calculate time limit in seconds
      let timeLimitSec = 0;
      if (mode === 'exam') {
        if (timeOption === 'match_count') {
          timeLimitSec = count * 60; // 1 min per question
        } else if (timeOption === '15') {
          timeLimitSec = 15 * 60;
        } else if (timeOption === '30') {
          timeLimitSec = 30 * 60;
        } else if (timeOption === '60') {
          timeLimitSec = 60 * 60;
        } else {
          timeLimitSec = 0; // Unlimited
        }
      } else {
        // Study mode: usually unlimited or custom timer if chosen
        timeLimitSec = timeOption !== 'none' && timeOption !== 'match_count' 
          ? parseInt(timeOption, 10) * 60 
          : 0;
      }

      // Generate friendly session title
      const scopeLabel = 
        scope === 'new' 
          ? 'Câu chưa học' 
          : scope === 'learning_box12' 
          ? 'Củng cố Hộp 1–2' 
          : scope === 'bookmarked' 
          ? 'Câu đã gắn sao' 
          : 'Trộn tổng hợp';
      
      const sessionTitle = `Tùy chỉnh: ${scopeLabel} (${count} câu)`;

      onOpenChange(false);
      onStartCustomSession(questions, mode, sessionTitle, timeLimitSec);
    } catch (err) {
      console.error('Failed to start custom session:', err);
      toast.error('Đã xảy ra lỗi khi tạo đề thi tùy chỉnh.');
    } finally {
      setIsStarting(false);
    }
  };

  const countPills = [15, 30, 45, 60];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Filter className="size-4 text-primary" />
            Cấu hình đề thi
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
            Tạo đề thi tùy chỉnh
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Tùy chọn số lượng câu hỏi, phạm vi kiến thức và giới hạn thời gian làm bài.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Section 1: Question Scope */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Filter className="size-3.5 text-primary" />
              1. Phạm vi câu hỏi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                    : 'border-border/70 hover:border-primary/40 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="text-xs font-bold text-foreground">🎲 Tất cả</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Trộn ngẫu nhiên</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('new')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'new'
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                    : 'border-border/70 hover:border-primary/40 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="text-xs font-bold text-foreground">🆕 Chưa học</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Chưa làm lần nào</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('learning_box12')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'learning_box12'
                    ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500'
                    : 'border-border/70 hover:border-amber-500/40 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="text-xs font-bold text-amber-500">⚠️ Hộp 1–2</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Câu yếu hay sai</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('bookmarked')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'bookmarked'
                    ? 'border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500'
                    : 'border-border/70 hover:border-sky-500/40 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="text-xs font-bold text-sky-400">★ Đã gắn sao</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Bookmark cần xem</div>
              </button>
            </div>
          </div>

          {/* Section 2: Deck Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              2. Nguồn bộ đề
            </label>
            <select
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-card border border-border/80 text-foreground text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">Toàn bộ ngân hàng (Tất cả bộ đề)</option>
              {selectableDecks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.total_questions} câu)
                </option>
              ))}
            </select>
          </div>

          {/* Section 3: Question Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                3. Số lượng câu hỏi
              </label>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Khả dụng:{' '}
                {isLoadingCount ? (
                  <Loader2 className="size-3 animate-spin inline text-primary" />
                ) : (
                  <strong className="text-primary font-mono">{availableCount}</strong>
                )}{' '}
                câu
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {countPills.map((count) => (
                <Button
                  key={count}
                  type="button"
                  variant={questionCount === count ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuestionCount(count)}
                  className="rounded-xl text-xs h-9 px-4 font-mono font-bold cursor-pointer"
                >
                  {count} câu
                  {count === 15 && <span className="ml-1 text-[10px] font-normal opacity-80">(15p)</span>}
                  {count === 60 && <span className="ml-1 text-[10px] font-normal opacity-80">(Chuẩn)</span>}
                </Button>
              ))}
              <div className="flex items-center gap-1.5 pl-1">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, availableCount)}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-9 px-2 text-center rounded-xl bg-card border border-border/80 text-foreground text-xs font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-primary"
                  title="Nhập số lượng tùy chọn"
                />
                <span className="text-[11px] text-muted-foreground">câu tùy chọn</span>
              </div>
            </div>
          </div>

          {/* Section 4: Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-primary" />
              4. Chế độ thực hiện
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('exam')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  mode === 'exam'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500'
                    : 'border-border/70 hover:border-indigo-500/40 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 mt-0.5">
                  <GraduationCap className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Phòng thi thử (Exam Mode)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Bấm giờ đếm ngược, gắn cờ Flag câu khó, chấm điểm và xếp loại sau khi nộp bài.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('study')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  mode === 'study'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500'
                    : 'border-border/70 hover:border-emerald-500/40 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Luyện tập (Study Mode)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Biết ngay đúng/sai sau mỗi câu, xem giải thích chi tiết và dịch song ngữ tức thì.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 5: Timer Configuration (Especially for Exam Mode) */}
          {mode === 'exam' && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                5. Giới hạn thời gian
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setTimeOption('match_count')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    timeOption === 'match_count'
                      ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                      : 'border-border/70 hover:border-primary/40 text-muted-foreground'
                  }`}
                >
                  <div className="text-xs">{questionCount} phút</div>
                  <div className="text-[10px] opacity-75">1 phút/câu</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeOption('30')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    timeOption === '30'
                      ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                      : 'border-border/70 hover:border-primary/40 text-muted-foreground'
                  }`}
                >
                  <div className="text-xs">30 phút</div>
                  <div className="text-[10px] opacity-75">Áp lực vừa</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeOption('60')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    timeOption === '60'
                      ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                      : 'border-border/70 hover:border-primary/40 text-muted-foreground'
                  }`}
                >
                  <div className="text-xs">60 phút</div>
                  <div className="text-[10px] opacity-75">Thời gian chuẩn</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeOption('none')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    timeOption === 'none'
                      ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                      : 'border-border/70 hover:border-primary/40 text-muted-foreground'
                  }`}
                >
                  <div className="text-xs">Không giới hạn</div>
                  <div className="text-[10px] opacity-75">Thong thả làm</div>
                </button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between pt-3 border-t border-border/40 gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 px-4 rounded-xl cursor-pointer"
          >
            Đóng
          </Button>

          <Button
            type="button"
            variant={mode === 'exam' ? 'exam' : 'study'}
            size="sm"
            onClick={handleStart}
            disabled={isStarting || availableCount === 0}
            className="text-xs h-9 px-6 font-bold rounded-xl gap-2 shadow-sm cursor-pointer"
          >
            {isStarting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Đang khởi tạo...</span>
              </>
            ) : (
              <>
                <Zap className="size-3.5 fill-current" />
                <span>Bắt đầu bài làm ({Math.min(questionCount, availableCount)} câu)</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
