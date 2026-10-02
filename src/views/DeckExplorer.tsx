import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Bookmark, 
  Languages, 
  ArrowLeft,
  Info
} from 'lucide-react';
import type { Deck, Question } from '@/types/quiz';
import { dbService } from '@/services/db';

interface DeckExplorerProps {
  decks: Deck[];
  onBackToDashboard: () => void;
}

export const DeckExplorer: React.FC<DeckExplorerProps> = ({ decks, onBackToDashboard }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [selectedBox, setSelectedBox] = useState<number | undefined>(undefined);
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);
  const [results, setResults] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showViMap, setShowViMap] = useState<Record<string, boolean>>({});

  const toggleVi = (qId: string) => {
    setShowViMap((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleToggleBookmark = async (qId: string) => {
    const next = await dbService.toggleBookmark(qId);
    setResults((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              stats: q.stats
                ? { ...q.stats, is_bookmarked: next }
                : {
                    question_id: qId,
                    leitner_box: 1,
                    next_review_at: 0,
                    correct_count: 0,
                    incorrect_count: 0,
                    streak: 0,
                    is_bookmarked: next,
                    last_reviewed_at: 0,
                  },
            }
          : q
      )
    );
  };

  const executeSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await dbService.searchQuestions({
        query: searchQuery,
        deck_id: selectedDeckId || undefined,
        box: selectedBox,
        is_bookmarked: onlyBookmarked ? true : undefined,
        limit: 100,
        offset: 0,
      });
      setResults(res.questions);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedDeckId, selectedBox, onlyBookmarked]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      executeSearch();
    }, 200);
    return () => clearTimeout(timeout);
  }, [executeSearch]);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBackToDashboard} className="gap-1 text-xs">
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Question Search & Database Explorer
            </h1>
            <p className="text-xs text-muted-foreground">
              Powered by SQLite FTS4 virtual table • Searches questions, translations, and explanations
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-muted-foreground">
          Found <span className="font-semibold text-foreground">{totalCount}</span> questions
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords in English, Vietnamese, explanation, notes..."
            className="pl-9 h-10 text-sm bg-card border-border"
          />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Deck selector */}
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Decks ({decks.length})</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.total_questions})
              </option>
            ))}
          </select>

          {/* Leitner Box filter */}
          <select
            value={selectedBox === undefined ? '' : String(selectedBox)}
            onChange={(e) => setSelectedBox(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Leitner Boxes</option>
            <option value="1">Box 1: New</option>
            <option value="2">Box 2: Learning</option>
            <option value="3">Box 3: Familiar</option>
            <option value="4">Box 4: Proficient</option>
            <option value="5">Box 5: Mastered</option>
          </select>

          {/* Bookmarked Filter */}
          <Button
            variant={onlyBookmarked ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setOnlyBookmarked(!onlyBookmarked)}
            className="h-8 text-xs gap-1.5"
          >
            <Bookmark className="size-3.5" fill={onlyBookmarked ? 'currentColor' : 'none'} />
            Bookmarked Only
          </Button>

          {(searchQuery || selectedDeckId || selectedBox !== undefined || onlyBookmarked) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedDeckId('');
                setSelectedBox(undefined);
                setOnlyBookmarked(false);
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Querying SQLite database...
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground border rounded-xl border-dashed border-border">
            No questions matched your search criteria.
          </div>
        ) : (
          results.map((q) => {
            const showVi = Boolean(showViMap[q.id]);
            const isBookmarked = Boolean(q.stats?.is_bookmarked);

            return (
              <Card key={q.id} className="p-5 space-y-4 border-border shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                      {q.id}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {q.type === 'multi' ? 'Multi-select' : 'Single-choice'}
                    </Badge>
                    {q.stats && (
                      <Badge
                        variant={q.stats.leitner_box === 5 ? 'success' : q.stats.leitner_box > 1 ? 'warning' : 'outline'}
                        className="text-[10px] font-mono"
                      >
                        Box {q.stats.leitner_box}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={showVi ? 'default' : 'outline'}
                      size="xs"
                      onClick={() => toggleVi(q.id)}
                      className="gap-1 text-[11px]"
                    >
                      <Languages className="size-3" />
                      Tiếng Việt
                    </Button>

                    <Button
                      variant={isBookmarked ? 'secondary' : 'outline'}
                      size="icon-sm"
                      onClick={() => handleToggleBookmark(q.id)}
                      className={isBookmarked ? 'text-sky-500' : 'text-muted-foreground'}
                    >
                      <Bookmark className="size-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
                    </Button>
                  </div>
                </div>

                {/* Question */}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold leading-normal text-foreground">
                    {q.question}
                  </h3>
                  {showVi && q.vi?.question && (
                    <div className="p-2.5 rounded-md bg-muted/50 border border-border/80 text-xs font-medium text-foreground/90">
                      {q.vi.question}
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-1.5 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.answer.includes(optIdx);
                    const letter = optionLetters[optIdx] || `${optIdx + 1}`;
                    const viOpt = q.vi?.options ? q.vi.options[optIdx] : null;

                    return (
                      <div
                        key={optIdx}
                        className={`flex items-start gap-2.5 p-2 rounded-md border text-xs ${
                          isCorrect
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground font-medium'
                            : 'border-border/40 text-muted-foreground'
                        }`}
                      >
                        <div
                          className={`flex size-4 shrink-0 items-center justify-center rounded-xs text-[10px] font-mono font-semibold ${
                            isCorrect ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {letter}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div>{opt}</div>
                          {showVi && viOpt && <div className="text-[11px] opacity-80">{viOpt}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="pt-2 text-xs text-muted-foreground border-t border-border/60 space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                      <Info className="size-3 text-primary" />
                      Explanation:
                    </span>
                    <p className="leading-relaxed">{q.explanation}</p>
                    {q.note && (
                      <p className="text-[11px] pt-0.5">
                        <span className="font-semibold text-foreground">Note:</span> {q.note}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
