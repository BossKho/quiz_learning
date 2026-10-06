import React, { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  FileJson, 
  ClipboardPaste, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Trash2,
  ArrowLeft,
  Info,
  Check
} from 'lucide-react';
import { dbService } from '@/services/db';
import { toast } from '@/components/ui/toast';
import type { TopicConfig } from '@/types/quiz';
import { 
  parseQuizText, 
  validateQuestion, 
  indexToLetter, 
  type ParsedDeckResult, 
  type ParsedQuestion 
} from '@/services/quiz-parser';

interface DeckImporterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTopics: TopicConfig[];
  onImportComplete: () => Promise<void>;
}

type ImportSourceTab = 'paste' | 'json';
type FilterStatusTab = 'all' | 'valid' | 'need_review';

export const DeckImporterModal: React.FC<DeckImporterModalProps> = ({
  open,
  onOpenChange,
  availableTopics,
  onImportComplete,
}) => {
  // Wizard Steps: 1 = Input selection, 2 = Review & Inspection Editor
  const [step, setStep] = useState<1 | 2>(1);
  const [sourceTab, setSourceTab] = useState<ImportSourceTab>('paste');

  // Metadata
  const [deckTitle, setDeckTitle] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('fast_track');
  const [customTopicName, setCustomTopicName] = useState<string>('');
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState<boolean>(false);

  // Raw inputs
  const [pastedText, setPastedText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Parsed Engine Results
  const [parsedDeck, setParsedDeck] = useState<ParsedDeckResult | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editor Filter Tab
  const [filterTab, setFilterTab] = useState<FilterStatusTab>('all');
  const [showUnparsedBlocks, setShowUnparsedBlocks] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out 'all' topic choice
  const selectableTopics = availableTopics.filter((t) => t.id !== 'all');

  const resetState = () => {
    setStep(1);
    setSourceTab('paste');
    setDeckTitle('');
    setPastedText('');
    setSelectedFile(null);
    setParsedDeck(null);
    setQuestions([]);
    setIsProcessing(false);
    setIsSaving(false);
    setErrorMessage(null);
    setFilterTab('all');
    setShowUnparsedBlocks(false);
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

  // Handle parsing from pasted text
  const handleParseText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Vui lòng dán nội dung câu hỏi vào khung nhập liệu.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = parseQuizText(pastedText, deckTitle || 'Bộ đề mới');
      if (result.questions.length === 0) {
        throw new Error('Không nhận diện được câu hỏi nào. Vui lòng kiểm tra định dạng đề thi.');
      }

      setParsedDeck(result);
      setQuestions(result.questions);
      if (!deckTitle && result.title) {
        setDeckTitle(result.title);
      }
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi phân tích cú pháp văn bản.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle JSON file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSelectedFile(file);
    setIsProcessing(true);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMessage('Vui lòng chọn file có định dạng .json');
      setIsProcessing(false);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMessage('Không thể đọc file từ thiết bị. Vui lòng thử lại.');
      setIsProcessing(false);
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
          throw new Error('File không chứa danh sách câu hỏi (thiếu trường questions).');
        }

        const title = data.title || file.name.replace('.json', '');
        setDeckTitle(title);
        if (data.category_id) {
          setSelectedTopicId(data.category_id);
        }

        // Convert raw json questions to ParsedQuestion format
        const convertedQuestions: ParsedQuestion[] = data.questions.map((q: any, idx: number) => {
          const rawQ: ParsedQuestion = {
            id: `json_q_${Date.now()}_${idx}`,
            questionNumber: idx + 1,
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options : [],
            answer: Array.isArray(q.answer) ? q.answer : [0],
            explanation: q.explanation || q.note || undefined,
            status: 'valid',
            warnings: [],
            signals: {
              questionDetected: true,
              optionsCount: Array.isArray(q.options) ? q.options.length : 0,
              answerDetected: true,
              answerFromSeparateKey: false,
              hasExplanation: Boolean(q.explanation || q.note),
            },
            rawText: JSON.stringify(q, null, 2),
          };

          const validation = validateQuestion(rawQ);
          return {
            ...rawQ,
            status: validation.status,
            warnings: validation.warnings,
          };
        });

        const validCount = convertedQuestions.filter((q) => q.status === 'valid').length;

        const deckResult: ParsedDeckResult = {
          title,
          totalQuestions: convertedQuestions.length,
          validCount,
          needReviewCount: convertedQuestions.length - validCount,
          questions: convertedQuestions,
          unparsedBlocks: [],
        };

        setParsedDeck(deckResult);
        setQuestions(convertedQuestions);
        setStep(2);
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi phân tích cú pháp JSON.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  // Question editing handlers
  const handleUpdateQuestionText = (index: number, newText: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], question: newText };
      const val = validateQuestion(target);
      updated[index] = { ...target, status: val.status, warnings: val.warnings };
      return updated;
    });
  };

  const handleToggleAnswerOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const target = updated[qIndex];
      let newAnswer: number[];

      const currentAnswers = target.answer || [];
      if (currentAnswers.includes(optIndex)) {
        newAnswer = currentAnswers.filter((a) => a !== optIndex);
      } else {
        // Single click selects this answer
        newAnswer = [optIndex];
      }

      const nextTarget: ParsedQuestion = {
        ...target,
        answer: newAnswer.length > 0 ? newAnswer : null,
      };

      const val = validateQuestion(nextTarget);
      updated[qIndex] = { ...nextTarget, status: val.status, warnings: val.warnings };
      return updated;
    });
  };

  const handleDeleteQuestion = (qIndex: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex));
  };

  // Compute live statistics
  const validQuestions = useMemo(() => questions.filter((q) => q.status === 'valid'), [questions]);
  const needReviewQuestions = useMemo(() => questions.filter((q) => q.status !== 'valid'), [questions]);

  const filteredQuestions = useMemo(() => {
    if (filterTab === 'valid') return validQuestions;
    if (filterTab === 'need_review') return needReviewQuestions;
    return questions;
  }, [filterTab, questions, validQuestions, needReviewQuestions]);

  // Save confirmed deck to SQLite database
  const handleSaveToDatabase = async () => {
    if (questions.length === 0) return;

    if (needReviewQuestions.length > 0 && validQuestions.length === 0) {
      toast.warning('Không có câu hỏi hợp lệ nào để lưu. Vui lòng hoàn thiện câu hỏi.');
      return;
    }

    let targetCat = selectedTopicId;
    if (isCreatingNewTopic) {
      const trimmed = customTopicName.trim();
      if (!trimmed) {
        toast.warning('Vui lòng nhập tên cho chủ đề mới.');
        return;
      }
      targetCat = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    }

    // Only commit valid questions to ensure database purity
    const questionsToSave = questions.filter((q) => q.status === 'valid');

    setIsSaving(true);
    try {
      const deckPayload = {
        title: deckTitle.trim() || 'Bộ đề mới',
        source: sourceTab === 'paste' ? 'Văn bản dán' : 'Tệp JSON',
        category_id: targetCat,
        questions: questionsToSave.map((q) => ({
          type: q.answer && q.answer.length > 1 ? 'multi' : 'single',
          question: q.question,
          options: q.options,
          answer: q.answer || [0],
          explanation: q.explanation || '',
          shuffle_options: true,
        })),
      };

      const res = await dbService.importCustomDeck(deckPayload, targetCat);
      await onImportComplete();
      toast.success(`Đã lưu thành công bộ đề "${res.title}" (${res.count} câu hỏi)!`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Lỗi lưu bộ đề:', err);
      toast.error('Lưu bộ đề thất bại: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`rounded-3xl bg-card border-border shadow-2xl transition-all duration-200 ${
        step === 1 ? 'sm:max-w-xl p-6 sm:p-7' : 'max-w-4xl w-[94vw] h-[88vh] p-5 sm:p-6 flex flex-col'
      }`}>
        {/* ========================================================================= */}
        {/* STEP 1: INPUT TAB & CONFIGURATION                                         */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-4">
            <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Upload className="size-4" />
                Mở rộng nội dung học
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
                Nạp bộ đề mới
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Dán đề thi từ Word/Web hoặc chọn file JSON để nạp vào hệ thống.
              </DialogDescription>
            </DialogHeader>

            {/* Input Method Switcher */}
            <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setSourceTab('paste'); setErrorMessage(null); }}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sourceTab === 'paste' 
                    ? 'bg-background text-primary shadow-xs font-bold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ClipboardPaste className="size-3.5" />
                <span>📋 Dán văn bản đề thi</span>
              </button>
              <button
                type="button"
                onClick={() => { setSourceTab('json'); setErrorMessage(null); }}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sourceTab === 'json' 
                    ? 'bg-background text-primary shadow-xs font-bold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileJson className="size-3.5" />
                <span>📁 Tệp JSON chuẩn</span>
              </button>
            </div>

            {/* Deck Title & Topic */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Tên bộ đề:
                </label>
                <Input
                  placeholder="Nhập tên đề (ví dụ: Đề thi thử số 1, Từ vựng chuyên ngành...)"
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  className="h-9 text-xs rounded-xl border-border bg-background"
                />
              </div>

              {/* Topic Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Chủ đề phân loại:</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewTopic(!isCreatingNewTopic)}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {isCreatingNewTopic ? 'Chọn chủ đề có sẵn' : '➕ Tạo chủ đề mới'}
                  </button>
                </label>

                {isCreatingNewTopic ? (
                  <Input
                    placeholder="Nhập tên chủ đề mới (ví dụ: Tiếng Hàn, AWS, Python...)"
                    value={customTopicName}
                    onChange={(e) => setCustomTopicName(e.target.value)}
                    className="h-9 text-xs rounded-xl border-border bg-background"
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
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 text-xs ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                              : 'border-border/70 hover:bg-muted text-foreground'
                          }`}
                        >
                          <span className="text-sm">{topic.icon}</span>
                          <span className="truncate">{topic.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Tab 1 Content: Paste Text */}
            {sourceTab === 'paste' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Nội dung đề thi (Copy & Paste):</span>
                  <span className="text-[10px] text-muted-foreground">Hỗ trợ câu 1.. A, B, C, D.. Đáp án: ..</span>
                </label>
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Dán văn bản đề thi vào đây, ví dụ:

Câu 1: Thủ đô của Việt Nam là gì?
A. TP. Hồ Chí Minh
B. Hà Nội
C. Đà Nẵng
D. Hải Phòng
Đáp án: B
Giải thích: Hà Nội là thủ đô từ năm 1976.`}
                  className="w-full text-xs font-mono p-3 rounded-xl border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/60 leading-relaxed"
                />
              </div>
            )}

            {/* Tab 2 Content: JSON Upload */}
            {sourceTab === 'json' && (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 rounded-2xl p-6 text-center transition-all cursor-pointer group flex flex-col items-center justify-center space-y-2"
                >
                  <div className="size-11 rounded-2xl bg-muted group-hover:bg-primary/15 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                    <FileJson className="size-5.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      {selectedFile ? selectedFile.name : 'Bấm để chọn file JSON từ máy tính'}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      Định dạng chuẩn có trường "title" và mảng "questions"
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Hủy
              </Button>
              {sourceTab === 'paste' && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleParseText}
                  disabled={isProcessing || !pastedText.trim()}
                  className="text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍 Phân tích cấu trúc đề</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: INSPECTION & REVIEW EDITOR                                        */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="flex flex-col h-full overflow-hidden space-y-3">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Quay lại</span>
                </Button>
                <div className="h-4 w-px bg-border/60" />
                <div>
                  <h3 className="text-sm font-black text-foreground truncate max-w-sm">
                    {deckTitle || 'Bộ đề mới'}
                  </h3>
                  <div className="text-[10px] text-muted-foreground">
                    Tổng số: {questions.length} câu hỏi nhận diện được
                  </div>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                    filterTab === 'all'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Tất cả ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('valid')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-medium ${
                    filterTab === 'valid'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                      : 'text-muted-foreground hover:text-emerald-600'
                  }`}
                >
                  <CheckCircle2 className="size-3" />
                  <span>Hợp lệ ({validQuestions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('need_review')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-medium ${
                    filterTab === 'need_review'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                      : 'text-muted-foreground hover:text-amber-600'
                  }`}
                >
                  <AlertTriangle className="size-3" />
                  <span>Cần sửa ({needReviewQuestions.length})</span>
                </button>
              </div>
            </div>

            {/* Unparsed noise notice if any */}
            {parsedDeck && parsedDeck.unparsedBlocks.length > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <Info className="size-3.5 text-primary" />
                  <span>Có {parsedDeck.unparsedBlocks.length} dòng/đoạn văn bản phụ được lọc bỏ tự động (tiêu đề, số trang).</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUnparsedBlocks(!showUnparsedBlocks)}
                  className="text-primary font-semibold hover:underline cursor-pointer"
                >
                  {showUnparsedBlocks ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                </button>
              </div>
            )}

            {showUnparsedBlocks && parsedDeck && (
              <div className="max-h-24 overflow-y-auto p-2 bg-muted/60 rounded-xl border border-border/60 text-[10px] font-mono text-muted-foreground shrink-0 space-y-1">
                {parsedDeck.unparsedBlocks.map((blk, idx) => (
                  <div key={idx} className="truncate">• {blk}</div>
                ))}
              </div>
            )}

            {/* Questions List (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredQuestions.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-xs">
                  <CheckCircle2 className="size-8 text-emerald-500/40 mb-2" />
                  <span>Không có câu hỏi nào trong danh mục lọc này.</span>
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const qIndex = questions.findIndex((item) => item.id === q.id);
                  const isValid = q.status === 'valid';

                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                        isValid
                          ? 'border-border/70 bg-card hover:border-border shadow-2xs'
                          : 'border-amber-500/40 bg-amber-500/5 shadow-xs'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            Câu {q.questionNumber || qIndex + 1}
                          </span>
                          {isValid ? (
                            <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 bg-emerald-500/10">
                              <CheckCircle2 className="size-3" />
                              <span>Hợp lệ</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1 bg-amber-500/10 font-bold">
                              <AlertTriangle className="size-3" />
                              <span>{q.warnings[0]?.message || 'Cần kiểm tra'}</span>
                            </Badge>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuestion(qIndex)}
                          className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Xóa câu này"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      {/* Question Text Field */}
                      <textarea
                        rows={2}
                        value={q.question}
                        onChange={(e) => handleUpdateQuestionText(qIndex, e.target.value)}
                        placeholder="Nội dung câu hỏi..."
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-border/70 bg-background/80 focus:ring-1 focus:ring-primary focus:outline-hidden resize-none leading-relaxed"
                      />

                      {/* Options Grid */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          Lựa chọn (bấm vào chữ cái để chọn đáp án đúng):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {q.options.map((optText, optIdx) => {
                            const isSelected = q.answer?.includes(optIdx) || false;
                            const letter = indexToLetter(optIdx);

                            return (
                              <div
                                key={optIdx}
                                onClick={() => handleToggleAnswerOption(qIndex, optIdx)}
                                className={`p-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer text-xs select-none ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs'
                                    : 'border-border/60 hover:border-border hover:bg-muted/40 text-foreground'
                                }`}
                              >
                                <div className={`size-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                  isSelected
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {isSelected ? <Check className="size-3" /> : letter}
                                </div>
                                <span className="truncate flex-1">{optText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 1-Click Quick Select for missing answer */}
                      {!isValid && (!q.answer || q.answer.length === 0) && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="size-3.5" />
                            Chưa có đáp án. Chọn nhanh:
                          </span>
                          <div className="flex items-center gap-1.5">
                            {q.options.map((_, optIdx) => (
                              <Button
                                key={optIdx}
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleAnswerOption(qIndex, optIdx)}
                                className="h-6 px-2 text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                              >
                                {indexToLetter(optIdx)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Explanation note if exists */}
                      {q.explanation && (
                        <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40 italic">
                          💡 Giải thích: {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="pt-2.5 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {validQuestions.length} câu hợp lệ
                </span>
                {needReviewQuestions.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2 font-medium">
                    ({needReviewQuestions.length} câu cần bổ sung đáp án)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-xs rounded-xl cursor-pointer"
                >
                  Sửa lại nguồn
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving || validQuestions.length === 0}
                  className="text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      <span>Lưu {validQuestions.length} câu vào thư viện</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
