import { dbService } from '@/services/db';
import { soundService } from '@/services/soundService';
import type { Question } from '@/types/quiz';
import { isTauri, invoke } from '@tauri-apps/api/core';

export interface BusyModeSettings {
  enabled: boolean;
  intervalMinutes: number; // e.g. 1, 2, 3, 5, 10
  topicId: string; // 'all' or specific topic ID
  soundEnabled: boolean;
}

export interface BusyModeState {
  settings: BusyModeSettings;
  activeQuestion: Question | null;
  isPopupVisible: boolean;
  nextTriggerTime: number | null; // timestamp when next question will trigger
}

const STORAGE_KEY = 'quiz_busy_mode_settings';
const BROADCAST_CHANNEL_NAME = 'quiz_busy_mode_channel';

const DEFAULT_SETTINGS: BusyModeSettings = {
  enabled: false,
  intervalMinutes: 3,
  topicId: 'all',
  soundEnabled: true,
};

type Listener = (state: BusyModeState) => void;

export const isPopupSubWindow = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('window') === 'busy_popup';
};

class BusyModeService {
  private settings: BusyModeSettings = DEFAULT_SETTINGS;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private nextTriggerTime: number | null = null;
  private activeQuestion: Question | null = null;
  private isPopupVisible: boolean = false;
  private listeners = new Set<Listener>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.loadSettings();
    this.initBroadcastChannel();
    // CRITICAL: Secondary popup window is purely a display view and must NEVER schedule timers
    if (this.settings.enabled && !isPopupSubWindow()) {
      this.startTimer();
    }
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save busy mode settings:', e);
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type === 'STATE_SYNC') {
          this.settings = data.settings;
          this.activeQuestion = data.activeQuestion;
          this.isPopupVisible = data.isPopupVisible;
          this.nextTriggerTime = data.nextTriggerTime;
          // If disabled, immediately kill any timer
          if (!this.settings.enabled) {
            this.stopTimer();
          }
          this.notify();
        } else if (type === 'HALT_TIMER') {
          this.settings.enabled = false;
          this.stopTimer();
          this.isPopupVisible = false;
          this.activeQuestion = null;
          this.notify();
        } else if (type === 'SHOW_QUESTION') {
          this.activeQuestion = data.question;
          this.isPopupVisible = true;
          this.notify();
        } else if (type === 'POPUP_CLOSED') {
          this.isPopupVisible = false;
          this.activeQuestion = null;
          // If in main window and busy mode is still enabled, schedule next question
          if (this.settings.enabled && !isPopupSubWindow()) {
            this.startTimer();
          }
          this.notify();
        } else if (type === 'TRIGGER_NOW') {
          this.triggerQuestionNow(true);
        }
      };
    }
  }

  private broadcast(type: string, data: any): void {
    if (this.channel) {
      try {
        this.channel.postMessage({ type, data });
      } catch (err) {
        console.warn('Broadcast error:', err);
      }
    }
  }

  public getSnapshot(): BusyModeState {
    return {
      settings: { ...this.settings },
      activeQuestion: this.activeQuestion,
      isPopupVisible: this.isPopupVisible,
      nextTriggerTime: this.nextTriggerTime,
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  public updateSettings(updates: Partial<BusyModeSettings>): void {
    const prevEnabled = this.settings.enabled;
    const prevInterval = this.settings.intervalMinutes;

    this.settings = { ...this.settings, ...updates };
    this.saveSettings();

    if (this.settings.enabled) {
      if (!prevEnabled || prevInterval !== this.settings.intervalMinutes) {
        this.startTimer();
      }
    } else {
      // User paused or disabled Busy Mode:
      // 1. Immediately cancel local timer
      this.stopTimer();
      // 2. Hide any active popup and reset active question
      this.hidePopup();
      // 3. Explicitly signal all windows to halt any timers
      this.broadcast('HALT_TIMER', {});
    }

    this.broadcast('STATE_SYNC', this.getSnapshot());
    this.notify();
  }

  public startTimer(): void {
    // Secondary popup sub-window must never start timers
    if (isPopupSubWindow()) return;

    this.stopTimer();

    // Guard: Never start timer if disabled
    if (!this.settings.enabled) {
      return;
    }

    const ms = Math.max(1, this.settings.intervalMinutes) * 60 * 1000;
    this.nextTriggerTime = Date.now() + ms;

    this.timerId = setTimeout(async () => {
      // Guard: Re-verify that settings are still enabled when timer fires
      if (!this.settings.enabled) {
        this.stopTimer();
        return;
      }
      await this.triggerQuestionNow();
      if (this.settings.enabled && !isPopupSubWindow()) {
        this.startTimer();
      }
    }, ms);

    this.notify();
  }

  public stopTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.nextTriggerTime = null;
    this.notify();
  }

  /**
   * Immediately selects a question and displays the popup.
   * If force is false, it strictly will NOT trigger if Busy Mode is disabled.
   */
  public async triggerQuestionNow(force: boolean = false): Promise<void> {
    if (!this.settings.enabled && !force) {
      this.stopTimer();
      this.hidePopup();
      return;
    }

    try {
      await dbService.init();

      // Pick question based on topic filter
      const categoryId = this.settings.topicId !== 'all' ? this.settings.topicId : undefined;
      let questions = await dbService.getCustomQuestions({
        count: 1,
        shuffle: true,
        scope: 'all',
        categoryId,
      });

      // Fallback to any question if none found for category
      if (questions.length === 0) {
        questions = await dbService.getCustomQuestions({
          count: 1,
          shuffle: true,
          scope: 'all',
        });
      }

      if (questions.length === 0) {
        console.warn('Busy Mode: No questions found in database.');
        return;
      }

      // Re-check right before showing to ensure state didn't change during async db operations
      if (!this.settings.enabled && !force) {
        return;
      }

      const q = questions[0];
      this.activeQuestion = q;
      this.isPopupVisible = true;

      // Play alert chime
      if (this.settings.soundEnabled) {
        soundService.playPopupAlert();
      }

      // Try invoking native Tauri window
      await this.showNativeTauriWindow();

      // Broadcast to any child popup windows
      this.broadcast('SHOW_QUESTION', { question: q });
      this.notify();
    } catch (err) {
      console.error('Busy Mode failed to trigger question:', err);
    }
  }

  private async showNativeTauriWindow(): Promise<void> {
    try {
      if (isTauri()) {
        await invoke('show_busy_popup');
      }
    } catch {
      // In web browser or desktop fallback
    }
  }

  public async hidePopup(): Promise<void> {
    this.isPopupVisible = false;
    this.activeQuestion = null;

    try {
      if (isTauri()) {
        await invoke('hide_busy_popup');
      }
    } catch {
      // Ignore
    }

    this.broadcast('POPUP_CLOSED', {});
    this.notify();

    // Restart timer for next round ONLY if enabled and in main window
    if (this.settings.enabled && !isPopupSubWindow()) {
      this.startTimer();
    }
  }

  /**
   * Submit an answer from the popup, updates SQLite database & Leitner box
   */
  public async submitAnswer(
    questionId: string,
    selectedOptionIndex: number
  ): Promise<{ isCorrect: boolean; correctAnswers: number[]; explanation: string; nextBox: number }> {
    const q = this.activeQuestion;
    const isCorrect = q ? q.answer.includes(selectedOptionIndex) : false;

    // Play feedback sound
    if (this.settings.soundEnabled) {
      if (isCorrect) soundService.playCorrect();
      else soundService.playIncorrect();
    }

    // Persist to SQLite
    let nextBox = 1;
    try {
      const updatedStats = await dbService.updateQuestionStats(questionId, isCorrect);
      nextBox = updatedStats.leitner_box;
    } catch (err) {
      console.error('Failed to update question stats:', err);
    }

    return {
      isCorrect,
      correctAnswers: q ? q.answer : [],
      explanation: q?.explanation || q?.note || '',
      nextBox,
    };
  }
}

export const busyModeService = new BusyModeService();

