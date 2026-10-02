import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Home, 
  Check, 
  X, 
  Languages, 
  Info
} from 'lucide-react';
import type { ExamResultSummary } from '@/types/quiz';

interface ExamReviewProps {
  result: ExamResultSummary;
  onRetakeExam: () => void;
  onReturnDashboard: () => void;
}

export const ExamReview: React.FC<ExamReviewProps> = ({
  result,
  onRetakeExam,
  onReturnDashboard,
}) => {
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [showViMap, setShowViMap] = useState<Record<string, boolean>>({});

  const toggleVi = (qId: string) => {
    setShowViMap((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const filteredDetails = result.details.filter((item) => {
    if (filter === 'incorrect') return !item.isCorrect;
    if (filter === 'correct') return item.isCorrect;
    return true;
  });

  const minutesSpent = Math.floor(result.time_spent_sec / 60);
  const secondsSpent = result.time_spent_sec % 60;
  const timeSpentFormatted = `${minutesSpent}m ${secondsSpent}s`;
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8 animate-in fade-in-50 duration-200">
      {/* Top Banner / Score Card */}
      <Card className="p-8 border-border bg-gradient-to-b from-card to-muted/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Badge variant={result.passed ? 'success' : 'destructive'} className="text-xs uppercase font-mono">
                {result.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                Passing Score: 70%
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {result.deck_title} — Examination Report
            </h1>
            <p className="text-xs text-muted-foreground">
              Completed in {timeSpentFormatted}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border shadow-xs min-w-[140px]">
            <div className={`text-4xl font-black font-mono tracking-tight ${
              result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
            }`}>
              {result.score_percent}%
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              {result.correct_count} / {result.total_questions} Correct
            </div>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border text-center">
          <div>
            <span className="text-xs text-muted-foreground">Total Questions</span>
            <div className="text-lg font-bold text-foreground font-mono">{result.total_questions}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Correct Answers</span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {result.correct_count}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Incorrect / Skipped</span>
            <div className="text-lg font-bold text-destructive font-mono">
              {result.incorrect_count}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onReturnDashboard} className="gap-1.5 text-xs">
            <Home className="size-3.5" />
            Dashboard
          </Button>
          <Button variant="default" size="sm" onClick={onRetakeExam} className="gap-1.5 text-xs">
            <RotateCcw className="size-3.5" />
            Retake Exam
          </Button>
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs"
          >
            All Questions ({result.details.length})
          </Button>
          <Button
            variant={filter === 'incorrect' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('incorrect')}
            className="text-xs text-destructive hover:text-destructive"
          >
            Incorrect Only ({result.incorrect_count})
          </Button>
          <Button
            variant={filter === 'correct' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('correct')}
            className="text-xs text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"
          >
            Correct Only ({result.correct_count})
          </Button>
        </div>
      </div>

      {/* Review Question List */}
      <div className="space-y-4">
        {filteredDetails.map((item) => {
          const q = item.question;
          const userAns = item.userAnswer;
          const isCorrect = item.isCorrect;
          const showVi = Boolean(showViMap[q.id]);

          return (
            <Card key={q.id} className="p-6 space-y-4 border-border shadow-2xs">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant={isCorrect ? 'success' : 'destructive'} className="gap-1 text-[11px] font-mono">
                    {isCorrect ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">ID: {q.id}</span>
                </div>

                <Button
                  variant={showVi ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => toggleVi(q.id)}
                  className="gap-1 text-[11px]"
                >
                  <Languages className="size-3" />
                  Tiếng Việt
                </Button>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <p className="text-base font-semibold text-foreground leading-normal">{q.question}</p>
                {showVi && q.vi?.question && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/80 text-xs font-medium text-foreground/90">
                    {q.vi.question}
                  </div>
                )}
              </div>

              {/* Options Breakdown */}
              <div className="space-y-2 pt-2">
                {q.options.map((opt, optIdx) => {
                  const isUserSelection = userAns.includes(optIdx);
                  const isCorrectChoice = q.answer.includes(optIdx);
                  const letter = optionLetters[optIdx] || `${optIdx + 1}`;
                  const viOpt = q.vi?.options ? q.vi.options[optIdx] : null;

                  let optClass = 'border-border/60 opacity-70';
                  let icon = null;

                  if (isCorrectChoice) {
                    optClass = 'border-emerald-500 bg-emerald-500/10 opacity-100 font-medium text-foreground';
                    icon = <Check className="size-4 text-emerald-500 shrink-0" />;
                  } else if (isUserSelection && !isCorrectChoice) {
                    optClass = 'border-destructive/80 bg-destructive/10 opacity-100 font-medium text-foreground';
                    icon = <X className="size-4 text-destructive shrink-0" />;
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${optClass}`}
                    >
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-[11px] font-mono font-semibold">
                        {letter}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div>{opt}</div>
                        {showVi && viOpt && (
                          <div className="text-xs text-muted-foreground">{viOpt}</div>
                        )}
                      </div>
                      {icon}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <div className="pt-3 border-t border-border text-xs leading-relaxed text-muted-foreground bg-muted/20 p-3 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
                  <Info className="size-3.5 text-primary" />
                  Explanation:
                </div>
                <p>{q.explanation || 'No explanation available.'}</p>
                {q.note && (
                  <div className="pt-1 text-[11px]">
                    <span className="font-semibold text-foreground">Note:</span> {q.note}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
