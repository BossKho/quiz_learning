import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  DownloadCloud, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  Package,
  RotateCcw,
  AlertTriangle,
  Lock,
  Clock,
  BellOff,
  Bell,
  ChevronDown
} from 'lucide-react';
import { 
  type UpdateInfo, 
  type DownloadProgress,
  type UpdateSnoozeSettings,
  executePreUpdateShield, 
  openExternalUrl,
  startInAppDownload,
  launchInstallerAndExit,
  listenToDownloadProgress,
  getUpdateSnoozeSettings,
  snoozeUpdates,
  skipVersion,
  clearSnooze,
  formatSnoozeUntil
} from '@/services/updateService';
import { isTauri } from '@tauri-apps/api/core';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface UpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateInfo | null;
  currentUserId?: string | null;
}

type UpdateStatus = 'idle' | 'downloading' | 'ready_to_restart' | 'applying' | 'error';

export const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  onOpenChange,
  updateInfo,
  currentUserId,
}) => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [installerPath, setInstallerPath] = useState<string | null>(null);
  const [verifiedSha256, setVerifiedSha256] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processStep, setProcessStep] = useState<string>('');
  const [snoozeSettings, setSnoozeSettings] = useState<UpdateSnoozeSettings>(() => getUpdateSnoozeSettings());
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  // Subscribe to snooze changes
  useEffect(() => {
    const handleSnoozeChanged = () => {
      setSnoozeSettings(getUpdateSnoozeSettings());
    };
    window.addEventListener('quiz_update_snooze_changed', handleSnoozeChanged);
    return () => window.removeEventListener('quiz_update_snooze_changed', handleSnoozeChanged);
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStatus('idle');
      setProgress(null);
      setInstallerPath(null);
      setVerifiedSha256(null);
      setErrorMessage(null);
      setProcessStep('');
      setSnoozeSettings(getUpdateSnoozeSettings());
      setShowSnoozeMenu(false);
    }
  }, [open]);

  // Listen to download progress emitted by native Rust
  useEffect(() => {
    if (status !== 'downloading') return;

    let cleanupFn: (() => void) | undefined;
    listenToDownloadProgress((p) => {
      setProgress(p);
    }).then((unlisten) => {
      cleanupFn = unlisten;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [status]);

  if (!updateInfo) return null;

  const downloadUrl = updateInfo.setupAsset?.downloadUrl || updateInfo.releaseUrl;
  const expectedSha256 = updateInfo.setupAsset?.sha256;

  // Step 1: Start In-App streaming download and SHA-256 verification
  const handleStartInAppDownload = async () => {
    if (!isTauri()) {
      // Fallback for web mode
      await openExternalUrl(downloadUrl);
      return;
    }

    setStatus('downloading');
    setErrorMessage(null);
    setProcessStep('Đang kết nối và tải tệp cài đặt vào hệ thống...');

    try {
      const res = await startInAppDownload(downloadUrl, expectedSha256);
      setInstallerPath(res.installerPath);
      setVerifiedSha256(res.sha256);
      setStatus('ready_to_restart');
      toast.success('Đã tải và xác thực toàn vẹn bộ cài thành công! 🛡️');
    } catch (err: any) {
      console.error('In-app update download failed:', err);
      setStatus('error');
      setErrorMessage(err.message || String(err));
      toast.error('Lỗi tải bản cập nhật: ' + (err.message || String(err)));
    }
  };

  // Step 2: Flush data, spawn independent helper process, and restart
  const handleApplyUpdateAndRestart = async () => {
    if (!installerPath) return;

    setStatus('applying');
    try {
      // 1. Pre-update data shield
      setProcessStep('Đang lưu trữ dữ liệu cục bộ và đồng bộ an toàn lên Cloud...');
      const backupOk = await executePreUpdateShield(currentUserId);
      if (!backupOk) {
        toast.warning('Không thể kết nối Cloud, dữ liệu đã được lưu cục bộ an toàn.');
      }

      // 2. Launch helper process and cleanly exit
      setProcessStep('Đang chuyển giao cho tiến trình cập nhật ngầm & đóng ứng dụng...');
      await launchInstallerAndExit(installerPath);
    } catch (err: any) {
      console.error('Failed to launch updater helper:', err);
      setStatus('error');
      setErrorMessage(err.message || String(err));
      toast.error('Không thể khởi chạy cập nhật tự động.');
    }
  };

  const handleManualBrowserDownload = async () => {
    await openExternalUrl(downloadUrl);
  };

  const handleViewOnGitHub = async () => {
    await openExternalUrl(updateInfo.releaseUrl);
  };

  const isLocked = status === 'downloading' || status === 'applying';
  const isSnoozedByTime = Boolean(snoozeSettings.snoozedUntil && Date.now() < snoozeSettings.snoozedUntil);
  const isVersionSkipped = Boolean(snoozeSettings.skippedVersion && snoozeSettings.skippedVersion === updateInfo.latestVersion);
  const isCurrentlySnoozed = isSnoozedByTime || isVersionSkipped;

  return (
    <Dialog open={open} onOpenChange={(val) => !isLocked && onOpenChange(val)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6 border-border shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">
                  Đã Có Bản Cập Nhật Mới!
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[11px] font-bold text-muted-foreground">
                    Hiện tại: v{updateInfo.currentVersion}
                  </Badge>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                    Mới nhất: v{updateInfo.latestVersion}
                  </Badge>
                </div>
              </div>
            </div>

            {updateInfo.publishedAt && (
              <span className="text-[11px] text-muted-foreground font-mono">
                {updateInfo.publishedAt}
              </span>
            )}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            Bản phát hành: <strong className="text-foreground">{updateInfo.releaseName}</strong> ({updateInfo.releaseTag})
          </DialogDescription>
        </DialogHeader>

        {/* 100% Zero Data Loss Assurance Notice */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Cam kết bảo toàn dữ liệu tuyệt đối (Zero Data Loss)
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-600 dark:text-emerald-400/90">
              Cơ sở dữ liệu học tập nằm độc lập trong hệ thống. Trước khi cập nhật, app sẽ tự động sao lưu dữ liệu và đẩy lên Cloud. Mọi hộp Leitner, Bookmark và bài đang làm dở sẽ được giữ nguyên 100%.
            </p>
          </div>
        </div>

        {/* Active Snooze / Pause Status Banner */}
        {isCurrentlySnoozed && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <BellOff className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {isVersionSkipped
                    ? `Đang bỏ qua thông báo bản v${updateInfo.latestVersion}`
                    : `Đang tạm dừng thông báo đến ${formatSnoozeUntil(snoozeSettings.snoozedUntil)}`}
                </div>
                <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90 leading-tight">
                  Thông báo tự động và huy hiệu trên thanh tiêu đề đã được tạm hoãn.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                clearSnooze();
                setSnoozeSettings(getUpdateSnoozeSettings());
                toast.success('Đã khôi phục thông báo cập nhật!');
              }}
              className="text-xs shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded-xl cursor-pointer"
            >
              <Bell className="size-3.5 mr-1" />
              Bật lại
            </Button>
          </div>
        )}

        {/* Release Notes / Changelog */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>Nội dung cập nhật & Sửa lỗi:</span>
            <button
              type="button"
              onClick={handleViewOnGitHub}
              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span>Xem trên GitHub</span>
              <ExternalLink className="size-3" />
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto rounded-2xl border border-border bg-muted/40 p-3.5 text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-line select-text">
            {updateInfo.releaseNotes || 'Bản cập nhật cải thiện tính năng, tối ưu hóa trải nghiệm và sửa các lỗi phát sinh.'}
          </div>
        </div>

        {/* ============================================================== */}
        {/* INTERACTIVE STATE VIEWS                                         */}
        {/* ============================================================== */}

        {/* 1. DOWNLOADING STATE: Real-time progress bar */}
        {status === 'downloading' && (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-primary">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Đang tải bản cập nhật...</span>
              </span>
              <span>{progress ? `${progress.percent}%` : 'Đang kết nối...'}</span>
            </div>

            <Progress value={progress?.percent || 0} className="h-2.5 bg-primary/20" />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{progress ? `${progress.downloadedFormatted} / ${progress.totalFormatted}` : 'Đang chuẩn bị gói dữ liệu...'}</span>
              <span className="flex items-center gap-1 text-[10px]">
                <Lock className="size-3 text-emerald-500" />
                <span>Đang kiểm tra băm SHA-256</span>
              </span>
            </div>
          </div>
        )}

        {/* 2. READY TO RESTART STATE: Verified & Ready to Apply */}
        {status === 'ready_to_restart' && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Tải về và xác thực toàn vẹn thành công!
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                  Bản cài đặt an toàn đã sẵn sàng. Khi bạn bấm nút bên dưới, hệ thống sẽ tự động lưu dữ liệu, đóng ứng dụng và cài đặt ngầm trong 2 giây rồi tự khởi động lại.
                </p>
                {verifiedSha256 && (
                  <div className="mt-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md inline-block">
                    SHA-256: {verifiedSha256.substring(0, 16)}... (Đã khớp)
                  </div>
                )}
              </div>
            </div>

            <Button
              size="default"
              onClick={handleApplyUpdateAndRestart}
              className="w-full rounded-xl text-xs font-bold gap-2 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white shadow-md h-11"
            >
              <RotateCcw className="size-4" />
              <span>Khởi động lại để hoàn tất cập nhật ngay</span>
            </Button>
          </div>
        )}

        {/* 3. APPLYING STATE: Transitioning process */}
        {status === 'applying' && (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-center gap-3 animate-in fade-in">
            <Loader2 className="size-5 text-primary animate-spin shrink-0" />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-primary">Đang chuẩn bị cập nhật ngầm...</span>
              <p className="text-[11px] text-muted-foreground">{processStep}</p>
            </div>
          </div>
        )}

        {/* 4. ERROR STATE: Failure with recovery buttons */}
        {status === 'error' && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Không thể hoàn tất cập nhật tự động</span>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 whitespace-pre-line">{errorMessage}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartInAppDownload}
                className="text-xs font-semibold rounded-xl flex-1 cursor-pointer"
              >
                Thử tải lại
              </Button>
              <Button
                size="sm"
                onClick={handleManualBrowserDownload}
                className="text-xs font-semibold rounded-xl flex-1 cursor-pointer"
              >
                Tải thủ công (trình duyệt)
              </Button>
            </div>
          </div>
        )}

        {/* 5. IDLE STATE: Primary Action Card */}
        {status === 'idle' && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Bản Cập Nhật Tự Động (In-App Seamless)</span>
              </div>
              {updateInfo.setupAsset?.sizeFormatted && (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                  ~{updateInfo.setupAsset.sizeFormatted}
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tải trực tiếp trong ứng dụng, tự động kiểm tra chữ ký số SHA-256, tự động ghi đè cài đặt ngầm và khởi động lại mà không cần gỡ bản cũ.
            </p>

            <Button
              size="default"
              onClick={handleStartInAppDownload}
              className="w-full rounded-xl text-xs font-bold gap-2 cursor-pointer bg-gradient-to-r from-primary to-indigo-600 hover:opacity-95 text-white shadow-md h-10"
            >
              <DownloadCloud className="size-4" />
              <span>Cập nhật tự động (In-App Update)</span>
            </Button>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between pt-2 border-t border-border sm:justify-between">
          <div className="relative">
            {showSnoozeMenu && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSnoozeMenu(false)}
              />
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLocked}
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer rounded-xl flex items-center gap-1.5 border border-transparent hover:border-border"
            >
              <Clock className="size-3.5 text-muted-foreground" />
              <span>{isCurrentlySnoozed ? 'Đang tạm dừng' : 'Để sau / Tạm dừng'}</span>
              <ChevronDown className={cn("size-3 transition-transform", showSnoozeMenu && "rotate-180")} />
            </Button>

            {showSnoozeMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl border border-border bg-popover text-popover-foreground p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Tùy chọn tạm dừng</span>
                  <Clock className="size-3" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSnoozeMenu(false);
                    onOpenChange(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-muted font-medium transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Để sau (nhắc lại khi mở app)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    snoozeUpdates(24);
                    setSnoozeSettings(getUpdateSnoozeSettings());
                    setShowSnoozeMenu(false);
                    toast.info('Đã tạm dừng thông báo cập nhật trong 24 giờ (1 ngày).');
                    onOpenChange(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-muted font-medium transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Tạm dừng 24 giờ (1 ngày)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">24h</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    snoozeUpdates(72);
                    setSnoozeSettings(getUpdateSnoozeSettings());
                    setShowSnoozeMenu(false);
                    toast.info('Đã tạm dừng thông báo cập nhật trong 3 ngày.');
                    onOpenChange(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-muted font-medium transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Tạm dừng 3 ngày</span>
                  <span className="text-[10px] text-muted-foreground font-mono">3d</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    snoozeUpdates(168);
                    setSnoozeSettings(getUpdateSnoozeSettings());
                    setShowSnoozeMenu(false);
                    toast.info('Đã tạm dừng thông báo cập nhật trong 1 tuần (7 ngày).');
                    onOpenChange(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-muted font-medium transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Tạm dừng 1 tuần (7 ngày)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">7d</span>
                </button>

                <div className="my-1 border-t border-border" />

                <button
                  type="button"
                  onClick={() => {
                    skipVersion(updateInfo.latestVersion);
                    setSnoozeSettings(getUpdateSnoozeSettings());
                    setShowSnoozeMenu(false);
                    toast.info(`Đã bỏ qua thông báo cho phiên bản v${updateInfo.latestVersion}.`);
                    onOpenChange(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Bỏ qua phiên bản v{updateInfo.latestVersion}</span>
                  <BellOff className="size-3.5" />
                </button>

                {isCurrentlySnoozed && (
                  <button
                    type="button"
                    onClick={() => {
                      clearSnooze();
                      setSnoozeSettings(getUpdateSnoozeSettings());
                      setShowSnoozeMenu(false);
                      toast.success('Đã khôi phục thông báo cập nhật.');
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs text-primary hover:bg-primary/10 font-semibold transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Khôi phục thông báo ngay</span>
                    <RotateCcw className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualBrowserDownload}
            className="text-xs font-semibold rounded-xl gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <span>Tải qua trình duyệt</span>
            <ExternalLink className="size-3" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
