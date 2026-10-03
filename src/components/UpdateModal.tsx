import React, { useState } from 'react';
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
import { 
  Sparkles, 
  DownloadCloud, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  Package
} from 'lucide-react';
import { type UpdateInfo, executePreUpdateShield, openExternalUrl } from '@/services/updateService';
import { toast } from '@/components/ui/toast';

interface UpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateInfo | null;
  currentUserId?: string | null;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  onOpenChange,
  updateInfo,
  currentUserId,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [downloadCompleted, setDownloadCompleted] = useState(false);

  if (!updateInfo) return null;

  const handleUpdate = async () => {
    const downloadUrl = updateInfo.setupAsset?.downloadUrl || updateInfo.releaseUrl;

    setIsProcessing(true);
    setDownloadCompleted(false);

    try {
      // Step 1: Pre-update shield
      setProcessStep('Đang lưu trữ và đồng bộ an toàn dữ liệu học tập lên Cloud...');
      const backupOk = await executePreUpdateShield(currentUserId);
      if (!backupOk) {
        toast.warning('Không thể kết nối Cloud, dữ liệu đã được lưu cục bộ an toàn.');
      } else {
        toast.success('Dữ liệu và tiến độ học tập đã được bảo vệ tuyệt đối!');
      }

      // Step 2: Open download stream
      setProcessStep('Bắt đầu tải bộ cài đặt mới...');
      await openExternalUrl(downloadUrl);

      setDownloadCompleted(true);
      setProcessStep('Đã mở tải file cập nhật!');
    } catch (err) {
      console.error('Update failed:', err);
      toast.error('Có lỗi xảy ra khi bắt đầu cập nhật.');
      setProcessStep('Lỗi khởi động tải xuống.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewOnGitHub = async () => {
    await openExternalUrl(updateInfo.releaseUrl);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
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

          <div className="max-h-44 overflow-y-auto rounded-2xl border border-border bg-muted/40 p-3.5 text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-line select-text">
            {updateInfo.releaseNotes || 'Bản cập nhật cải thiện tính năng, bổ sung nút nộp bài và tối ưu độ ổn định hệ thống.'}
          </div>
        </div>

        {/* Status progress indicator when updating */}
        {isProcessing && (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 flex items-center gap-3 animate-in fade-in">
            <Loader2 className="size-5 text-primary animate-spin shrink-0" />
            <span className="text-xs font-bold text-primary">{processStep}</span>
          </div>
        )}

        {downloadCompleted && !isProcessing && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                Đã mở trình tải tệp cài đặt thành công!
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Sau khi tệp tải về, bạn chỉ cần mở file để cài đặt đè. Toàn bộ tài khoản và tiến độ học tập sẽ được giữ nguyên 100%.
              </p>
            </div>
          </div>
        )}

        {/* Primary 1-Click Update Action Card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Bản Cài Đặt Chính Thức (Setup Installer)</span>
            </div>
            {updateInfo.setupAsset?.sizeFormatted && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                ~{updateInfo.setupAsset.sizeFormatted}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tự động cập nhật tệp ứng dụng, cập nhật shortcut Desktop và giữ nguyên vẹn 100% dữ liệu đã học.
          </p>

          <Button
            size="default"
            disabled={isProcessing}
            onClick={handleUpdate}
            className="w-full rounded-xl text-xs font-bold gap-2 cursor-pointer bg-gradient-to-r from-primary to-indigo-600 hover:opacity-95 text-white shadow-md h-10"
          >
            <DownloadCloud className="size-4" />
            <span>Cập nhật ngay (1-Click)</span>
          </Button>
        </div>

        <DialogFooter className="flex items-center justify-between pt-2 border-t border-border sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isProcessing}
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer rounded-xl"
          >
            Để sau
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleViewOnGitHub}
            className="text-xs font-semibold rounded-xl gap-1.5 cursor-pointer"
          >
            <span>Trang Releases GitHub</span>
            <ExternalLink className="size-3" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

