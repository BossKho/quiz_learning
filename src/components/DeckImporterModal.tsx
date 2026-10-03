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
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Plus
} from 'lucide-react';
import { dbService } from '@/services/db';
import { toast } from '@/components/ui/toast';
import type { TopicConfig } from '@/types/quiz';

interface DeckImporterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTopics: TopicConfig[];
  onImportComplete: () => Promise<void>;
}

export const DeckImporterModal: React.FC<DeckImporterModalProps> = ({
  open,
  onOpenChange,
  availableTopics,
  onImportComplete,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>('fast_track');
  const [customTopicName, setCustomTopicName] = useState<string>('');
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState<boolean>(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out 'all' from topic choices
  const selectableTopics = availableTopics.filter((t) => t.id !== 'all');

  const resetState = () => {
    setSelectedFile(null);
    setParsedData(null);
    setIsParsing(false);
    setIsImporting(false);
    setErrorMessage(null);
    setIsCreatingNewTopic(false);
    setCustomTopicName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSelectedFile(file);
    setIsParsing(true);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMessage('Vui lòng chọn file có định dạng .json');
      setIsParsing(false);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMessage('Không thể đọc file từ thiết bị. Vui lòng thử lại.');
      setIsParsing(false);
    };

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim() === '') {
          throw new Error('Nội dung file JSON trống.');
        }

        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
          throw new Error('Cấu trúc file JSON không đúng.');
        }

        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error('File không chứa danh sách câu hỏi (thiếu trường questions hoặc mảng rỗng).');
        }

        // Auto detect category if included in json
        if (data.category_id) {
          setSelectedTopicId(data.category_id);
        }

        setParsedData({
          title: data.title || file.name.replace('.json', ''),
          source: data.source || 'Nhập từ file',
          questionCount: data.questions.length,
          sampleQuestion: data.questions[0]?.question || '',
          sampleVi: data.questions[0]?.vi?.question || '',
          raw: data,
        });
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi phân tích cú pháp JSON.');
        setParsedData(null);
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData?.raw) return;

    let targetCat = selectedTopicId;
    if (isCreatingNewTopic) {
      const trimmed = customTopicName.trim();
      if (!trimmed) {
        toast.warning('Vui lòng nhập tên cho chủ đề mới.');
        return;
      }
      targetCat = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const res = await dbService.importCustomDeck(parsedData.raw, targetCat);
      await onImportComplete();
      toast.success(`Đã nạp thành công bộ đề "${res.title}" (${res.count} câu hỏi)!`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Import deck failed:', err);
      setErrorMessage('Nạp bộ đề thất bại: ' + (err.message || String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 sm:p-7 rounded-3xl bg-card border-border shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Upload className="size-4" />
            Mở rộng nội dung học
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
            Nạp bộ đề mới
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Chọn file JSON chứa câu hỏi trắc nghiệm hoặc flashcard để nạp vào hệ thống.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Topic Assignment */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Gán vào chủ đề:</span>
              <button
                type="button"
                onClick={() => setIsCreatingNewTopic(!isCreatingNewTopic)}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                {isCreatingNewTopic ? 'Chọn chủ đề có sẵn' : '➕ Tạo chủ đề mới'}
              </button>
            </label>

            {isCreatingNewTopic ? (
              <Input
                placeholder="Nhập tên chủ đề mới (ví dụ: Tiếng Hàn, AWS, Python...)"
                value={customTopicName}
                onChange={(e) => setCustomTopicName(e.target.value)}
                className="h-10 text-xs rounded-xl border-border bg-background"
                autoFocus
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {selectableTopics.map((topic) => {
                  const isSelected = selectedTopicId === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 active:scale-95 ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-2xs font-bold'
                          : 'border-border/70 hover:border-border hover:bg-muted text-foreground text-xs font-medium'
                      }`}
                    >
                      <span className="text-base">{topic.icon}</span>
                      <span className="text-xs truncate">{topic.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* File Picker Zone */}
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 rounded-2xl p-6 text-center transition-all cursor-pointer group flex flex-col items-center justify-center space-y-2"
              >
                <div className="size-11 rounded-2xl bg-muted group-hover:bg-primary/15 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                  <FileJson className="size-5.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Bấm để chọn file JSON từ máy tính
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    Định dạng bộ đề chuẩn có trường "title" và mảng "questions"
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl border border-border bg-muted/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <FileJson className="size-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-foreground truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 text-primary cursor-pointer shrink-0"
                >
                  Đổi file
                </Button>
              </div>
            )}
          </div>

          {/* Parsing status */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Đang kiểm tra cấu trúc file JSON...</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Preview */}
          {parsedData && !isParsing && (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2.5 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Hợp lệ: {parsedData.title}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  {parsedData.questionCount} câu hỏi
                </Badge>
              </div>

              {parsedData.sampleQuestion && (
                <div className="text-[11px] text-muted-foreground bg-background/80 p-2.5 rounded-xl border border-border/50 line-clamp-2 italic">
                  "Câu mẫu: {parsedData.sampleQuestion}"
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
            className="text-xs h-9 px-4 rounded-xl cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleImport}
            disabled={!parsedData || isImporting || isParsing}
            className="text-xs h-9 px-5 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer active:scale-95 shadow-xs gap-1.5"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Đang nạp vào hệ thống...</span>
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                <span>Nạp bộ đề ngay</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
