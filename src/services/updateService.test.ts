import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  parseVersion, 
  compareVersions, 
  checkForAppUpdates, 
  CURRENT_APP_VERSION,
  snoozeUpdates,
  skipVersion,
  clearSnooze,
  getUpdateSnoozeSettings,
  isUpdateSnoozed,
  formatSnoozeUntil
} from './updateService';

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

describe('updateService', () => {
  describe('parseVersion', () => {
    it('correctly parses semver strings', () => {
      expect(parseVersion('1.0.0')).toEqual([1, 0, 0]);
      expect(parseVersion('v1.0.1')).toEqual([1, 0, 1]);
      expect(parseVersion('v2.15.3')).toEqual([2, 15, 3]);
    });

    it('handles short versions and names', () => {
      expect(parseVersion('1.1')).toEqual([1, 1, 0]);
      expect(parseVersion('Ver 1.1')).toEqual([1, 1, 0]);
      expect(parseVersion('Ver 1.21')).toEqual([1, 2, 1]);
      expect(parseVersion('1.21')).toEqual([1, 2, 1]);
      expect(parseVersion('version1')).toEqual([1, 0, 0]);
      expect(parseVersion('')).toEqual([0, 0, 0]);
    });
  });

  describe('compareVersions', () => {
    it('returns 1 when remote is newer', () => {
      expect(compareVersions('Ver 1.21', '1.2.0')).toBe(1);
      expect(compareVersions('1.2.1', '1.2.0')).toBe(1);
      expect(compareVersions('1.3.0', '1.2.1')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('returns -1 when remote is older', () => {
      expect(compareVersions('1.1.9', '1.2.1')).toBe(-1);
      expect(compareVersions('1.2.0', '1.2.1')).toBe(-1);
      expect(compareVersions('1.0.0', '1.2.1')).toBe(-1);
    });

    it('returns 0 when versions are equal', () => {
      expect(compareVersions('1.2.1', '1.2.1')).toBe(0);
      expect(compareVersions('Ver 1.21', '1.2.1')).toBe(0);
    });
  });

  describe('checkForAppUpdates with mocked fetch', () => {
    it('detects available update correctly', async () => {
      const mockRelease = {
        tag_name: 'v3.3.0',
        name: 'Ver 3.3',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v3.3.0',
        body: 'Bug fixes and performance improvements',
        assets: [
          {
            name: 'QuizLearningPro_Setup.exe',
            size: 5455686,
            browser_download_url: 'https://github.com/.../QuizLearningPro_Setup.exe',
          },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      }));

      const update = await checkForAppUpdates();
      expect(update.hasUpdate).toBe(true);
      expect(update.latestVersion).toBe('3.3.0');
      expect(update.setupAsset?.name).toBe('QuizLearningPro_Setup.exe');
      expect(update.setupAsset?.sizeFormatted).toBe('5.2 MB');
    });

    it('returns hasUpdate false when on latest version', async () => {
      const mockRelease = {
        tag_name: 'v3.2.0',
        name: 'Ver 3.2',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v3.2.0',
        body: 'Latest release',
        assets: [],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      }));

      const update = await checkForAppUpdates();
      expect(update.hasUpdate).toBe(false);
      expect(update.currentVersion).toBe(CURRENT_APP_VERSION);
    });

    it('extracts SHA-256 digest from asset when present', async () => {
      const mockReleaseWithDigest = {
        tag_name: 'v3.2.0',
        name: 'Ver 3.2',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v3.2.0',
        body: 'Release notes',
        assets: [
          {
            name: 'QuizLearningPro_Setup.exe',
            size: 5467534,
            browser_download_url: 'https://github.com/.../QuizLearningPro_Setup.exe',
            digest: 'sha256:b4ab04e063c66d83f6448edd17f9133a61b09d6d720a366b461950637fb6a6e5',
          },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReleaseWithDigest,
      }));

      const update = await checkForAppUpdates();
      expect(update.setupAsset?.sha256).toBe('B4AB04E063C66D83F6448EDD17F9133A61B09D6D720A366B461950637FB6A6E5');
    });

    it('extracts SHA-256 from release body when asset digest is missing', async () => {
      const mockReleaseWithBodyHash = {
        tag_name: 'v3.2.0',
        name: 'Ver 3.2',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v3.2.0',
        body: 'Release notes\nSHA-256: AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899\nThank you',
        assets: [
          {
            name: 'QuizLearningPro_Setup.exe',
            size: 5467534,
            browser_download_url: 'https://github.com/.../QuizLearningPro_Setup.exe',
          },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReleaseWithBodyHash,
      }));

      const update = await checkForAppUpdates();
      expect(update.setupAsset?.sha256).toBe('AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899');
    });
  });

  describe('Update Snooze / Pause management', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('correctly snoozes updates for a specific duration', () => {
      clearSnooze();
      expect(isUpdateSnoozed('3.2.0')).toBe(false);

      snoozeUpdates(24);
      expect(isUpdateSnoozed('3.2.0')).toBe(true);

      const settings = getUpdateSnoozeSettings();
      expect(settings.snoozedUntil).toBeGreaterThan(Date.now());
    });

    it('correctly skips a specific version', () => {
      clearSnooze();
      skipVersion('3.2.0');

      expect(isUpdateSnoozed('3.2.0')).toBe(true);
      expect(isUpdateSnoozed('3.3.0')).toBe(false);
    });

    it('clears snooze settings properly', () => {
      snoozeUpdates(72);
      skipVersion('3.2.0');
      expect(isUpdateSnoozed('3.2.0')).toBe(true);

      clearSnooze();
      expect(isUpdateSnoozed('3.2.0')).toBe(false);
      const settings = getUpdateSnoozeSettings();
      expect(settings.snoozedUntil).toBeNull();
      expect(settings.skippedVersion).toBeNull();
    });

    it('formats snooze until timestamp nicely', () => {
      expect(formatSnoozeUntil(null)).toBe('');
      const fixedDate = new Date(2026, 9, 10, 14, 30); // Oct 10, 2026 14:30
      const formatted = formatSnoozeUntil(fixedDate.getTime());
      expect(formatted).toBe('14:30 ngày 10/10');
    });
  });
});
