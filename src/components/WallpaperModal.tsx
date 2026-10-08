import React, { useState, useEffect, useRef } from 'react';
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
  wallpaperService, 
  type WallpaperSettings 
} from '@/services/wallpaperService';
import { 
  Upload, 
  Trash2, 
  Sliders, 
  Sparkles, 
  Check, 
  Eye,
  ImageIcon
} from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface WallpaperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WallpaperModal: React.FC<WallpaperModalProps> = ({ open, onOpenChange }) => {
  const [settings, setSettings] = useState<WallpaperSettings>(wallpaperService.getSettings());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return wallpaperService.subscribe((s) => {
      setSettings(s);
    });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF).');
      return;
    }

    setIsUploading(true);
    try {
      await wallpaperService.setWallpaperImage(file);
      toast.success('Đã cài đặt ảnh nền ứng dụng thành công!');
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải ảnh lên. Vui lòng thử lại với ảnh khác.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      await wallpaperService.removeWallpaper();
      toast.info('Đã gỡ ảnh nền, quay về giao diện nguyên bản.');
    } catch {
      toast.error('Lỗi khi gỡ ảnh nền.');
    }
  };

  const handleOpacityChange = (val: number) => {
    wallpaperService.updateDisplaySettings({ opacity: val });
  };

  const handleBlurChange = (val: number) => {
    wallpaperService.updateDisplaySettings({ blur: val });
  };

  const opacityPercent = Math.round(settings.opacity * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-3xl p-6 bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-mono text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-indigo-500/30">
              <Sparkles className="size-3.5" /> Giao diện thẩm mỹ
            </span>
            <Badge variant="outline" className="text-xs font-mono font-bold">
              Ambient Wallpaper
            </Badge>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
            <ImageIcon className="size-5 text-indigo-500" />
            Ảnh nền chìm toàn ứng dụng
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Chọn ảnh từ máy tính để hiển thị chìm mờ ảo phía sau các bài học và bộ đề. Bạn có thể kéo chỉnh độ mờ đục và hiệu ứng kính mờ theo ý thích.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Current Wallpaper Preview / Upload Box */}
          {settings.enabled && settings.imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-border shadow-inner group">
              <div
                className="w-full h-44 bg-cover bg-center transition-all duration-300"
                style={{
                  backgroundImage: `url(${settings.imageUrl})`,
                  opacity: Math.max(0.4, settings.opacity * 2), // Boost slightly in preview for clarity
                  filter: settings.blur > 0 ? `blur(${settings.blur}px)` : 'none',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3.5">
                <div className="text-white text-xs font-bold flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" /> Đang áp dụng nền chìm ({opacityPercent}%)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-3 text-xs font-bold rounded-xl cursor-pointer bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-md"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="size-3.5 mr-1.5" />
                    Đổi ảnh
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2.5 text-xs font-bold rounded-xl cursor-pointer"
                    onClick={handleRemove}
                    title="Gỡ ảnh nền"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer group text-center p-4 select-none"
            >
              <div className="size-11 rounded-2xl bg-indigo-500/15 group-hover:scale-110 text-indigo-500 flex items-center justify-center transition-transform shadow-xs">
                <Upload className="size-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">
                  Nhấp vào đây để chọn ảnh từ máy tính
                </div>
                <div className="text-[11px] text-muted-foreground font-medium">
                  Hỗ trợ PNG, JPG, WebP, và cả GIF động Lo-fi phong cảnh
                </div>
              </div>
            </div>
          )}

          {/* Sliders when wallpaper is active */}
          {settings.enabled && settings.imageUrl && (
            <div className="space-y-4 rounded-2xl bg-muted/40 p-4 border border-border/60">
              {/* Opacity Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-indigo-500" />
                    Độ chìm mờ ảo (Opacity)
                  </span>
                  <span className="font-mono font-bold text-primary">{opacityPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.55"
                  step="0.01"
                  value={settings.opacity}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 rounded-lg bg-muted"
                />
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(0.10)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      opacityPercent === 10 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    10% (Thoang thoảng)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(0.18)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      opacityPercent === 18 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    18% (Chuẩn thẩm mỹ)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(0.35)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      opacityPercent === 35 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    35% (Rõ nét)
                  </button>
                </div>
              </div>

              {/* Blur Slider */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Eye className="size-3.5 text-amber-500" />
                    Độ mờ hậu cảnh (Blur)
                  </span>
                  <span className="font-mono font-bold text-primary">{settings.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="1"
                  value={settings.blur}
                  onChange={(e) => handleBlurChange(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 rounded-lg bg-muted"
                />
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleBlurChange(0)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      settings.blur === 0 ? 'bg-amber-500 text-white border-amber-500' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    0px (Sắc nét)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlurChange(3)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      settings.blur === 3 ? 'bg-amber-500 text-white border-amber-500' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    3px (Kính mờ)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBlurChange(8)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      settings.blur === 8 ? 'bg-amber-500 text-white border-amber-500' : 'bg-card text-muted-foreground border-border'
                    }`}
                  >
                    8px (Lo-fi Soft)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-border/80">
          <span className="text-[11px] text-muted-foreground">
            Hiệu ứng áp dụng tức thì trên toàn bộ ứng dụng
          </span>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 font-bold cursor-pointer"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

