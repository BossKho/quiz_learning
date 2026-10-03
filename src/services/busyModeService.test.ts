import { describe, it, expect, beforeEach } from 'vitest';
import { busyModeService } from './busyModeService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] || null,
    length: 0,
  };
}

describe('BusyModeService', () => {
  beforeEach(() => {
    localStorage.clear();
    busyModeService.updateSettings({
      enabled: false,
      intervalMinutes: 3,
      topicId: 'all',
      soundEnabled: true,
    });
  });

  it('initializes with default settings', () => {
    const snapshot = busyModeService.getSnapshot();
    expect(snapshot.settings.intervalMinutes).toBe(3);
    expect(snapshot.settings.topicId).toBe('all');
    expect(snapshot.settings.soundEnabled).toBe(true);
  });

  it('updates settings and persists to localStorage', () => {
    busyModeService.updateSettings({
      intervalMinutes: 5,
      topicId: 'fast_track',
    });

    const snapshot = busyModeService.getSnapshot();
    expect(snapshot.settings.intervalMinutes).toBe(5);
    expect(snapshot.settings.topicId).toBe('fast_track');

    const saved = JSON.parse(localStorage.getItem('quiz_busy_mode_settings') || '{}');
    expect(saved.intervalMinutes).toBe(5);
    expect(saved.topicId).toBe('fast_track');
  });

  it('allows starting and stopping timer correctly', () => {
    busyModeService.updateSettings({ enabled: true, intervalMinutes: 2 });
    let snapshot = busyModeService.getSnapshot();
    expect(snapshot.nextTriggerTime).not.toBeNull();
    expect(snapshot.nextTriggerTime!).toBeGreaterThan(Date.now());

    busyModeService.updateSettings({ enabled: false });
    snapshot = busyModeService.getSnapshot();
    expect(snapshot.nextTriggerTime).toBeNull();
  });

  it('strictly does not trigger question when disabled (pause state)', async () => {
    busyModeService.updateSettings({ enabled: false });
    await busyModeService.triggerQuestionNow(); // force = false

    const snapshot = busyModeService.getSnapshot();
    expect(snapshot.activeQuestion).toBeNull();
    expect(snapshot.isPopupVisible).toBe(false);
  });

  it('cancels timer and immediately hides popup when updated to disabled', () => {
    busyModeService.updateSettings({ enabled: true, intervalMinutes: 5 });
    expect(busyModeService.getSnapshot().nextTriggerTime).not.toBeNull();

    busyModeService.updateSettings({ enabled: false });
    const snapshot = busyModeService.getSnapshot();
    expect(snapshot.nextTriggerTime).toBeNull();
    expect(snapshot.isPopupVisible).toBe(false);
    expect(snapshot.activeQuestion).toBeNull();
  });
});
