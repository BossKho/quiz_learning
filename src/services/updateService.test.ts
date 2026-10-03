import { describe, it, expect, vi } from 'vitest';
import { parseVersion, compareVersions, checkForAppUpdates, CURRENT_APP_VERSION } from './updateService';

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
      expect(parseVersion('version1')).toEqual([1, 0, 0]);
      expect(parseVersion('')).toEqual([0, 0, 0]);
    });
  });

  describe('compareVersions', () => {
    it('returns 1 when remote is newer', () => {
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('returns -1 when remote is older', () => {
      expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('returns 0 when versions are equal', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('v1.0', '1.0.0')).toBe(0);
    });
  });

  describe('checkForAppUpdates with mocked fetch', () => {
    it('detects available update correctly', async () => {
      const mockRelease = {
        tag_name: 'version1',
        name: 'Ver 1.1',
        published_at: '2026-10-03T11:53:20Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/version1',
        body: 'Bug fixes and performance improvements',
        assets: [
          {
            name: 'QuizLearningPro_Setup.exe',
            size: 5455686,
            browser_download_url: 'https://github.com/.../QuizLearningPro_Setup.exe',
          },
          {
            name: 'QuizLearningPro_Portable.exe',
            size: 29941557,
            browser_download_url: 'https://github.com/.../QuizLearningPro_Portable.exe',
          },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      }));

      const update = await checkForAppUpdates();
      expect(update.hasUpdate).toBe(true);
      expect(update.latestVersion).toBe('1.1.0');
      expect(update.setupAsset?.name).toBe('QuizLearningPro_Setup.exe');
      expect(update.setupAsset?.sizeFormatted).toBe('5.2 MB');
      expect(update.portableAsset?.name).toBe('QuizLearningPro_Portable.exe');
      expect(update.portableAsset?.sizeFormatted).toBe('28.6 MB');
    });

    it('returns hasUpdate false when on latest version', async () => {
      const mockRelease = {
        tag_name: 'v1.0.0',
        name: 'Ver 1.0.0',
        published_at: '2026-10-03T11:53:20Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v1.0.0',
        body: 'Initial release',
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
  });
});
