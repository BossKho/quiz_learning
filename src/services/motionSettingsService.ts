import { useState, useEffect, useCallback } from 'react';

export type MotionPreference = 'system' | 'rich' | 'subtle' | 'off';

export interface MotionSettings {
  preference: MotionPreference;
}

export const STORAGE_MOTION_KEY = 'quiz_app_motion_settings';

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  preference: 'system',
};

export function useAppMotionPreference(): {
  preference: MotionPreference;
  effectiveMode: 'off' | 'subtle' | 'rich';
  setPreference: (pref: MotionPreference) => void;
} {
  const [pref, setPref] = useState<MotionPreference>(() => getMotionSettings().preference);

  useEffect(() => {
    const handleUpdate = () => {
      setPref(getMotionSettings().preference);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('quiz_motion_settings_changed', handleUpdate);
      return () => window.removeEventListener('quiz_motion_settings_changed', handleUpdate);
    }
  }, []);

  const updatePreference = useCallback((newPref: MotionPreference) => {
    saveMotionSettings({ preference: newPref });
    setPref(newPref);
  }, []);

  return {
    preference: pref,
    effectiveMode: getEffectiveMotionMode(pref),
    setPreference: updatePreference,
  };
}

export function getMotionSettings(): MotionSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_MOTION_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_MOTION_KEY);
    if (!raw) return DEFAULT_MOTION_SETTINGS;
    const parsed = JSON.parse(raw);
    if (['system', 'rich', 'subtle', 'off'].includes(parsed.preference)) {
      return parsed;
    }
    return DEFAULT_MOTION_SETTINGS;
  } catch {
    return DEFAULT_MOTION_SETTINGS;
  }
}

export function saveMotionSettings(settings: MotionSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MOTION_KEY, JSON.stringify(settings));
    applyMotionClassToDom(settings.preference);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('quiz_motion_settings_changed', { detail: settings }));
    }
  } catch (err) {
    console.error('Failed to save motion settings:', err);
  }
}

/**
 * Determine effective motion level:
 * - 'off': 0ms animations, instantaneous transitions
 * - 'subtle': gentle fades, no 3D or cursor spotlight or confetti
 * - 'rich': full spring physics, 3D flips, spotlights, confetti
 */
export function getEffectiveMotionMode(pref?: MotionPreference): 'off' | 'subtle' | 'rich' {
  const target = pref ?? getMotionSettings().preference;
  if (target === 'off') return 'off';
  if (target === 'subtle') return 'subtle';
  if (target === 'rich') return 'rich';

  // System mode: inspect prefers-reduced-motion media query
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return 'off';
  }
  return 'rich';
}

export function shouldReduceMotion(): boolean {
  const mode = getEffectiveMotionMode();
  return mode === 'off' || mode === 'subtle';
}

export function applyMotionClassToDom(pref?: MotionPreference): void {
  if (typeof document === 'undefined') return;
  const mode = getEffectiveMotionMode(pref);
  const root = document.documentElement;
  if (mode === 'off') {
    root.classList.add('reduce-motion', 'no-motion');
  } else if (mode === 'subtle') {
    root.classList.add('reduce-motion');
    root.classList.remove('no-motion');
  } else {
    root.classList.remove('reduce-motion', 'no-motion');
  }
}

// Initial sync on module load if in browser
if (typeof window !== 'undefined') {
  try {
    applyMotionClassToDom();
    if (typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener?.('change', () => {
        const current = getMotionSettings();
        if (current.preference === 'system') {
          applyMotionClassToDom('system');
          window.dispatchEvent(new CustomEvent('quiz_motion_settings_changed', { detail: current }));
        }
      });
    }
  } catch (e) {
    console.warn('Could not initialize motion settings listener:', e);
  }
}
