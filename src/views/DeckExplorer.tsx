import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Bookmark, 
  Languages, 
  ArrowLeft,
  Info,
  CheckCircle2,
  FilterX
} from 'lucide-react';
import type { Deck, Question, SearchFilter } from '@/types/quiz';
import { dbService } from '@/services/db';

interface DeckExplorerProps {
  decks: Deck[];
  initialFilter?: SearchFilter;
  onBackToDashboard: () => void;
}

export const DeckExplorer: React.FC<DeckExplorerProps> = ({ 
  decks, 
  initialFilter,
  onBackToDashboard 
}) => {
  const [searchQuery, setSearchQuery] = useState(initialFilter?.query || '');
  const [selectedDeckId, setSelectedDeckId] = useState<string>(initialFilter?.deck_id || '');
  const [boxSelection, setBoxSelection] = useState<string>(() => {
    if (initialFilter?.min_box && initialFilter?.max_box) {
      return `${initialFilter.min_box}-${initialFilter.max_box}`;
    }
    if (initialFilter?.box !== undefined) {
      return String(initialFilter.box);
    }
    return '';
  });
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(Boolean(initialFilter?.is_bookmarked));
  const [results, setResults] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showViMap, setShowViMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter.query || '');
      setSelectedDeckId(initialFilter.deck_id || '');
      if (initialFilter.min_box && initialFilter.max_box) {
        setBoxSelection(`${initialFilter.min_box}-${initialFilter.max_box}`);
      } else if (initialFilter.box !== undefined) {
        setBoxSelection(String(initialFilter.box));
      } else {
        setBoxSelection('');
      }
      setOnlyBookmarked(Boolean(initialFilter.is_bookmarked));
    }
  }, [initialFilter]);

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
      let box: number | undefined;
      let min_box: number | undefined;
      let max_box: number | undefined;

      if (boxSelection === '2-4') {
        min_box = 2;
        max_box = 4;
      } else if (boxSelection !== '') {
        box = parseInt(boxSelection, 10);
      }

      const res = await dbService.searchQuestions({
        query: searchQuery,
        deck_id: selectedDeckId || undefined,
        box,
        min_box,
        max_box,
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
  }, [searchQuery, selectedDeckId, boxSelection, onlyBookmarked]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      executeSearch();
    }, 150);
    return () => clearTimeout(timeout);
  }, [executeSearch]);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const hasActiveFilters = Boolean(searchQuery || selectedDeckId || boxSelection !== '' || onlyBookmarked);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBackToDashboard} className="gap-1.5 text-xs font-semibold">
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Button>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Tra Cứu & Tìm Kiếm Câu Hỏi
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bộ tìm kiếm tức thì • Tra cứu toàn văn câu hỏi, đáp án và phần giải thích chi tiết
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-muted/50 border-border">
            Found <span className="font-bold text-foreground mx-1">{totalCount}</span> questions
          </Badge>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="space-y-3.5 bg-card/80 p-4 rounded-xl border border-border shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type keywords in English, Vietnamese, explanation, notes..."
            className="pl-10 h-10 text-sm bg-background border-border/80 focus-visible:ring-primary font-medium"
          />
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs pt-1">
          {/* Deck selector */}
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
            value={boxSelection}
            onChange={(e) => setBoxSelection(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Leitner Boxes</option>
            <option value="1">Box 1: New</option>
            <option value="2-4">Box 2-4: In Review</option>
            <option value="2">Box 2: Learning</option>
            <option value="3">Box 3: Familiar</option>
            <option value="4">Box 4: Proficient</option>
            <option value="5">Box 5: Mastered</option>
          </select>

          {/* Bookmarked Filter Button */}
          <Button
            variant={onlyBookmarked ? 'accent' : 'outline'}
            size="sm"
            onClick={() => setOnlyBookmarked(!onlyBookmarked)}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            <Bookmark className="size-3.5" fill={onlyBookmarked ? 'currentColor' : 'none'} />
            <span>Bookmarked Only</span>
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedDeckId('');
                setBoxSelection('');
                setOnlyBookmarked(false);
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <FilterX className="size-3.5" />
              Reset Filters
            </Button>
          )}
        </div>

        {/* Active Filter Pill Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
            <span className="font-semibold text-foreground">Active Filter:</span>
            {onlyBookmarked && (
              <Badge variant="info" className="text-[10px] font-medium">
                ★ Bookmarked Questions
              </Badge>
            )}
            {boxSelection !== '' && (
              <Badge variant="warning" className="text-[10px] font-medium">
                {boxSelection === '2-4' ? 'In Review (Box 2-4)' : `Box ${boxSelection}`}
              </Badge>
            )}
            {selectedDeckId && (
              <Badge variant="outline" className="text-[10px] font-medium">
                Deck: {decks.find(d => d.id === selectedDeckId)?.title || selectedDeckId}
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="text-[10px] font-medium font-mono">
                "{searchQuery}"
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground bg-card/40 rounded-xl border border-border">
            Đang tra cứu dữ liệu...
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground border rounded-xl border-dashed border-border bg-card/30 space-y-2">
            <p className="font-medium text-foreground">No questions matched your search criteria.</p>
            <p className="text-xs text-muted-foreground">
              {onlyBookmarked 
                ? "You haven't bookmarked any questions yet. In Study Mode, press [B] on any question to bookmark it!"
                : "Try searching with broader terms or resetting your filters."}
            </p>
          </div>
        ) : (
          results.map((q) => {
            const showVi = Boolean(showViMap[q.id]);
            const isBookmarked = Boolean(q.stats?.is_bookmarked);

            return (
              <Card key={q.id} className="p-5 space-y-4 border-border bg-card hover:border-border/80 transition-colors shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground bg-muted/80 px-2 py-0.5 rounded border border-border/60">
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

                  <div className="flex items-center gap-2">
                    <Button
                      variant={showVi ? 'study' : 'outline'}
                      size="xs"
                      onClick={() => toggleVi(q.id)}
                      className="gap-1 text-[11px] h-7"
                    >
                      <Languages className="size-3" />
                      Tiếng Việt
                    </Button>

                    <Button
                      variant={isBookmarked ? 'accent' : 'outline'}
                      size="icon-sm"
                      onClick={() => handleToggleBookmark(q.id)}
                      className={isBookmarked ? 'text-white' : 'text-muted-foreground'}
                      title={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                    >
                      <Bookmark className="size-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
                    </Button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold leading-normal text-foreground">
                    {q.question}
                  </h3>
                  {showVi && q.vi?.question && (
                    <div className="p-3 rounded-lg bg-muted/60 border border-border/80 text-xs font-medium text-foreground/90 leading-relaxed">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block mb-0.5">
                        Bản dịch tiếng Việt:
                      </span>
                      {q.vi.question}
                    </div>
                  )}
                </div>

                {/* Options List */}
                <div className="space-y-2 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.answer.includes(optIdx);
                    const letter = optionLetters[optIdx] || `${optIdx + 1}`;
                    const viOpt = q.vi?.options ? q.vi.options[optIdx] : null;

                    return (
                      <div
                        key={optIdx}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs transition-colors ${
                          isCorrect
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-foreground font-medium'
                            : 'border-border/60 bg-background/50 text-muted-foreground'
                        }`}
                      >
                        <div
                          className={`flex size-5 shrink-0 items-center justify-center rounded-xs text-[10px] font-mono font-bold ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground border border-border/60'
                          }`}
                        >
                          {letter}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className={isCorrect ? 'text-foreground font-semibold' : ''}>{opt}</div>
                          {showVi && viOpt && <div className="text-[11px] opacity-80">{viOpt}</div>}
                        </div>
                        {isCorrect && <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="pt-3 text-xs text-muted-foreground border-t border-border/80 space-y-1 bg-muted/20 p-3 rounded-lg">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <Info className="size-3.5 text-primary" />
                      Explanation:
                    </span>
                    <p className="leading-relaxed text-foreground/80">{q.explanation}</p>
                    {q.note && (
                      <p className="text-[11px] pt-1 text-muted-foreground border-t border-border/40">
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
