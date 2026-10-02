import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  GraduationCap, 
  RotateCcw, 
  Trash2, 
  Search, 
  Bookmark, 
  CheckCircle2, 
  Layers,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import type { Deck, ActiveSession } from '@/types/quiz';

interface DashboardProps {
  decks: Deck[];
  unfinishedSessions: ActiveSession[];
  stats: {
    totalQuestions: number;
    mastered: number;
    learning: number;
    bookmarked: number;
    completedSessions: number;
  };
  onStartSession: (deck: Deck, mode: 'study' | 'exam') => void;
  onResumeSession: (session: ActiveSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenExplorer: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  decks,
  unfinishedSessions,
  stats,
  onStartSession,
  onResumeSession,
  onDeleteSession,
  onOpenExplorer,
}) => {
  const mockDecks = decks.filter((d) => d.title.toLowerCase().includes('mock') || d.id.includes('mock'));
  const deDecks = decks.filter((d) => d.title.toLowerCase().includes('đề') || d.title.toLowerCase().includes('de'));
  const allDeck = decks.find((d) => d.id === '_all' || d.id === 'all');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-in fade-in-50 duration-200">
      {/* Top Banner / Welcome & Key Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Practice Workspace
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master your certification quizzes with instant bilingual translations and Leitner spaced repetition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenExplorer} className="gap-1.5">
            <Search className="size-3.5" />
            Full-text Search
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Questions</span>
            <Layers className="size-4 text-muted-foreground/60" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {stats.totalQuestions}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Across {decks.length} curated decks
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Mastered (Box 5)</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.mastered}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {stats.totalQuestions > 0 ? Math.round((stats.mastered / stats.totalQuestions) * 100) : 0}% mastery rate
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">In Review (Box 2-4)</span>
            <TrendingUp className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {stats.learning}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Active spaced repetition
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Bookmarked</span>
            <Bookmark className="size-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {stats.bookmarked}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Flagged for review
          </div>
        </Card>
      </div>

      {/* Unfinished Session Alert Banner */}
      {unfinishedSessions.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
              <RotateCcw className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                Resume Incomplete {unfinishedSessions[0].mode === 'exam' ? 'Exam' : 'Study'} Session
                <Badge variant={unfinishedSessions[0].mode === 'exam' ? 'warning' : 'info'} className="text-[10px] uppercase">
                  {unfinishedSessions[0].mode}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deck: <span className="font-medium text-foreground">{unfinishedSessions[0].deck_title}</span> • 
                Question {unfinishedSessions[0].current_index + 1} of {unfinishedSessions[0].total_questions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteSession(unfinishedSessions[0].id)}
              className="text-xs text-muted-foreground hover:text-destructive gap-1"
            >
              <Trash2 className="size-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => onResumeSession(unfinishedSessions[0])}
              className="text-xs gap-1.5"
            >
              Resume Now
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Master Question Bank Card */}
      {allDeck && (
        <Card className="border-border bg-gradient-to-r from-card to-accent/20">
          <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">ALL QUESTIONS</Badge>
                <h3 className="text-lg font-bold text-foreground">{allDeck.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                All 369 deduplicated questions from all mock exams and tests combined into one comprehensive bank.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartSession(allDeck, 'study')}
                className="gap-1.5"
              >
                <BookOpen className="size-3.5 text-emerald-500" />
                Study (369 Qs)
              </Button>
              <Button
                size="sm"
                onClick={() => onStartSession(allDeck, 'exam')}
                className="gap-1.5"
              >
                <GraduationCap className="size-3.5" />
                Exam Simulation
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Mock Tests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            Mock Tests (English / Bilingual)
            <Badge variant="secondary" className="font-mono text-[10px]">{mockDecks.length} Tests</Badge>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStartSession={onStartSession}
            />
          ))}
        </div>
      </div>

      {/* Đề thi thực chiến Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            Đề Thi Thực Chiến (Bộ Đề 1 - 7)
            <Badge variant="secondary" className="font-mono text-[10px]">{deDecks.length} Đề</Badge>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onStartSession={onStartSession}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface DeckCardProps {
  deck: Deck;
  onStartSession: (deck: Deck, mode: 'study' | 'exam') => void;
}

const DeckCard: React.FC<DeckCardProps> = ({ deck, onStartSession }) => {
  const mastered = deck.mastered_count || 0;
  const learning = deck.learning_count || 0;
  const total = deck.total_questions || 60;
  const percentMastered = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <Card className="hover:border-border/80 transition-all duration-150 flex flex-col justify-between">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            {deck.title}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
            {total} Qs
          </Badge>
        </div>
        <CardDescription className="text-[11px] truncate">
          {deck.source || 'Standard Test Deck'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3">
        {/* Leitner Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Mastery: {percentMastered}%</span>
            <span>{mastered} / {total} mastered</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${percentMastered}%` }}
              title={`Mastered: ${mastered}`}
            />
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${total > 0 ? (learning / total) * 100 : 0}%` }}
              title={`Learning: ${learning}`}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStartSession(deck, 'study')}
            className="text-xs h-8 gap-1.5"
          >
            <BookOpen className="size-3.5 text-emerald-500" />
            Study
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onStartSession(deck, 'exam')}
            className="text-xs h-8 gap-1.5"
          >
            <GraduationCap className="size-3.5" />
            Exam
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
