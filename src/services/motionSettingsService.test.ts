import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMotionSettings,
  saveMotionSettings,
  getEffectiveMotionMode,
  shouldReduceMotion,
  DEFAULT_MOTION_SETTINGS,
} from './motionSettingsService';

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

describe('motionSettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default settings when storage is empty', () => {
    const settings = getMotionSettings();
    expect(settings.preference).toBe(DEFAULT_MOTION_SETTINGS.preference);
  });

  it('persists and retrieves user motion preference', () => {
    saveMotionSettings({ preference: 'off' });
    expect(getMotionSettings().preference).toBe('off');

    saveMotionSettings({ preference: 'subtle' });
    expect(getMotionSettings().preference).toBe('subtle');

    saveMotionSettings({ preference: 'rich' });
    expect(getMotionSettings().preference).toBe('rich');
  });

  it('resolves effective motion mode correctly', () => {
    expect(getEffectiveMotionMode('off')).toBe('off');
    expect(getEffectiveMotionMode('subtle')).toBe('subtle');
    expect(getEffectiveMotionMode('rich')).toBe('rich');
  });

  it('identifies when motion should be reduced', () => {
    saveMotionSettings({ preference: 'off' });
    expect(shouldReduceMotion()).toBe(true);

    saveMotionSettings({ preference: 'subtle' });
    expect(shouldReduceMotion()).toBe(true);

    saveMotionSettings({ preference: 'rich' });
    expect(shouldReduceMotion()).toBe(false);
  });
});
