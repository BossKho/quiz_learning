import { dbService } from '@/services/db';
import { syncCloudImmediate } from '@/services/firebaseService';
import { isTauri, invoke } from '@tauri-apps/api/core';

export const CURRENT_APP_VERSION = '1.3.0';
export const GITHUB_REPO_OWNER = 'BossKho';
export const GITHUB_REPO_NAME = 'quiz_learning';

export interface ReleaseAsset {
  name: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTag: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  setupAsset?: ReleaseAsset;
}

/**
 * Format bytes to readable string (e.g. 5.5 MB)
 */
function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Extracts semantic version parts [major, minor, patch] from strings like:
 * "v1.0.1" -> [1, 0, 1]
 * "Ver 1.1" -> [1, 1, 0]
 * "Ver 1.21" -> [1, 2, 1]
 * "version1" -> [1, 0, 0]
 * "1.2.3" -> [1, 2, 3]
 */
export function parseVersion(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0];

  const match = versionStr.match(/\d+(\.\d+)*/);
  if (!match) return [0, 0, 0];

  const rawParts = match[0].split('.');
  // Handle 2-part notation where second part has 2 digits like '1.21' -> [1, 2, 1]
  if (rawParts.length === 2 && rawParts[1].length === 2) {
    const maj = parseInt(rawParts[0], 10) || 0;
    const min = parseInt(rawParts[1][0], 10) || 0;
    const pat = parseInt(rawParts[1][1], 10) || 0;
    return [maj, min, pat];
  }

  const parts = rawParts.map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.slice(0, 3);
}

/**
 * Compares two versions:
 * Returns 1 if v1 > v2
 * Returns -1 if v1 < v2
 * Returns 0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const [maj1, min1, pat1] = parseVersion(v1);
  const [maj2, min2, pat2] = parseVersion(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

/**
 * Open external URL in user's default browser safely
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isTauri()) {
    try {
      await invoke('open_url', { url });
      return;
    } catch (err) {
      console.warn('Native open_url failed, falling back to window.open', err);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Check GitHub Releases for new updates
 */
export async function checkForAppUpdates(): Promise<UpdateInfo> {
  const currentVersion = CURRENT_APP_VERSION;
  let releaseData: any = null;

  try {
    // 1. Try /releases/latest first
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (res.ok) {
      releaseData = await res.json();
    } else {
      // Fallback: fetch all releases and pick index 0
      const listRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      if (listRes.ok) {
        const list = await listRes.json();
        if (Array.isArray(list) && list.length > 0) {
          releaseData = list[0];
        }
      }
    }
  } catch (err) {
    console.warn('Network error checking app updates:', err);
  }

  if (!releaseData) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseTag: `v${currentVersion}`,
      releaseName: 'Quiz Learning Pro',
      releaseNotes: '',
      publishedAt: '',
      releaseUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
    };
  }

  // Determine latest version from name (e.g. "Ver 1.2") or tag_name (e.g. "v1.2.0")
  const tagName = releaseData.tag_name || '';
  const releaseName = releaseData.name || tagName;

  const nameVersionNumbers = parseVersion(releaseName);
  const tagVersionNumbers = parseVersion(tagName);

  let targetVersionStr = tagName;
  if (nameVersionNumbers[1] > tagVersionNumbers[1] || nameVersionNumbers[0] > tagVersionNumbers[0]) {
    targetVersionStr = releaseName;
  }

  const latestVersionDisplay = `${parseVersion(targetVersionStr).join('.')}`;
  const isNewer = compareVersions(latestVersionDisplay, currentVersion) > 0;

  // Extract setup installer asset
  let setupAsset: ReleaseAsset | undefined;

  if (Array.isArray(releaseData.assets)) {
    for (const asset of releaseData.assets) {
      const assetName = asset.name?.toLowerCase() || '';
      const assetObj: ReleaseAsset = {
        name: asset.name,
        size: asset.size,
        sizeFormatted: formatFileSize(asset.size),
        downloadUrl: asset.browser_download_url,
      };

      if (assetName.includes('setup') || assetName.endsWith('.exe')) {
        setupAsset = assetObj;
        break;
      }
    }
  }

  return {
    hasUpdate: isNewer,
    currentVersion,
    latestVersion: latestVersionDisplay,
    releaseTag: tagName,
    releaseName: releaseName || `Bản phát hành ${latestVersionDisplay}`,
    releaseNotes: releaseData.body || 'Cập nhật tính năng, tối ưu trải nghiệm và sửa các lỗi phát sinh.',
    publishedAt: releaseData.published_at ? new Date(releaseData.published_at).toLocaleDateString('vi-VN') : '',
    releaseUrl: releaseData.html_url || `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
    setupAsset,
  };
}

/**
 * Pre-Update Shield: Flushes local SQLite + localStorage, and forces cloud sync
 * to guarantee 100% zero data loss before downloading/installing the update.
 */
export async function executePreUpdateShield(uid?: string | null): Promise<boolean> {
  try {
    // 1. Force flush local SQLite to disk and localStorage
    await dbService.persistImmediate();

    // 2. Force push all progress to Firestore if user is authenticated
    if (uid) {
      await syncCloudImmediate(uid);
    }
    return true;
  } catch (err) {
    console.error('Failed to execute pre-update data shield:', err);
    return false;
  }
}

