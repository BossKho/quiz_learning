import React, { useState, useRef } from 'react';
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
  Download, 
  Upload, 
  CheckCircle2, 
  FileJson, 
  ArrowRightLeft, 
  AlertTriangle, 
  Loader2,
  Check,
  Laptop,
  Home,
  Trash2
} from 'lucide-react';
import { dbService } from '@/services/db';

interface SyncProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: {
    totalQuestions: number;
    mastered: number;
    learning: number;
    bookmarked: number;
    completedSessions: number;
  };
  onSyncComplete: () => Promise<void>;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  open,
  onOpenChange,
  stats,
  onSyncComplete,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'overwrite'>('merge');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear all temporary import states and file input
  const resetImportState = () => {
    setImportFileContent(null);
    setImportSummary(null);
    setStatusMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Ensure state is completely wiped whenever modal opens or closes
  React.useEffect(() => {
    if (!open) {
      resetImportState();
    }
  }, [open]);

  // Handle Export
  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const jsonStr = await dbService.exportProgressJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `quiz_progress_${dateStr}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `Đã xuất thành công file ${filename}. Hãy copy file này sang máy khác!`,
      });
    } catch (err: any) {
      console.error('Export failed:', err);
      setStatusMessage({ type: 'error', text: 'Xuất file thất bại: ' + (err.message || String(err)) });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection with rigorous error checks
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.json')) {
      resetImportState();
      setStatusMessage({
        type: 'error',
        text: 'File đã chọn không có định dạng .json. Vui lòng chọn đúng file sao lưu tiến độ.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      resetImportState();
      setStatusMessage({
        type: 'error',
        text: 'Lỗi thiết bị: Không thể đọc nội dung file. Vui lòng thử lại.',
      });
    };

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim() === '') {
          throw new Error('File JSON hoàn toàn trống (0 bytes).');
        }

        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr: any) {
          throw new Error('File bị lỗi cú pháp JSON: ' + (jsonErr.message || 'Cú pháp không hợp lệ'));
        }

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Cấu trúc file JSON không đúng đối tượng sao lưu tiến trình.');
        }

        if (!parsed.question_stats || !Array.isArray(parsed.question_stats)) {
          throw new Error('File không chứa danh sách tiến độ câu hỏi (thiếu trường question_stats). Hãy chắc chắn bạn chọn đúng file quiz_progress*.json.');
        }

        if (parsed.question_stats.length > 0) {
          const sample = parsed.question_stats[0];
          if (sample.question_id === undefined || sample.leitner_box === undefined) {
            throw new Error('Dữ liệu question_stats trong file không khớp với cấu trúc hệ thống.');
          }
        }

        setImportFileContent(text);
        setImportSummary({
          fileName: file.name,
          exportedAt: parsed.exported_at_iso ? new Date(parsed.exported_at_iso).toLocaleString('vi-VN') : 'Không rõ ngày',
          statsCount: parsed.question_stats.length,
          sessionsCount: (parsed.active_sessions || []).length,
          mastered: parsed.stats_summary?.mastered || 0,
        });
      } catch (err: any) {
        resetImportState();
        setStatusMessage({ type: 'error', text: 'Kiểm tra file thất bại: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  // Handle Import Apply
  const handleApplyImport = async () => {
    if (!importFileContent) return;

    setIsImporting(true);
    setStatusMessage(null);
    try {
      const res = await dbService.importProgressJSON(importFileContent, mergeMode);
      await onSyncComplete();
      setStatusMessage({
        type: 'success',
        text: `Đồng bộ thành công! Đã cập nhật ${res.importedStats} câu hỏi và ${res.importedSessions} phiên làm bài.`,
      });
      resetImportState();
    } catch (err: any) {
      console.error('Import failed:', err);
      setStatusMessage({ type: 'error', text: 'Nhập dữ liệu thất bại: ' + (err.message || String(err)) });
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetAll = async () => {
    setIsImporting(true);
    try {
      await dbService.resetAllProgress();
      await onSyncComplete();
      resetImportState();
      setStatusMessage({
        type: 'success',
        text: 'Đã xóa toàn bộ tiến trình học và các bài thi dở dang thành công (Về 0)!',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Đặt lại thất bại: ' + (err.message || String(err)) });
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenChangeInternal = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetImportState();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 rounded-3xl bg-card border-border/80 shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ArrowRightLeft className="size-4 text-primary" />
            Đồng bộ đa thiết bị
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
            Sao lưu & Đồng bộ tiến độ (JSON)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Dùng 1 file <strong className="text-foreground font-mono">quiz_progress.json</strong> để chuyển tiến trình học giữa máy tính ở nhà và máy tính công ty.
          </DialogDescription>
        </DialogHeader>

        {statusMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {/* SECTION 1: EXPORT */}
          <div className="p-4.5 rounded-2xl border border-border/80 bg-muted/20 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Download className="size-4 text-blue-500" />
                  1. Xuất tiến độ (Máy hiện tại)
                </span>
                <Badge variant="outline" className="text-[9.5px] font-mono border-blue-500/30 text-blue-400">
                  EXPORT
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tạo bản sao lưu toàn bộ thứ hạng Hộp Leitner, danh sách bookmark và các bài thi đang làm dở.
              </p>

              {/* Current stats preview */}
              <div className="p-3 rounded-xl bg-card border border-border/60 text-[11px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đã thuộc (Mastered):</span>
                  <span className="font-bold text-emerald-400">{stats.mastered} câu</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đang ôn luyện:</span>
                  <span className="font-bold text-amber-400">{stats.learning} câu</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đã đánh dấu bookmark:</span>
                  <span className="font-bold text-sky-400">{stats.bookmarked} câu</span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang đóng gói file...
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  Xuất file quiz_progress.json
                </>
              )}
            </Button>
          </div>

          {/* SECTION 2: IMPORT */}
          <div className="p-4.5 rounded-2xl border border-border/80 bg-muted/20 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Upload className="size-4 text-emerald-500" />
                  2. Nhập tiến độ (Từ máy khác)
                </span>
                <Badge variant="outline" className="text-[9.5px] font-mono border-emerald-500/30 text-emerald-400">
                  IMPORT
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Nạp file tiến độ bạn vừa copy từ máy nhà hoặc máy công ty để đồng bộ kết quả học.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="sync-file-input"
              />

              <label
                htmlFor="sync-file-input"
                className="flex flex-col items-center justify-center p-3.5 border border-dashed border-border/90 hover:border-emerald-500/60 rounded-xl cursor-pointer bg-card/60 hover:bg-card transition-all text-center space-y-1 group"
              >
                <FileJson className="size-6 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                <span className="text-xs font-bold text-foreground">
                  {importSummary ? importSummary.fileName : 'Bấm để chọn file .json'}
                </span>
                <span className="text-[10px] text-muted-foreground">Hỗ trợ file quiz_progress*.json</span>
              </label>

              {/* Preview file info */}
              {importSummary && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] space-y-1 text-emerald-400 font-mono animate-in fade-in relative">
                  <div className="flex justify-between items-center pb-1 border-b border-emerald-500/20 mb-1">
                    <span className="font-bold text-foreground truncate max-w-[200px]">{importSummary.fileName}</span>
                    <button
                      type="button"
                      onClick={resetImportState}
                      className="text-[10px] text-destructive hover:underline font-sans font-semibold cursor-pointer"
                    >
                      ✕ Hủy file này
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời gian xuất:</span>
                    <span className="font-bold text-foreground">{importSummary.exportedAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số câu có dữ liệu:</span>
                    <span className="font-bold">{importSummary.statsCount} câu</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số câu Mastered:</span>
                    <span className="font-bold">{importSummary.mastered} câu</span>
                  </div>
                </div>
              )}
            </div>

            {importSummary ? (
              <div className="space-y-2">
                {/* Merge options */}
                <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => setMergeMode('merge')}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      mergeMode === 'merge'
                        ? 'border-emerald-500 bg-emerald-500/15 text-foreground font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span>⚡ Hợp nhất (Merge)</span>
                    <span className="block text-[9px] opacity-75 mt-0.5">Giữ kết quả cao nhất</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMergeMode('overwrite')}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      mergeMode === 'overwrite'
                        ? 'border-red-500 bg-red-500/15 text-foreground font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span>🔄 Ghi đè (Overwrite)</span>
                    <span className="block text-[9px] opacity-75 mt-0.5">Thay thế hoàn toàn</span>
                  </button>
                </div>

                <Button
                  type="button"
                  disabled={isImporting}
                  onClick={handleApplyImport}
                  className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Đang đồng bộ vào CSDL...
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5 stroke-[3]" />
                      Áp dụng tiến độ này
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 rounded-xl border-border/80 text-foreground font-semibold text-xs cursor-pointer active:scale-95"
              >
                Chọn file để nạp
              </Button>
            )}
          </div>
        </div>

        {/* Sync workflow tip */}
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-muted-foreground flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-primary shrink-0">
            <Home className="size-4" />
            <ArrowRightLeft className="size-3" />
            <Laptop className="size-4" />
          </div>
          <span>
            <strong>Mẹo:</strong> Sau khi học xong ở nhà, bấm <em>Xuất file</em> rồi gửi qua Zalo/Drive. Đến công ty, mở app và bấm <em>Nhập tiến độ</em> để học tiếp liền mạch mà không bị mất chuỗi bài!
          </span>
        </div>

        <DialogFooter className="sm:justify-between items-center pt-2 border-t border-border/40 gap-2">
          {(stats.mastered > 0 || stats.learning > 0 || stats.bookmarked > 0) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isImporting || isExporting}
              onClick={handleResetAll}
              className="text-xs h-9 px-3.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive font-semibold cursor-pointer active:scale-95 flex items-center gap-1.5"
              title="Xóa toàn bộ các câu đã học và các bài thi dở dang để làm lại từ đầu"
            >
              <Trash2 className="size-3.5" />
              <span>Xóa & Đặt lại về 0</span>
            </Button>
          ) : <div />}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 px-5 rounded-xl border-border/80 text-foreground font-semibold cursor-pointer active:scale-95"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

