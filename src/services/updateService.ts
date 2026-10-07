import { dbService } from '@/services/db';
import { syncCloudImmediate } from '@/services/firebaseService';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const CURRENT_APP_VERSION = '2.3.0';
export const GITHUB_REPO_OWNER = 'BossKho';
export const GITHUB_REPO_NAME = 'quiz_learning';

export interface ReleaseAsset {
  name: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
  sha256?: string;
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

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  downloadedFormatted: string;
  totalFormatted: string;
}

export interface InAppDownloadResult {
  installerPath: string;
  sha256: string;
  totalBytes: number;
}

/**
 * Format bytes to readable string (e.g. 5.5 MB)
 */
export function formatFileSize(bytes: number): string {
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

      if (assetName.includes('setup') || assetName.endsWith('.exe')) {
        let sha256: string | undefined;

        // Check digest on asset
        if (asset.digest && typeof asset.digest === 'string' && asset.digest.toLowerCase().startsWith('sha256:')) {
          sha256 = asset.digest.substring(7).trim().toUpperCase();
        }

        // Fallback: scan release body for SHA-256 pattern
        if (!sha256 && releaseData.body) {
          const match = releaseData.body.match(/sha-?256[:\s]+([a-fA-F0-9]{64})/i);
          if (match) {
            sha256 = match[1].toUpperCase();
          }
        }

        setupAsset = {
          name: asset.name,
          size: asset.size,
          sizeFormatted: formatFileSize(asset.size),
          downloadUrl: asset.browser_download_url,
          sha256,
        };
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

/**
 * Listen to real-time download progress events emitted by native Rust
 */
export async function listenToDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }
  try {
    const unlisten = await listen<{ downloaded: number; total: number; percent: number }>(
      'update-download-progress',
      (event) => {
        const p = event.payload;
        callback({
          downloaded: p.downloaded,
          total: p.total,
          percent: Math.round(p.percent * 10) / 10,
          downloadedFormatted: formatFileSize(p.downloaded),
          totalFormatted: formatFileSize(p.total),
        });
      }
    );
    return unlisten;
  } catch (err) {
    console.warn('Failed to attach update-download-progress listener:', err);
    return () => {};
  }
}

/**
 * Download update installer directly in app and verify SHA-256 checksum
 */
export async function startInAppDownload(
  downloadUrl: string,
  expectedSha256?: string
): Promise<InAppDownloadResult> {
  if (!isTauri()) {
    throw new Error('Tính năng tải cập nhật tự động yêu cầu ứng dụng Desktop.');
  }

  const result = await invoke<{ installer_path: string; sha256: string; total_bytes: number }>(
    'download_update_with_progress',
    {
      url: downloadUrl,
      expectedSha256: expectedSha256 || null,
    }
  );

  return {
    installerPath: result.installer_path,
    sha256: result.sha256,
    totalBytes: result.total_bytes,
  };
}

/**
 * Launch independent updater helper process and cleanly exit current process
 */
export async function launchInstallerAndExit(installerPath: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Tính năng cập nhật tự động yêu cầu ứng dụng Desktop.');
  }

  await invoke('launch_updater_and_exit', { installerPath });
}
