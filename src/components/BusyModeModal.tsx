import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Clock, 
  Volume2, 
  VolumeX, 
  Play, 
  Check, 
  Layers, 
  Info
} from 'lucide-react';
import { busyModeService, type BusyModeSettings } from '@/services/busyModeService';
import type { TopicConfig } from '@/types/quiz';
import { toast } from '@/components/ui/toast';

interface BusyModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTopics: TopicConfig[];
}

const PRESET_INTERVALS = [1, 2, 3, 5, 10, 15, 30];

export const BusyModeModal: React.FC<BusyModeModalProps> = ({
  open,
  onOpenChange,
  availableTopics,
}) => {
  const [settings, setSettings] = useState<BusyModeSettings>(busyModeService.getSnapshot().settings);
  const [customInterval, setCustomInterval] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      const current = busyModeService.getSnapshot().settings;
      setSettings(current);
      if (!PRESET_INTERVALS.includes(current.intervalMinutes)) {
        setIsCustomMode(true);
        setCustomInterval(String(current.intervalMinutes));
      } else {
        setIsCustomMode(false);
        setCustomInterval('');
      }
    }
  }, [open]);

  const handleToggleEnabled = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
  };

  const handleSelectPreset = (minutes: number) => {
    setIsCustomMode(false);
    setSettings((prev) => ({ ...prev, intervalMinutes: minutes }));
  };

  const handleCustomChange = (val: string) => {
    setCustomInterval(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setSettings((prev) => ({ ...prev, intervalMinutes: num }));
    }
  };

  const handleSaveAndApply = () => {
    let finalInterval = settings.intervalMinutes;
    if (isCustomMode) {
      const num = parseInt(customInterval, 10);
      if (isNaN(num) || num < 1) {
        toast.warning('Vui lòng nhập chu kỳ tối thiểu từ 1 phút.');
        return;
      }
      finalInterval = num;
    }

    busyModeService.updateSettings({
      ...settings,
      intervalMinutes: finalInterval,
    });

    if (settings.enabled) {
      toast.success(`Đã kích hoạt Busy Mode: Cứ sau ${finalInterval} phút sẽ hiện 1 câu hỏi!`);
    } else {
      toast.info('Đã tắt Busy Mode.');
    }
    onOpenChange(false);
  };

  const handleTestNow = async () => {
    let finalInterval = settings.intervalMinutes;
    if (isCustomMode) {
      const num = parseInt(customInterval, 10);
      if (!isNaN(num) && num > 0) finalInterval = num;
    }

    busyModeService.updateSettings({
      ...settings,
      intervalMinutes: finalInterval,
    });

    toast.info('Đang mở câu hỏi ở góc dưới màn hình...');
    await busyModeService.triggerQuestionNow(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border bg-card p-6 shadow-2xl rounded-3xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
              <Zap className="size-5 fill-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                Chế độ Người bận rộn
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold">
                  Busy Mode
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Tự động hiện 1 câu trắc nghiệm ở góc dưới màn hình theo chu kỳ bạn cài đặt.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Main Power Switch */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/40">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-foreground">
                Trạng thái hoạt động
              </div>
              <p className="text-xs text-muted-foreground">
                {settings.enabled ? 'Đang bật — Định kỳ hiển thị câu hỏi' : 'Đang tạm dừng'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => handleToggleEnabled(!settings.enabled)}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.enabled ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Interval Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                Chu kỳ xuất hiện câu hỏi
              </span>
              <span className="text-primary font-mono font-bold">
                {isCustomMode ? `${customInterval || 0} phút` : `${settings.intervalMinutes} phút`}
              </span>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {PRESET_INTERVALS.map((mins) => {
                const isSelected = !isCustomMode && settings.intervalMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPreset(mins)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mins}p
                  </button>
                );
              })}
            </div>

            {/* Custom Interval Option */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCustomMode(true);
                  if (!customInterval) setCustomInterval('7');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  isCustomMode
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                Tùy chỉnh số phút
              </button>

              {isCustomMode && (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={customInterval}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    placeholder="Nhập phút"
                    className="w-24 h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-mono font-bold text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                  <span className="text-xs text-muted-foreground">phút một lần</span>
                </div>
              )}
            </div>
          </div>

          {/* Topic Scope Selector */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Chủ đề câu hỏi xuất hiện
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableTopics.map((topic) => {
                const isSelected = settings.topicId === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, topicId: topic.id }))}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary/40'
                        : 'border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{topic.icon}</span>
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </div>
                    <span className="text-xs font-bold truncate">{topic.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Chime Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-muted/20">
            <div className="flex items-center gap-2.5">
              {settings.soundEnabled ? (
                <Volume2 className="size-4 text-emerald-500" />
              ) : (
                <VolumeX className="size-4 text-muted-foreground" />
              )}
              <div className="text-xs font-medium text-foreground">
                Âm thanh thông báo nhẹ khi câu hỏi xuất hiện
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              onClick={() => setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.soundEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* User Guide Box */}
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[11.5px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Cách hoạt động:</strong> Popup hiện ở góc phải dưới (ngay trên taskbar). Bạn chỉ cần chọn đáp án, xem kết quả và popup sẽ tự tắt sau 10 giây (hoặc bấm đóng ngay) để không ngắt quãng công việc.
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border">
          {/* Test Immediately Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestNow}
            className="w-full sm:w-auto h-9 px-3.5 rounded-xl border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold gap-1.5 cursor-pointer shadow-2xs"
          >
            <Play className="size-3.5 fill-current" />
            <span>Hiện thử câu hỏi ngay</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Đóng
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAndApply}
              className="h-9 px-4 rounded-xl text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              Lưu & Áp dụng
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
