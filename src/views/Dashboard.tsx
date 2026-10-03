import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  TrendingUp,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ChevronRight,
  FileText,
  Award,
  Zap,
  Check,
  Loader2,
  Plus
} from 'lucide-react';
import type { Deck, ActiveSession, SearchFilter, Question } from '@/types/quiz';
import { CustomExamModal } from '@/components/CustomExamModal';
import { DeckImporterModal } from '@/components/DeckImporterModal';
import { BusyModeModal } from '@/components/BusyModeModal';
import { busyModeService, type BusyModeState } from '@/services/busyModeService';
import { dbService } from '@/services/db';
import { toast } from '@/components/ui/toast';
import { getAvailableTopics, getTopicConfig, resolveDeckTopic } from '@/config/topics';

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
  onRestartSession: (deck: Deck, mode: 'study' | 'exam') => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenExplorer: (filter?: SearchFilter) => void;
  onStartFlashcard: (questions: Question[], title: string) => void;
  onStartCustomSession: (questions: Question[], mode: 'study' | 'exam', title: string, timeLimitSec: number) => void;
  onOpenSyncModal: () => void;
  onResetDeckProgress: (deckId: string) => Promise<void>;
  onResetAllProgress?: () => Promise<void>;
  onReloadData?: () => Promise<void>;
  onOpenBusyModal?: () => void;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'default' | 'progress_desc' | 'in_progress' | 'title_asc';

export const Dashboard: React.FC<DashboardProps> = ({
  decks,
  unfinishedSessions,
  stats,
  onStartSession,
  onResumeSession,
  onRestartSession,
  onDeleteSession,
  onResetDeckProgress,
  onOpenExplorer,
  onStartFlashcard,
  onStartCustomSession,
  onReloadData,
  onOpenBusyModal,
}) => {
  // Topic selection & modal states
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [deckImporterOpen, setDeckImporterOpen] = useState(false);
  const [busyModalOpen, setBusyModalOpen] = useState(false);
  const [busyState, setBusyState] = useState<BusyModeState>(busyModeService.getSnapshot());

  useEffect(() => {
    const unsub = busyModeService.subscribe((state) => {
      setBusyState(state);
    });
    return () => unsub();
  }, []);

  // Modal states for Custom Exam & Flashcard Mode
  const [customExamOpen, setCustomExamOpen] = useState(false);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);
  const [flashcardLoading, setFlashcardLoading] = useState(false);

  // View & Filter states
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [searchFilter, setSearchFilter] = useState('');

  // Selected Deck for Action Modal
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  // Active session for selected deck
  const activeSessionForSelected = useMemo(() => {
    if (!selectedDeck) return undefined;
    return unfinishedSessions.find((s) => s.deck_id === selectedDeck.id);
  }, [selectedDeck, unfinishedSessions]);

  // Topic configurations & registry discovery
  const availableTopics = useMemo(() => getAvailableTopics(decks), [decks]);
  const activeTopicConfig = useMemo(() => getTopicConfig(selectedTopicId), [selectedTopicId]);

  // Separate allDeck from individual decks
  const allDeck = useMemo(() => decks.find((d) => d.id === '_all' || d.id === 'all'), [decks]);
  const regularDecks = useMemo(() => decks.filter((d) => d.id !== '_all' && d.id !== 'all'), [decks]);

  // Filter regular decks by selected topic
  const topicDecks = useMemo(() => {
    if (selectedTopicId === 'all') return regularDecks;
    return regularDecks.filter((d) => resolveDeckTopic(d) === selectedTopicId);
  }, [regularDecks, selectedTopicId]);

  // Topic deck count map
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = { all: regularDecks.length };
    regularDecks.forEach((d) => {
      const t = resolveDeckTopic(d);
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [regularDecks]);

  // Exact topic stats query synced with SQLite
  const [topicStats, setTopicStats] = useState<typeof stats | null>(null);

  useEffect(() => {
    if (selectedTopicId === 'all') {
      setTopicStats(null);
      return;
    }
    let active = true;
    dbService.getOverallStats(selectedTopicId).then((res) => {
      if (active) setTopicStats(res);
    }).catch((err) => {
      console.error('Failed to get topic stats:', err);
    });
    return () => { active = false; };
  }, [selectedTopicId, decks, stats]);

  const displayStats = useMemo(() => {
    if (selectedTopicId === 'all') return stats;
    if (topicStats) return topicStats;
    let totalQuestions = 0;
    let mastered = 0;
    let learning = 0;
    topicDecks.forEach((d) => {
      totalQuestions += d.total_questions || 0;
      mastered += d.mastered_count || 0;
      learning += d.learning_count || 0;
    });
    return {
      totalQuestions,
      mastered,
      learning,
      bookmarked: stats.bookmarked,
      completedSessions: stats.completedSessions,
    };
  }, [selectedTopicId, stats, topicStats, topicDecks]);

  // Filter & Sort decks within selected topic
  const filteredAndSortedDecks = useMemo(() => {
    let result = [...topicDecks];

    // Filter by search keyword
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      result = result.filter(
        (d) => d.title.toLowerCase().includes(q) || (d.source && d.source.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'in_progress') {
        const aHas = unfinishedSessions.some((s) => s.deck_id === a.id);
        const bHas = unfinishedSessions.some((s) => s.deck_id === b.id);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
      }
      if (sortBy === 'progress_desc') {
        const aRate = a.total_questions > 0 ? (a.mastered_count || 0) / a.total_questions : 0;
        const bRate = b.total_questions > 0 ? (b.mastered_count || 0) / b.total_questions : 0;
        return bRate - aRate;
      }
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title, undefined, { numeric: true });
      }
      return 0; // Default
    });

    return result;
  }, [topicDecks, searchFilter, sortBy, unfinishedSessions]);

  const isFastTrack = selectedTopicId === 'fast_track';
  const isAll = selectedTopicId === 'all';

  // Group into Mock tests, Đề thi thực chiến, and Other Topic Decks
  const mockDecks = useMemo(
    () => filteredAndSortedDecks.filter((d) => 
      (resolveDeckTopic(d) === 'fast_track' || isFastTrack) && 
      (d.title.toLowerCase().includes('mock') || d.id.includes('mock'))
    ),
    [filteredAndSortedDecks, isFastTrack]
  );
  const deDecks = useMemo(
    () => filteredAndSortedDecks.filter((d) => 
      (resolveDeckTopic(d) === 'fast_track' || isFastTrack) && 
      !d.title.toLowerCase().includes('mock') && !d.id.includes('mock')
    ),
    [filteredAndSortedDecks, isFastTrack]
  );
  const otherTopicDecks = useMemo(
    () => filteredAndSortedDecks.filter((d) => 
      !isFastTrack && (resolveDeckTopic(d) !== 'fast_track' || !isAll)
    ),
    [filteredAndSortedDecks, isFastTrack, isAll]
  );

  // Quick Flashcard launcher by scope
  const handleLaunchQuickFlashcard = async (
    scope: 'all' | 'learning_box12' | 'bookmarked',
    title: string
  ) => {
    setFlashcardLoading(true);
    try {
      const qs = await dbService.getCustomQuestions({
        count: 100,
        scope,
        shuffle: true,
      });
      if (qs.length === 0) {
        toast.warning('Không có câu hỏi nào thuộc phạm vi này để ôn tập flashcard.');
        return;
      }
      setFlashcardModalOpen(false);
      onStartFlashcard(qs, title);
    } catch (err) {
      console.error('Failed to load flashcard questions:', err);
      toast.error('Không thể tải câu hỏi flashcard. Vui lòng thử lại.');
    } finally {
      setFlashcardLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-in fade-in-50 duration-200">
      {/* Sleek Segmented Topic Capsule Track */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {availableTopics.map((topic) => {
            const isSelected = selectedTopicId === topic.id;
            const count = topicCounts[topic.id] || 0;

            // Signature theme gradient per topic when selected
            let activeStyle = 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-indigo-600 dark:via-blue-600 dark:to-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20';
            if (topic.id === 'fast_track') {
              activeStyle = 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/30';
            } else if (topic.id === 'japanese') {
              activeStyle = 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400/30';
            } else if (topic.id === 'english') {
              activeStyle = 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/30';
            }

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setSelectedTopicId(topic.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
                  isSelected
                    ? activeStyle
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <span>{topic.icon}</span>
                <span>{topic.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected 
                    ? 'bg-white/25 text-white font-black' 
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Action Controls: Busy Mode Pill + Nạp đề JSON */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => (onOpenBusyModal ? onOpenBusyModal() : setBusyModalOpen(true))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
              busyState.settings.enabled
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 ring-1 ring-amber-500/30'
                : 'bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
          >
            <Zap className={`size-3.5 ${busyState.settings.enabled ? 'text-amber-500 fill-amber-500 animate-pulse' : 'text-amber-500'}`} />
            <span>Busy Mode</span>
            {busyState.settings.enabled && (
              <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {busyState.settings.intervalMinutes}p
              </span>
            )}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeckImporterOpen(true)}
            className="shrink-0 h-8 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/10 hover:border-primary cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="size-3.5" />
            <span>Nạp đề JSON</span>
          </Button>
        </div>
      </div>

      {/* Adaptive Header Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-border/80 bg-gradient-to-br from-white via-slate-50/60 to-blue-50/40 dark:from-card dark:via-card dark:to-blue-950/20 px-7 sm:px-8 py-7 shadow-xs">
        <div className="relative z-10 space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide">
            <span>{activeTopicConfig.icon}</span>
            <span>{activeTopicConfig.badgeText}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-foreground">
            {activeTopicConfig.titlePrefix}{' '}
            <span className={`bg-gradient-to-r ${activeTopicConfig.colorGradient} bg-clip-text text-transparent`}>
              {activeTopicConfig.titleHighlight}
            </span>
          </h1>

          <p className="text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
            {activeTopicConfig.description}
          </p>
        </div>

        {/* Soft, clean ambient radial glow on the right */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none" />
      </div>

      {/* Interactive Metrics Row - Dynamic Stats per Active Topic */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Questions */}
        <Card 
          onClick={() => onOpenExplorer({})}
          className="p-4 bg-gradient-to-br from-white to-blue-50/50 dark:from-card dark:to-blue-950/20 hover:from-white hover:to-blue-100/60 dark:hover:from-card dark:hover:to-blue-900/30 border-slate-200 dark:border-border hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer group shadow-2xs relative overflow-hidden rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground group-hover:text-foreground transition-colors">
              Tổng số câu hỏi
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-foreground">
            {displayStats.totalQuestions}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-muted-foreground flex items-center justify-between">
            <span>{topicDecks.length} bộ đề</span>
            <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Xem tất cả <ArrowRight className="size-3" />
            </span>
          </div>
        </Card>

        {/* Mastered (Box 5) */}
        <Card 
          onClick={() => onOpenExplorer({ box: 5 })}
          className="p-4 bg-gradient-to-br from-white to-emerald-50/50 dark:from-card dark:to-emerald-950/20 hover:from-white hover:to-emerald-100/60 dark:hover:from-card dark:hover:to-emerald-900/30 border-slate-200 dark:border-border hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer group shadow-2xs relative overflow-hidden rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Đã thuộc (Hộp 5)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {displayStats.mastered}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
              {displayStats.totalQuestions > 0 ? Math.round((displayStats.mastered / displayStats.totalQuestions) * 100) : 0}% tỷ lệ thuộc
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Xem câu thuộc <ArrowRight className="size-3" />
            </span>
          </div>
        </Card>

        {/* In Review (Box 2-4) */}
        <Card 
          onClick={() => onOpenExplorer({ min_box: 2, max_box: 4 })}
          className="p-4 bg-gradient-to-br from-white to-amber-50/50 dark:from-card dark:to-amber-950/20 hover:from-white hover:to-amber-100/60 dark:hover:from-card dark:hover:to-amber-900/30 border-slate-200 dark:border-border hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer group shadow-2xs relative overflow-hidden rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Đang ôn luyện (Hộp 2-4)
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {displayStats.learning}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-muted-foreground flex items-center justify-between">
            <span>Chu kỳ ngắt quãng</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Xem câu ôn <ArrowRight className="size-3" />
            </span>
          </div>
        </Card>

        {/* Bookmarked */}
        <Card 
          onClick={() => onOpenExplorer({ is_bookmarked: true })}
          className="p-4 bg-gradient-to-br from-white to-sky-50/50 dark:from-card dark:to-sky-950/20 hover:from-white hover:to-sky-100/60 dark:hover:from-card dark:hover:to-sky-900/30 border-slate-200 dark:border-border hover:border-sky-500/50 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer group shadow-2xs relative overflow-hidden rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              Đã gắn sao (Bookmark)
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-110 transition-transform">
              <Bookmark className="size-4" fill="currentColor" />
            </div>
          </div>
          <div className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-sky-600 dark:text-sky-400">
            {displayStats.bookmarked}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-muted-foreground flex items-center justify-between">
            <span>Câu hỏi lưu lại</span>
            <span className="text-sky-600 dark:text-sky-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Mở danh sách ★ <ArrowRight className="size-3" />
            </span>
          </div>
        </Card>
      </div>

      {/* Unfinished Session Alert Banner */}
      {unfinishedSessions.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl mt-0.5 shadow-2xs ${
              unfinishedSessions[0].mode === 'flashcard' 
                ? 'bg-amber-500/20 text-amber-500' 
                : unfinishedSessions[0].mode === 'exam'
                ? 'bg-rose-500/20 text-rose-500'
                : 'bg-primary/20 text-primary'
            }`}>
              <RotateCcw className="size-4 animate-spin-reverse" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                {unfinishedSessions[0].mode === 'flashcard'
                  ? 'Tiếp tục phiên lật thẻ Flashcard dở dang'
                  : unfinishedSessions[0].mode === 'exam'
                  ? 'Tiếp tục bài thi thử dở dang'
                  : 'Tiếp tục phiên học tập dở dang'}
                <Badge 
                  variant={
                    unfinishedSessions[0].mode === 'exam' 
                      ? 'warning' 
                      : unfinishedSessions[0].mode === 'flashcard'
                      ? 'secondary'
                      : 'info'
                  } 
                  className={`text-[10px] uppercase font-mono px-2 py-0.2 ${
                    unfinishedSessions[0].mode === 'flashcard'
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                      : ''
                  }`}
                >
                  {unfinishedSessions[0].mode === 'exam' 
                    ? 'Thi thử' 
                    : unfinishedSessions[0].mode === 'flashcard' 
                    ? 'Flashcard' 
                    : 'Học tập'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Bộ đề: <span className="font-semibold text-foreground">{unfinishedSessions[0].deck_title}</span> • 
                Đang ở {unfinishedSessions[0].mode === 'flashcard' ? 'thẻ' : 'câu'}{' '}
                <span className="font-bold text-primary">{unfinishedSessions[0].current_index + 1}</span> / {unfinishedSessions[0].total_questions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteSession(unfinishedSessions[0].id)}
              className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 gap-1.5 h-8.5 rounded-lg cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Hủy phiên
            </Button>
            <Button
              variant={
                unfinishedSessions[0].mode === 'exam' 
                  ? 'exam' 
                  : unfinishedSessions[0].mode === 'flashcard' 
                  ? 'default' 
                  : 'study'
              }
              size="sm"
              onClick={() => onResumeSession(unfinishedSessions[0])}
              className={`text-xs gap-1.5 font-bold h-8.5 px-4 rounded-lg shadow-xs cursor-pointer ${
                unfinishedSessions[0].mode === 'flashcard'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500'
                  : ''
              }`}
            >
              <span>{unfinishedSessions[0].mode === 'flashcard' ? 'Lật thẻ tiếp' : 'Tiếp tục học ngay'}</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Section Header: Flagship Features */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-foreground">
              Chế độ luyện tập & thi thử
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
            Tùy biến bài thi theo thời gian hoặc ôn nhanh bằng thẻ Flashcard
          </span>
        </div>

        {/* "Nhân vật chính": 2 Flagship Action Cards with Distinct Gradients & High Contrast */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Custom Exam Builder Action Card (Indigo / Royal Accent) */}
          <div
            onClick={() => setCustomExamOpen(true)}
            className="rounded-3xl border-2 border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-950/40 dark:via-card dark:to-purple-950/30 p-6 sm:p-7 hover:border-indigo-500 dark:hover:border-indigo-400 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer group shadow-sm relative overflow-hidden flex flex-col justify-between space-y-5"
          >
            {/* Ambient Radial Glow */}
            <div className="absolute -top-12 -right-12 size-36 rounded-full bg-indigo-400/20 blur-2xl group-hover:bg-indigo-400/35 transition-all pointer-events-none" />

            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-mono text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-indigo-500/30">
                  <SlidersHorizontal className="size-3.5" /> Tạo đề thi
                </span>
                <Badge variant="outline" className="text-[11px] font-mono font-bold border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-indigo-950/50">
                  15 – 60 câu
                </Badge>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                  Tạo đề thi tùy chỉnh
                  <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-500" />
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 dark:text-muted-foreground leading-relaxed mt-1.5">
                  Cấu hình bài thi hoặc bài học theo số lượng câu hỏi (15 / 30 / 60 câu), phạm vi kiến thức (tất cả, câu chưa học, câu yếu Hộp 1–2) và thời gian làm bài.
                </p>
              </div>

              {/* High-contrast Feature Chips */}
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs">
                  ⏱️ 15 - 60 phút
                </span>
                <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs">
                  🎯 Lọc câu Hộp 1–2
                </span>
                <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs">
                  🎲 Trộn ngẫu nhiên
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-indigo-200/80 dark:border-indigo-900/60 text-xs relative z-10">
              <span className="text-slate-600 dark:text-muted-foreground text-[11.5px] font-medium flex items-center gap-1.5">
                <Check className="size-3.5 text-indigo-600 dark:text-indigo-400" /> Lựa chọn theo từng đề hoặc toàn ngân hàng
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-all">
                Tạo đề thi <ArrowRight className="size-3.5" />
              </span>
            </div>
          </div>

          {/* Flashcard Mode Action Card (Amber / Flame Accent) */}
          <div
            onClick={() => setFlashcardModalOpen(true)}
            className="rounded-3xl border-2 border-amber-200 dark:border-amber-800/80 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 dark:from-amber-950/40 dark:via-card dark:to-orange-950/30 p-6 sm:p-7 hover:border-amber-500 dark:hover:border-amber-400 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer group shadow-sm relative overflow-hidden flex flex-col justify-between space-y-5"
          >
            {/* Ambient Radial Glow */}
            <div className="absolute -top-12 -right-12 size-36 rounded-full bg-amber-400/20 blur-2xl group-hover:bg-amber-400/35 transition-all pointer-events-none" />

            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-mono text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-amber-500/30">
                  <Layers className="size-3.5" /> Flashcard
                </span>
                <Badge variant="outline" className="text-[11px] font-mono font-bold border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-white/80 dark:bg-amber-950/50">
                  Phím tắt Space, 1, 2
                </Badge>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-2">
                  Lật thẻ Flashcard
                  <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-500" />
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-600 dark:text-muted-foreground leading-relaxed mt-1.5">
                  Ôn tập nhanh câu hỏi và đối chiếu đáp án bằng phím Space. Đánh giá Đã thuộc hoặc Chưa nhớ để tự động cập nhật tiến độ vào Hộp Leitner.
                </p>
              </div>

              {/* High-contrast Feature Chips */}
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
                  ⚡ Ôn nhanh câu hỏi
                </span>
                <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
                  ⌨️ Thao tác bàn phím
                </span>
                <span className="px-3 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
                  📈 Cập nhật Hộp nhớ
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-amber-200/80 dark:border-amber-900/60 text-xs relative z-10">
              <span className="text-slate-600 dark:text-muted-foreground text-[11.5px] font-medium flex items-center gap-1.5">
                <Check className="size-3.5 text-amber-600 dark:text-amber-400" /> Hiển thị 4 đáp án và bản dịch song ngữ
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-amber-500/25 group-hover:scale-105 transition-all">
                Lật thẻ ngay <ArrowRight className="size-3.5" />
              </span>
            </div>
          </div>
        </div>

        {/* Master Question Bank Card - Shown for All Topics or Fast Track */}
        {allDeck && (selectedTopicId === 'all' || selectedTopicId === 'fast_track') && (
          <Card 
            onClick={() => setSelectedDeck(allDeck)}
            className="border-2 border-blue-200 dark:border-blue-800/80 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 dark:from-blue-950/30 dark:via-card dark:to-indigo-950/20 hover:border-blue-500 dark:hover:border-blue-400 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer group rounded-3xl shadow-sm overflow-hidden relative"
          >
            <div className="p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-mono text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-blue-500/30">
                    <Layers className="size-3.5" /> Tất cả câu hỏi
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-muted-foreground">• {allDeck.total_questions} câu không trùng lặp</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                  {allDeck.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-muted-foreground max-w-2xl leading-relaxed">
                  Tập hợp 369 câu hỏi duy nhất từ toàn bộ các đề Mock Exam và Đề thực chiến. Hỗ trợ tra cứu nhanh FTS4 và phương pháp lặp lại ngắt quãng Leitner.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Check className="size-3.5" /> FTS4 Search
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-blue-200 dark:border-blue-800">
                    Song ngữ Anh - Việt
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-blue-200 dark:border-blue-800">
                    Hộp nhớ Leitner 1–5
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button className="h-11 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-md shadow-blue-500/25 group-hover:scale-105 transition-all flex items-center gap-2 cursor-pointer">
                  <span>Luyện tập tất cả câu hỏi</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Control Bar: View Toggle, Search & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-foreground">Bộ đề thi & Luyện tập</span>
          <Badge variant="secondary" className="font-mono text-[10px] bg-muted/80">{filteredAndSortedDecks.length} bộ đề</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Filter Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Lọc theo tên đề..."
              className="pl-8 h-8 text-xs w-36 sm:w-48 bg-card border-border/80 focus-visible:ring-1 focus-visible:ring-primary rounded-lg"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-8 rounded-lg border border-border/80 bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="default">Sắp xếp: Mặc định</option>
              <option value="in_progress">Đang học dở lên đầu</option>
              <option value="progress_desc">Tiến độ thuộc cao nhất</option>
              <option value="title_asc">Tên bộ đề (A → Z)</option>
            </select>
          </div>

          {/* View Mode Toggle: Grid ⊞ vs List ☰ */}
          <div className="flex items-center rounded-lg border border-border/80 bg-card p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              title="Xem dạng thẻ lưới (Grid)"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Xem dạng danh sách ngang (List)"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List View Container */}
      {viewMode === 'grid' ? (
        <div className="space-y-7">
          {/* Mock Tests Section */}
          {mockDecks.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500 inline-block" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Mock Tests (Tiếng Anh & Song Ngữ)
                </h2>
                <span className="text-[11px] text-muted-foreground/60 font-mono">({mockDecks.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {mockDecks.map((deck) => (
                  <CleanDeckCard
                    key={deck.id}
                    deck={deck}
                    type="mock"
                    activeSession={unfinishedSessions.find((s) => s.deck_id === deck.id)}
                    onClick={() => setSelectedDeck(deck)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Đề Thi Thực Chiến Section */}
          {deDecks.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Đề Thi Thực Chiến (Bộ Đề 1 - 7)
                </h2>
                <span className="text-[11px] text-muted-foreground/60 font-mono">({deDecks.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {deDecks.map((deck) => (
                  <CleanDeckCard
                    key={deck.id}
                    deck={deck}
                    type="de"
                    activeSession={unfinishedSessions.find((s) => s.deck_id === deck.id)}
                    onClick={() => setSelectedDeck(deck)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Topic Decks (Japanese, English, Custom) */}
          {otherTopicDecks.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-indigo-500 inline-block" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isAll ? 'Bộ đề Ngoại ngữ & Chuyên đề khác' : `Danh sách bộ đề ${activeTopicConfig.name}`}
                </h2>
                <span className="text-[11px] text-muted-foreground/60 font-mono">({otherTopicDecks.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {otherTopicDecks.map((deck) => (
                  <CleanDeckCard
                    key={deck.id}
                    deck={deck}
                    type="topic"
                    badgeLabel={getTopicConfig(resolveDeckTopic(deck)).name}
                    activeSession={unfinishedSessions.find((s) => s.deck_id === deck.id)}
                    onClick={() => setSelectedDeck(deck)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredAndSortedDecks.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border/80 rounded-3xl p-8 space-y-3 bg-muted/20">
              <div className="size-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground text-2xl">
                {activeTopicConfig.icon}
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Chưa có bộ đề nào trong chuyên mục này
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bạn có thể bấm &quot;Nạp đề JSON&quot; để thêm đề trắc nghiệm hoặc flashcard mới vào chuyên mục này ngay lập tức.
              </p>
              <Button
                size="sm"
                onClick={() => setDeckImporterOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="size-3.5" /> Nạp đề ngay
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* List View (Ultra-compact rows) */
        filteredAndSortedDecks.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
            {filteredAndSortedDecks.map((deck) => (
              <DeckListRow
                key={deck.id}
                deck={deck}
                activeSession={unfinishedSessions.find((s) => s.deck_id === deck.id)}
                onClick={() => setSelectedDeck(deck)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-border/80 rounded-3xl p-8 space-y-3 bg-muted/20">
            <div className="size-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground text-2xl">
              {activeTopicConfig.icon}
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Không tìm thấy bộ đề phù hợp
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Không có bộ đề nào khớp với từ khóa tìm kiếm trong chuyên mục này.
            </p>
          </div>
        )
      )}

      {/* Deck Action Dialog: Opened when clicking any card/row */}
      <Dialog open={Boolean(selectedDeck)} onOpenChange={(open) => !open && setSelectedDeck(null)}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl p-6 sm:p-7 rounded-3xl bg-card border-border/80 shadow-2xl">
          {selectedDeck && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
                    {selectedDeck.total_questions} CÂU HỎI
                  </Badge>
                  {activeSessionForSelected && (
                    <Badge variant="warning" className="text-[10px] font-semibold gap-1">
                      <span className="size-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                      ĐANG LÀM DỞ
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-extrabold text-foreground pt-1.5">
                  {selectedDeck.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {selectedDeck.source || 'Bộ đề luyện thi chứng chỉ tiêu chuẩn song ngữ'}
                </DialogDescription>
              </DialogHeader>

              {/* Progress Summary in Modal */}
              <div className="rounded-xl bg-secondary/30 p-4 space-y-2.5 border border-border/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Award className="size-4 text-emerald-500" />
                    Tiến độ ghi nhớ (Spaced Repetition)
                  </span>
                  <span className="font-bold text-primary text-sm">
                    {selectedDeck.total_questions > 0
                      ? Math.round(((selectedDeck.mastered_count || 0) / selectedDeck.total_questions) * 100)
                      : 0}%
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${
                        selectedDeck.total_questions > 0
                          ? ((selectedDeck.mastered_count || 0) / selectedDeck.total_questions) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{
                      width: `${
                        selectedDeck.total_questions > 0
                          ? ((selectedDeck.learning_count || 0) / selectedDeck.total_questions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                    Đã thuộc: <strong className="text-foreground">{selectedDeck.mastered_count || 0}</strong> câu
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500 inline-block" />
                    Đang ôn: <strong className="text-foreground">{selectedDeck.learning_count || 0}</strong> câu
                  </span>
                  <span>
                    Chưa học: <strong className="text-foreground">{Math.max(0, selectedDeck.total_questions - (selectedDeck.mastered_count || 0) - (selectedDeck.learning_count || 0))}</strong>
                  </span>
                </div>

                {((selectedDeck.mastered_count || 0) > 0 || (selectedDeck.learning_count || 0) > 0) && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        await onResetDeckProgress(selectedDeck.id);
                        setSelectedDeck(null);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-destructive font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                      title="Đặt lại toàn bộ tiến độ của bộ đề này về 0"
                    >
                      <Trash2 className="size-3" />
                      Đặt lại tiến độ bộ đề này về 0
                    </button>
                  </div>
                )}
              </div>

              {/* If an active session exists -> Show Resume, Restart, or Flashcard options */}
              {activeSessionForSelected ? (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl bg-primary/10 border border-primary/25 p-3.5 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-primary flex items-center gap-2">
                        <RotateCcw className="size-4" />
                        Tiến trình dở dang: Câu {activeSessionForSelected.current_index + 1} / {activeSessionForSelected.total_questions}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Chế độ: <strong className="text-foreground">{activeSessionForSelected.mode === 'exam' ? 'Thi thử' : 'Học tập'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Button
                      variant={activeSessionForSelected.mode === 'exam' ? 'exam' : 'study'}
                      className="w-full justify-center h-10 font-bold gap-2 shadow-xs rounded-xl cursor-pointer"
                      onClick={() => {
                        onResumeSession(activeSessionForSelected);
                        setSelectedDeck(null);
                      }}
                    >
                      <RotateCcw className="size-4" />
                      Tiếp tục (Câu {activeSessionForSelected.current_index + 1})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-center h-10 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                      onClick={async () => {
                        await onResetDeckProgress(selectedDeck.id);
                        if (activeSessionForSelected.mode === 'flashcard') {
                          const qs = await dbService.getDeckQuestions(selectedDeck.id);
                          onStartFlashcard(qs, `${selectedDeck.title} (Flashcard)`);
                        } else {
                          onRestartSession(selectedDeck, activeSessionForSelected.mode);
                        }
                        setSelectedDeck(null);
                      }}
                    >
                      Bắt đầu lại từ đầu
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full justify-center h-9.5 gap-2 text-xs font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl cursor-pointer"
                    onClick={async () => {
                      const qs = await dbService.getDeckQuestions(selectedDeck.id);
                      onStartFlashcard(qs, `${selectedDeck.title} (Flashcard)`);
                      setSelectedDeck(null);
                    }}
                  >
                    <Zap className="size-3.5 fill-current" />
                    Lật thẻ Flashcard bộ đề này (Không ảnh hưởng tiến trình)
                  </Button>
                </div>
              ) : (
                /* No active session -> Choose Study, Exam, or Flashcard Mode */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                  {/* Study Mode Card */}
                  <div 
                    onClick={() => {
                      onStartSession(selectedDeck, 'study');
                      setSelectedDeck(null);
                    }}
                    className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-950/15 p-4.5 hover:border-emerald-500/70 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="size-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold shadow-2xs">
                        <BookOpen className="size-4.5" />
                      </div>
                      <h4 className="text-sm font-extrabold text-foreground group-hover:text-emerald-400 transition-colors">
                        Chế độ Học tập
                      </h4>
                      <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed pt-1">
                        <div className="flex items-center gap-1.5 text-emerald-500/90 font-medium">
                          <Check className="size-3" /> Chấm điểm tức thì 1-click
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="size-3" /> Giải thích song ngữ chi tiết
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="size-3" /> Thuật toán Leitner Hộp 1–5
                        </div>
                      </div>
                    </div>
                    <Button variant="study" size="sm" className="w-full pointer-events-none text-xs font-bold rounded-xl h-8.5">
                      Bắt đầu Học tập
                    </Button>
                  </div>

                  {/* Exam Mode Card */}
                  <div 
                    onClick={() => {
                      onStartSession(selectedDeck, 'exam');
                      setSelectedDeck(null);
                    }}
                    className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-card via-card to-indigo-950/15 p-4.5 hover:border-indigo-500/70 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="size-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold shadow-2xs">
                        <GraduationCap className="size-4.5" />
                      </div>
                      <h4 className="text-sm font-extrabold text-foreground group-hover:text-indigo-400 transition-colors">
                        Chế độ Thi thử
                      </h4>
                      <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed pt-1">
                        <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                          <Check className="size-3" /> Đồng hồ bấm giờ 60 phút
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="size-3" /> Đánh dấu cờ (Flag) câu phân vân
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="size-3" /> Tổng kết Đạt/Trượt & xếp loại
                        </div>
                      </div>
                    </div>
                    <Button variant="exam" size="sm" className="w-full pointer-events-none text-xs font-bold rounded-xl h-8.5">
                      Bắt đầu Thi thử
                    </Button>
                  </div>

                  {/* Flashcard Mode Card */}
                  <div 
                    onClick={async () => {
                      const qs = await dbService.getDeckQuestions(selectedDeck.id);
                      if (qs.length === 0) {
                        toast.warning(`Bộ đề "${selectedDeck.title}" hiện chưa có câu hỏi nào để ôn tập flashcard.`);
                        return;
                      }
                      onStartFlashcard(qs, `${selectedDeck.title} (Flashcard)`);
                      setSelectedDeck(null);
                    }}
                    className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-950/15 p-4.5 hover:border-amber-500/70 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="size-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold shadow-2xs">
                        <Zap className="size-4.5 fill-current" />
                      </div>
                      <h4 className="text-sm font-extrabold text-foreground group-hover:text-amber-400 transition-colors">
                        Lật thẻ Flashcard
                      </h4>
                      <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed pt-1">
                        <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                          <Check className="size-3" /> Lướt thẻ 3D siêu tốc
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="size-3" /> Phím Space xem đáp án chuẩn
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="size-3" /> Phím 1 (Chưa nhớ) / 2 (Đã thuộc)
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full pointer-events-none text-xs font-bold rounded-xl h-8.5 border-amber-500/40 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      Ôn tập Flashcard
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="sm:justify-between items-center pt-3 border-t border-border/40 mt-1">
                {/* Allow deleting custom imported decks */}
                {!['mock_1', 'mock_2', 'mock_3', 'de_1', 'de_2', 'de_3', 'de_4', 'de_5', 'de_6', 'de_7', '_all', 'all'].includes(selectedDeck.id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (window.confirm(`Bạn có chắc chắn muốn xóa bộ đề "${selectedDeck.title}" khỏi thư viện?`)) {
                        await dbService.deleteDeck(selectedDeck.id);
                        setSelectedDeck(null);
                        if (onReloadData) await onReloadData();
                        toast.success('Đã xóa bộ đề thành công.');
                      }
                    }}
                    className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 rounded-xl cursor-pointer gap-1.5 h-9"
                  >
                    <Trash2 className="size-3.5" />
                    Xóa bộ đề này
                  </Button>
                ) : (
                  <div />
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDeck(null)}
                  className="text-xs h-9 px-5 rounded-xl border-border/80 hover:bg-muted/80 text-foreground font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  Đóng hộp thoại
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Exam Builder Modal */}
      <CustomExamModal
        open={customExamOpen}
        onOpenChange={setCustomExamOpen}
        decks={topicDecks.length > 0 ? topicDecks : decks}
        onStartCustomSession={onStartCustomSession}
      />

      {/* Flashcard Quick Launcher Dialog */}
      <Dialog open={flashcardModalOpen} onOpenChange={setFlashcardModalOpen}>
        <DialogContent className="sm:max-w-xl p-6 sm:p-7 rounded-2xl bg-card border-border shadow-2xl">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Layers className="size-4" />
              Lật thẻ Flashcard
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
              Chọn phạm vi câu hỏi
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chọn phạm vi câu hỏi bạn muốn ôn tập bằng phím Space, 1 và 2:
            </DialogDescription>
          </DialogHeader>

          {flashcardLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <span className="text-xs text-muted-foreground">Đang chuẩn bị danh sách thẻ...</span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* All */}
                <button
                  type="button"
                  onClick={() => handleLaunchQuickFlashcard('all', 'Toàn bộ ngân hàng (Flashcard)')}
                  className="p-3.5 rounded-2xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 text-left transition-all cursor-pointer active:scale-[0.98] group flex flex-col justify-between space-y-2"
                >
                  <div>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors block">
                      🎲 Toàn bộ ngân hàng
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      {displayStats.totalQuestions} thẻ ngẫu nhiên
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9.5px] font-mono self-start border-primary/30 text-primary">
                    Bắt đầu →
                  </Badge>
                </button>

                {/* Box 1-2 Weakness */}
                <button
                  type="button"
                  onClick={() => handleLaunchQuickFlashcard('learning_box12', 'Câu yếu Hộp 1–2 (Flashcard)')}
                  className="p-3.5 rounded-2xl border border-amber-500/30 hover:border-amber-500/70 hover:bg-amber-500/5 text-left transition-all cursor-pointer active:scale-[0.98] group flex flex-col justify-between space-y-2"
                >
                  <div>
                    <span className="text-xs font-bold text-foreground group-hover:text-amber-400 transition-colors block">
                      ⚠️ Câu yếu (Hộp 1–2)
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      Câu mới hoặc hay sai
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9.5px] font-mono self-start border-amber-500/30 text-amber-400">
                    Khuyên dùng
                  </Badge>
                </button>

                {/* Bookmarked */}
                <button
                  type="button"
                  onClick={() => handleLaunchQuickFlashcard('bookmarked', 'Câu Bookmark (Flashcard)')}
                  className="p-3.5 rounded-2xl border border-sky-500/30 hover:border-sky-500/70 hover:bg-sky-500/5 text-left transition-all cursor-pointer active:scale-[0.98] group flex flex-col justify-between space-y-2"
                >
                  <div>
                    <span className="text-xs font-bold text-foreground group-hover:text-sky-400 transition-colors block">
                      ⭐ Câu đã Bookmark
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      {displayStats.bookmarked} câu đã lưu
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9.5px] font-mono self-start border-sky-500/30 text-sky-400">
                    Trọng tâm
                  </Badge>
                </button>
              </div>

              {/* Or select specific deck */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <span className="text-xs font-bold text-foreground block">
                  Hoặc chọn nhanh 1 bộ đề cụ thể:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {topicDecks.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={async () => {
                        const qs = await dbService.getDeckQuestions(d.id);
                        if (qs.length === 0) {
                          toast.warning(`Bộ đề "${d.title}" hiện chưa có câu hỏi nào để ôn tập flashcard.`);
                          return;
                        }
                        setFlashcardModalOpen(false);
                        onStartFlashcard(qs, `${d.title} (Flashcard)`);
                      }}
                      className="p-2 rounded-xl border border-border/60 hover:border-amber-500/50 hover:bg-amber-500/5 text-left text-xs transition-colors cursor-pointer active:scale-95 truncate"
                    >
                      <span className="font-semibold text-foreground truncate block">{d.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{d.total_questions} thẻ</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-end pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlashcardModalOpen(false)}
              className="text-xs h-9 px-4 rounded-xl border-border/80 text-foreground font-semibold cursor-pointer active:scale-95"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON Deck Importer Modal */}
      <DeckImporterModal
        open={deckImporterOpen}
        onOpenChange={setDeckImporterOpen}
        availableTopics={availableTopics}
        onImportComplete={async () => {
          if (onReloadData) {
            await onReloadData();
          }
          if (selectedTopicId !== 'all') {
            const res = await dbService.getOverallStats(selectedTopicId);
            setTopicStats(res);
          }
        }}
      />

      {/* Busy Mode Settings & Launcher Modal (fallback if not handled by root App) */}
      {!onOpenBusyModal && (
        <BusyModeModal
          open={busyModalOpen}
          onOpenChange={setBusyModalOpen}
          availableTopics={availableTopics}
        />
      )}
    </div>
  );
};

/* Clean, Substantial & Full-Bodied Deck Card for Grid View */
interface CleanDeckCardProps {
  deck: Deck;
  type?: 'mock' | 'de' | 'topic';
  badgeLabel?: string;
  activeSession?: ActiveSession;
  onClick: () => void;
}

const CleanDeckCard: React.FC<CleanDeckCardProps> = ({ deck, type = 'topic', badgeLabel, activeSession, onClick }) => {
  const mastered = deck.mastered_count || 0;
  const learning = deck.learning_count || 0;
  const total = deck.total_questions || 60;
  const percentMastered = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const unattempted = Math.max(0, total - mastered - learning);

  const isMock = type === 'mock';
  const isDe = type === 'de';
  const displayBadge = badgeLabel || (isMock ? 'MOCK EXAM' : isDe ? 'THỰC CHIẾN' : 'CHUYÊN ĐỀ');
  const badgeColor = isMock 
    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25' 
    : isDe 
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
    : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25';
  const dotColor = isMock ? 'bg-blue-600 dark:bg-blue-400' : isDe ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-indigo-600 dark:bg-indigo-400';

  return (
    <Card 
      onClick={onClick}
      className="p-6 sm:p-7 border border-border hover:border-primary/50 bg-card hover:bg-card/90 transition-all duration-200 cursor-pointer group shadow-2xs rounded-2xl flex flex-col justify-between min-h-[220px] relative overflow-hidden"
    >
      <div>
        {/* Header badges row */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          <span className={`text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 shadow-2xs ${badgeColor}`}>
            <span className={`size-1.5 rounded-full ${dotColor}`} />
            {displayBadge}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeSession ? (
              <Badge variant="warning" className="text-[10px] font-mono px-2 py-0.5 gap-1.5 font-bold shadow-xs">
                <span className="size-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                Đang làm: {activeSession.current_index + 1}/{total}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10.5px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 border-border">
                {total} câu hỏi
              </Badge>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="mt-3.5 space-y-1 relative z-10">
          <CardTitle className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
            {deck.title}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground line-clamp-1">
            {deck.source || 'Bộ đề luyện thi chứng chỉ tiêu chuẩn'}
          </CardDescription>
        </div>

        {/* 3-Pill Quick Micro-Stats Indicator */}
        <div className="grid grid-cols-3 gap-2 py-3 border-y border-border my-4 text-center relative z-10">
          <div className="bg-secondary/60 rounded-xl p-2 border border-border">
            <div className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{mastered}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-semibold">Đã thuộc</div>
          </div>
          <div className="bg-secondary/60 rounded-xl p-2 border border-border">
            <div className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono">{learning}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-semibold">Đang học</div>
          </div>
          <div className="bg-secondary/60 rounded-xl p-2 border border-border">
            <div className="text-xs sm:text-sm font-extrabold text-foreground font-mono">{unattempted}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-semibold">Chưa học</div>
          </div>
        </div>
      </div>

      {/* Progress & Bottom Actions */}
      <div className="space-y-3 relative z-10">
        {/* Leitner Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tiến độ ghi nhớ: <strong className="text-foreground font-mono">{percentMastered}%</strong></span>
            <span className="font-mono text-[11px]">{mastered}/{total} câu</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden flex shadow-inner">
            {mastered > 0 && (
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                style={{ width: `${percentMastered}%` }}
                title={`Đã thuộc: ${mastered}`}
              />
            )}
            {learning > 0 && (
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300"
                style={{ width: `${total > 0 ? (learning / total) * 100 : 0}%` }}
                title={`Đang học: ${learning}`}
              />
            )}
          </div>
        </div>

        {/* Action Prompt */}
        <div className="flex items-center justify-between text-xs text-muted-foreground/80 group-hover:text-primary pt-2.5 transition-colors border-t border-border/40">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <Zap className="size-3.5 text-amber-400" /> Bấm để mở tùy chọn
          </span>
          <div className="flex items-center gap-1 font-bold text-xs text-primary opacity-90 group-hover:opacity-100 transition-all group-hover:translate-x-1">
            <span>Vào học / thi</span>
            <ArrowRight className="size-3.5" />
          </div>
        </div>
      </div>
    </Card>
  );
};

/* Compact List Row */
interface DeckListRowProps {
  deck: Deck;
  activeSession?: ActiveSession;
  onClick: () => void;
}

const DeckListRow: React.FC<DeckListRowProps> = ({ deck, activeSession, onClick }) => {
  const mastered = deck.mastered_count || 0;
  const learning = deck.learning_count || 0;
  const total = deck.total_questions || 60;
  const percentMastered = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const percentLearning = total > 0 ? Math.round((learning / total) * 100) : 0;
  const hasProgress = mastered > 0 || learning > 0;

  return (
    <div
      onClick={onClick}
      className="p-3.5 sm:px-5 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      {/* Left: Title & Source */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="size-9 rounded-xl bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
              {deck.title}
            </span>
            {activeSession && (
              <Badge variant="warning" className="text-[9px] font-mono shrink-0 px-1.5 py-0">
                Dở: Câu {activeSession.current_index + 1}/{total}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {deck.source || 'Standard Test Deck'}
          </div>
        </div>
      </div>

      {/* Right: Progress bar & Action */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:flex flex-col items-end gap-1 w-36">
          <div className="text-[10px] font-mono font-medium text-muted-foreground">
            {!hasProgress ? (
              <span>0% (0/{total} câu)</span>
            ) : mastered > 0 && learning === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{percentMastered}% ({mastered}/{total} câu)</span>
            ) : learning > 0 && mastered === 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">{learning}/{total} câu đang học</span>
            ) : (
              <span>
                <strong className="text-emerald-600 dark:text-emerald-400">{percentMastered}%</strong> thuộc · <strong className="text-amber-600 dark:text-amber-400">{learning}</strong> ôn
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden flex">
            {mastered > 0 && (
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${percentMastered}%` }}
              />
            )}
            {learning > 0 && (
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${percentLearning}%` }}
              />
            )}
          </div>
        </div>

        <Badge variant="outline" className="font-mono text-[10px] hidden md:inline-flex">
          {total} Qs
        </Badge>

        <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
};
