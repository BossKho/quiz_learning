import { useState, useEffect, useCallback } from 'react';
import { dbService } from '@/services/db';
import { createNewSession } from '@/services/session-engine';
import type { Deck, Question, ActiveSession, ExamResultSummary } from '@/types/quiz';
import { Header } from '@/components/Header';
import { CommandPalette } from '@/components/CommandPalette';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { Dashboard } from '@/views/Dashboard';
import { StudyArena } from '@/views/StudyArena';
import { ExamArena } from '@/views/ExamArena';
import { ExamReview } from '@/views/ExamReview';
import { DeckExplorer } from '@/views/DeckExplorer';
import { Loader2 } from 'lucide-react';

export function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'study' | 'exam' | 'review' | 'explorer'>('dashboard');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [unfinishedSessions, setUnfinishedSessions] = useState<ActiveSession[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalQuestions: 0,
    mastered: 0,
    learning: 0,
    bookmarked: 0,
    completedSessions: 0,
  });

  // Active Session state
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [examResult, setExamResult] = useState<ExamResultSummary | null>(null);

  // Modals & UI states
  const [isZenMode, setIsZenMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Load data from SQLite
  const reloadData = useCallback(async () => {
    try {
      const [allDecks, unfinished, stats] = await Promise.all([
        dbService.getDecks(),
        dbService.getUnfinishedSessions(),
        dbService.getOverallStats(),
      ]);
      setDecks(allDecks);
      setUnfinishedSessions(unfinished);
      setOverallStats(stats);
    } catch (err) {
      console.error('Failed to reload data:', err);
    }
  }, []);

  const [initError, setInitError] = useState<string | null>(null);

  // Initialize DB on boot
  useEffect(() => {
    async function setup() {
      try {
        setInitError(null);
        await dbService.init();
        await reloadData();
        setIsDbReady(true);
      } catch (err: any) {
        console.error('Database initialization failed:', err);
        setInitError(err?.message || String(err));
      }
    }
    setup();
  }, [reloadData]);

  // Global hotkeys (Ctrl+K, Zen Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl + Shift + F -> Zen Mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
      }
      // ? -> Shortcuts guide
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Session Handlers
  const handleStartSession = async (deck: Deck, mode: 'study' | 'exam') => {
    const qs = await dbService.getDeckQuestions(deck.id);
    if (qs.length === 0) {
      alert('This deck contains no questions.');
      return;
    }

    const session = await createNewSession(
      deck.id,
      deck.title,
      mode,
      qs,
      mode === 'study',
      3600 // 60 minutes
    );

    setSessionQuestions(qs);
    setActiveSession(session);
    setCurrentView(mode);
  };

  const handleResumeSession = async (session: ActiveSession) => {
    const qs = await dbService.getDeckQuestions(session.deck_id);
    setSessionQuestions(qs);
    setActiveSession(session);
    setCurrentView(session.mode);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await dbService.deleteSession(sessionId);
    await reloadData();
  };

  const handleFinishExam = (result: ExamResultSummary) => {
    setExamResult(result);
    setCurrentView('review');
    reloadData();
  };

  const handleExitToDashboard = () => {
    setActiveSession(null);
    setSessionQuestions([]);
    setCurrentView('dashboard');
    reloadData();
  };

  if (!isDbReady) {
    if (initError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background text-foreground p-6 text-center">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <Loader2 className="size-6 animate-pulse" />
          </div>
          <div className="text-base font-semibold text-destructive">Database Initialization Failed</div>
          <p className="max-w-md text-xs text-muted-foreground font-mono bg-muted/50 p-3 rounded-lg border border-border">
            {initError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry Launch
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <div className="text-sm font-medium">Initializing SQLite Question Bank...</div>
        <div className="text-xs text-muted-foreground">Ingesting bilingual decks & FTS index</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 ${isZenMode ? 'p-2' : ''}`}>
      {/* Top Header - hidden in Zen Mode */}
      {!isZenMode && (
        <Header
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'dashboard') handleExitToDashboard();
            else setCurrentView(view as any);
          }}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          isZenMode={isZenMode}
          onToggleZenMode={() => setIsZenMode(!isZenMode)}
        />
      )}

      {/* Main Content Area */}
      <main className="w-full">
        {currentView === 'dashboard' && (
          <Dashboard
            decks={decks}
            unfinishedSessions={unfinishedSessions}
            stats={overallStats}
            onStartSession={handleStartSession}
            onResumeSession={handleResumeSession}
            onDeleteSession={handleDeleteSession}
            onOpenExplorer={() => setCurrentView('explorer')}
          />
        )}

        {currentView === 'study' && activeSession && (
          <StudyArena
            session={activeSession}
            questions={sessionQuestions}
            onExit={handleExitToDashboard}
            onUpdateSession={(updated) => setActiveSession(updated)}
          />
        )}

        {currentView === 'exam' && activeSession && (
          <ExamArena
            session={activeSession}
            questions={sessionQuestions}
            onFinishExam={handleFinishExam}
            onExit={handleExitToDashboard}
            onUpdateSession={(updated) => setActiveSession(updated)}
          />
        )}

        {currentView === 'review' && examResult && (
          <ExamReview
            result={examResult}
            onRetakeExam={() => {
              const deck = decks.find((d) => d.title === examResult.deck_title);
              if (deck) handleStartSession(deck, 'exam');
              else handleExitToDashboard();
            }}
            onReturnDashboard={handleExitToDashboard}
          />
        )}

        {currentView === 'explorer' && (
          <DeckExplorer
            decks={decks}
            onBackToDashboard={handleExitToDashboard}
          />
        )}
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        decks={decks}
        onSelectDeck={handleStartSession}
        onNavigate={(view) => {
          if (view === 'dashboard') handleExitToDashboard();
          else setCurrentView(view as any);
        }}
        onToggleZenMode={() => setIsZenMode(!isZenMode)}
        onOpenShortcutsHelp={() => setShortcutsModalOpen(true)}
      />

      {/* Shortcuts Guide Modal */}
      <ShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
      />
    </div>
  );
}

export default App;
