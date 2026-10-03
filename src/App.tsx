import { useState, useEffect, useCallback } from 'react';
import { dbService } from '@/services/db';
import { createNewSession } from '@/services/session-engine';
import type { Deck, Question, ActiveSession, ExamResultSummary, SearchFilter } from '@/types/quiz';
import { Header } from '@/components/Header';
import { CommandPalette } from '@/components/CommandPalette';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { Dashboard } from '@/views/Dashboard';
import { StudyArena } from '@/views/StudyArena';
import { ExamArena } from '@/views/ExamArena';
import { ExamReview } from '@/views/ExamReview';
import { DeckExplorer } from '@/views/DeckExplorer';
import { FlashcardArena } from '@/views/FlashcardArena';
import { SyncProgressModal } from '@/components/SyncProgressModal';
import { ToastContainer, toast } from '@/components/ui/toast';
import { BusyPopupWindow } from '@/views/BusyPopupWindow';
import { BusyPopup } from '@/components/BusyPopup';
import { BusyModeModal } from '@/components/BusyModeModal';
import { busyModeService, type BusyModeState } from '@/services/busyModeService';
import { isTauri } from '@tauri-apps/api/core';
import { getAvailableTopics } from '@/config/topics';
import { Loader2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { subscribeToAuthState, syncLocalToCloud, pullCloudToLocal } from '@/services/firebaseService';
import { AuthModal } from '@/components/AuthModal';
import { ProfileView } from '@/views/ProfileView';
import { LandingPage } from '@/views/LandingPage';

export function App() {
  // If running inside secondary native popup window, render BusyPopupWindow directly
  const isBusyPopupWindow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('window') === 'busy_popup';
  if (isBusyPopupWindow) {
    return <BusyPopupWindow />;
  }

  const [isDbReady, setIsDbReady] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'study' | 'exam' | 'review' | 'explorer' | 'flashcard' | 'profile'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
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
  const [explorerFilter, setExplorerFilter] = useState<SearchFilter | undefined>(undefined);

  // Flashcard Mode state
  const [flashcardDeckTitle, setFlashcardDeckTitle] = useState<string>('');
  const [flashcardQuestions, setFlashcardQuestions] = useState<Question[]>([]);

  // Modals & UI states
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [busyModalOpen, setBusyModalOpen] = useState(false);
  const [busyState, setBusyState] = useState<BusyModeState>(busyModeService.getSnapshot());

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

  // Listen to Busy Mode service state & update stats if answered in popup
  useEffect(() => {
    const unsub = busyModeService.subscribe((state) => {
      setBusyState(state);
      reloadData();
    });
    return () => unsub();
  }, [reloadData]);

  // Subscribe to Firebase Auth state & cleanly isolate user progress
  useEffect(() => {
    const unsub = subscribeToAuthState(async (u) => {
      setCurrentUser(u);
      if (u) {
        // Switch user context in SQLite: load user's isolated local progress
        await dbService.switchUser(u.uid);
        // Automatically sync & merge latest cloud progress from Firestore
        try {
          await pullCloudToLocal(u.uid, 'merge');
        } catch (err) {
          console.warn('Auto cloud sync failed:', err);
        }
        await reloadData();
      } else {
        // User logged out: clear active progress from memory and SQLite
        await dbService.switchUser(null);
        setActiveSession(null);
        setUnfinishedSessions([]);
        setOverallStats({
          totalQuestions: 0,
          mastered: 0,
          learning: 0,
          bookmarked: 0,
          completedSessions: 0,
        });
        setCurrentView('dashboard');
      }
    });
    return () => unsub();
  }, [reloadData]);

  const handleQuickSync = async () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      setIsSyncingCloud(true);
      const res = await syncLocalToCloud(currentUser.uid);
      toast.success(`Đã đồng bộ ${res.questionsCount} câu hỏi lên Đám Mây thành công! ☁️`);
      await reloadData();
    } catch (err: any) {
      toast.error('Lỗi đồng bộ: ' + (err.message || String(err)));
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleStartWeakPractice = async () => {
    const weakQs = await dbService.getCustomQuestions({
      count: 20,
      scope: 'learning_box12',
      shuffle: true,
    });
    if (weakQs.length === 0) {
      toast.info('Hiện không có câu nào yếu (Hộp 1 & 2)! Bạn đang làm rất tốt.');
      return;
    }
    const session = await createNewSession(
      'weak_practice',
      'Luyện tập củng cố câu hỏi yếu (Hộp 1 & 2)',
      'study',
      weakQs,
      true,
      1800
    );
    setSessionQuestions(weakQs);
    setActiveSession(session);
    setCurrentView('study');
  };

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

  // Global hotkeys (Ctrl+K, Shortcuts ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
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
      toast.warning('Bộ đề này hiện chưa có câu hỏi nào.');
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
    let qs: Question[] = [];
    if (session.deck_id && session.deck_id !== 'flashcard_deck' && session.deck_id !== 'custom_exam') {
      qs = await dbService.getDeckQuestions(session.deck_id);
    }
    if (qs.length === 0 && session.question_ids && session.question_ids.length > 0) {
      const loaded = await Promise.all(session.question_ids.map((id) => dbService.getQuestion(id)));
      qs = loaded.filter(Boolean) as Question[];
    }

    setActiveSession(session);

    if (session.mode === 'flashcard') {
      setFlashcardQuestions(qs);
      setFlashcardDeckTitle(session.deck_title);
      setCurrentView('flashcard');
    } else {
      setSessionQuestions(qs);
      setCurrentView(session.mode);
    }
  };


  const handleRestartSession = async (deck: Deck, mode: 'study' | 'exam') => {
    await dbService.resetDeckProgress(deck.id);
    await reloadData();
    await handleStartSession(deck, mode);
  };

  const handleOpenExplorer = (filter?: SearchFilter) => {
    setExplorerFilter(filter);
    setCurrentView('explorer');
  };

  const handleDeleteSession = async (sessionId: string) => {
    await dbService.deleteSession(sessionId, true);
    await reloadData();
    toast.info('Đã hủy phiên và đặt lại tiến trình.');
  };

  const handleResetDeckProgress = async (deckId: string) => {
    await dbService.resetDeckProgress(deckId);
    await reloadData();
    toast.info('Đã đặt lại tiến độ bộ đề này về 0.');
  };

  const handleResetAllProgress = async () => {
    await dbService.resetAllProgress();
    await reloadData();
    toast.info('Đã đặt lại toàn bộ tiến độ về 0.');
  };

  const handleFinishExam = (result: ExamResultSummary) => {
    setExamResult(result);
    setCurrentView('review');
    reloadData();
  };

  const handleStartCustomSession = async (
    questions: Question[],
    mode: 'study' | 'exam',
    title: string,
    timeLimitSec: number
  ) => {
    const session = await createNewSession(
      'custom_' + Date.now(),
      title,
      mode,
      questions,
      mode === 'study',
      timeLimitSec > 0 ? timeLimitSec : (mode === 'study' ? 0 : 3600)
    );

    setSessionQuestions(questions);
    setActiveSession(session);
    setCurrentView(mode);
  };

  const handleStartFlashcard = (questions: Question[], title: string) => {
    if (questions.length === 0) {
      toast.warning('Không có câu hỏi nào để ôn tập flashcard.');
      return;
    }
    setFlashcardQuestions(questions);
    setFlashcardDeckTitle(title);
    setCurrentView('flashcard');
  };

  const handleExitToDashboard = () => {
    setActiveSession(null);
    setSessionQuestions([]);
    setFlashcardQuestions([]);
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

  // If user is not logged in, render the clean, secure Landing Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20">
        <LandingPage
          onOpenAuthModal={(mode) => {
            setAuthMode(mode);
            setAuthModalOpen(true);
          }}
        />

        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          initialMode={authMode}
          onSuccess={async () => {
            await reloadData();
          }}
        />

        <ToastContainer />
      </div>
    );
  }

  // Automatic Focus Mode: Header is auto-hidden during study, exam, or flashcard to prevent distractions
  const isFocusArena = currentView === 'study' || currentView === 'exam' || currentView === 'flashcard';

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20">
      {/* Top Header - automatically visible on Dashboard, Explorer, Review; auto-hidden in Study/Exam/Flashcard */}
      {!isFocusArena && (
        <Header
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'dashboard') handleExitToDashboard();
            else if (view === 'explorer') handleOpenExplorer();
            else setCurrentView(view as any);
          }}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenSyncModal={() => setSyncModalOpen(true)}
          onOpenBusyModal={() => setBusyModalOpen(true)}
          busyEnabled={busyState.settings.enabled}
          busyInterval={busyState.settings.intervalMinutes}
          currentUser={currentUser}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onQuickSync={handleQuickSync}
          isSyncingCloud={isSyncingCloud}
        />
      )}

      {/* Main Content Area */}
      <main className="w-full">
        {currentView === 'profile' && (
          <ProfileView
            onBackToDashboard={handleExitToDashboard}
            onStartWeakPractice={handleStartWeakPractice}
            onReloadData={reloadData}
          />
        )}

        {currentView === 'dashboard' && (
          <Dashboard
            decks={decks}
            unfinishedSessions={unfinishedSessions}
            stats={overallStats}
            onStartSession={handleStartSession}
            onResumeSession={handleResumeSession}
            onRestartSession={handleRestartSession}
            onDeleteSession={handleDeleteSession}
            onResetDeckProgress={handleResetDeckProgress}
            onResetAllProgress={handleResetAllProgress}
            onOpenExplorer={handleOpenExplorer}
            onStartFlashcard={handleStartFlashcard}
            onStartCustomSession={handleStartCustomSession}
            onOpenSyncModal={() => setSyncModalOpen(true)}
            onOpenBusyModal={() => setBusyModalOpen(true)}
            onReloadData={reloadData}
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

        {currentView === 'flashcard' && flashcardQuestions.length > 0 && (
          <FlashcardArena
            deckTitle={flashcardDeckTitle}
            questions={flashcardQuestions}
            initialSession={activeSession?.mode === 'flashcard' ? activeSession : undefined}
            onExit={handleExitToDashboard}
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
            initialFilter={explorerFilter}
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
        onOpenShortcutsHelp={() => setShortcutsModalOpen(true)}
      />

      {/* Shortcuts Guide Modal */}
      <ShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
      />

      {/* Cross-device Progress Sync Modal */}
      <SyncProgressModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        stats={overallStats}
        onSyncComplete={reloadData}
      />

      {/* Busy Mode Settings Modal */}
      <BusyModeModal
        open={busyModalOpen}
        onOpenChange={setBusyModalOpen}
        availableTopics={getAvailableTopics(decks)}
      />

      {/* Floating Web / Browser Fallback for Busy Mode Popup */}
      {!isTauri() && busyState.isPopupVisible && busyState.activeQuestion && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <BusyPopup
            question={busyState.activeQuestion}
            onClose={() => busyModeService.hidePopup()}
          />
        </div>
      )}

      {/* User Authentication Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        initialMode={authMode}
        onSuccess={reloadData}
      />

      {/* Global In-App Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default App;
