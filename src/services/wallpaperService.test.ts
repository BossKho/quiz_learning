import { describe, it, expect, beforeEach, vi } from 'vitest';
import { wallpaperService } from './wallpaperService';

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

describe('WallpaperService', () => {
  beforeEach(() => {
    localStorage.clear();
    wallpaperService.updateDisplaySettings({
      enabled: false,
      opacity: 0.18,
      blur: 0,
    });
  });

  it('provides default settings', () => {
    const settings = wallpaperService.getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.opacity).toBe(0.18);
    expect(settings.blur).toBe(0);
  });

  it('updates display settings (opacity and blur) and persists meta', () => {
    wallpaperService.updateDisplaySettings({
      opacity: 0.25,
      blur: 5,
    });

    const settings = wallpaperService.getSettings();
    expect(settings.opacity).toBe(0.25);
    expect(settings.blur).toBe(5);

    const saved = JSON.parse(localStorage.getItem('quiz_app_wallpaper_meta') || '{}');
    expect(saved.opacity).toBe(0.25);
    expect(saved.blur).toBe(5);
  });

  it('subscribes to setting changes', () => {
    const listener = vi.fn();
    const unsub = wallpaperService.subscribe(listener);

    // Initial notification on subscribe
    expect(listener).toHaveBeenCalled();

    wallpaperService.updateDisplaySettings({ opacity: 0.3 });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ opacity: 0.3 }));

    unsub();
    listener.mockClear();
    wallpaperService.updateDisplaySettings({ opacity: 0.4 });
    expect(listener).not.toHaveBeenCalled();
  });
});
