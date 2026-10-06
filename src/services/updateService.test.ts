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
        tag_name: 'v2.1.0',
        name: 'Ver 2.1',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v2.1.0',
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
      expect(update.latestVersion).toBe('2.1.0');
      expect(update.setupAsset?.name).toBe('QuizLearningPro_Setup.exe');
      expect(update.setupAsset?.sizeFormatted).toBe('5.2 MB');
    });

    it('returns hasUpdate false when on latest version', async () => {
      const mockRelease = {
        tag_name: 'v2.0.0',
        name: 'Ver 2.0',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v2.0.0',
        body: 'Official release',
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
        tag_name: 'v2.1.0',
        name: 'Ver 2.1',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v2.1.0',
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
        tag_name: 'v2.1.0',
        name: 'Ver 2.1',
        published_at: '2026-10-07T12:00:00Z',
        html_url: 'https://github.com/BossKho/quiz_learning/releases/tag/v2.1.0',
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
});
