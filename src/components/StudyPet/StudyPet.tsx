import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/lib/theme';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Sparkles, 
  RotateCcw,
  ArrowRightLeft,
  Maximize2,
  Minimize2,
  Minus
} from 'lucide-react';

export type PetTheme = 'forest' | 'beach' | 'castle' | 'winter' | 'autumn' | 'none';
export type PetSize = 'nano' | 'small' | 'medium' | 'large';
export type PetPosition = 'right' | 'left';
export type HabitatScale = 'small' | 'medium' | 'large';

export interface StudyPetSettings {
  enabled: boolean;
  minimized?: boolean;
  habitatScale?: HabitatScale;
  petType: string;
  petColor?: string;
  theme?: PetTheme;
  petSize?: PetSize;
  position: PetPosition;
  disableEffects?: boolean;
}

export const STORAGE_KEY = 'quiz_study_pet_settings';

export const DEFAULT_PET_SETTINGS: StudyPetSettings = {
  enabled: true,
  minimized: false,
  habitatScale: 'small',
  petType: 'dog',
  petColor: 'akita',
  theme: 'forest',
  petSize: 'medium',
  position: 'right',
  disableEffects: false,
};

export interface PetCatalogItem {
  id: string;
  name: string;
  icon: string;
  vscodeType: string;
  defaultColor: string;
  colors: string[];
}

export const PET_CATALOG: PetCatalogItem[] = [
  { id: 'dog', name: 'Cún Shiba / Akita', icon: '🐕', vscodeType: 'dog', defaultColor: 'akita', colors: ['akita', 'brown', 'black', 'white', 'red'] },
  { id: 'duck', name: 'Vịt Vàng Quack', icon: '🦆', vscodeType: 'rubber-duck', defaultColor: 'yellow', colors: ['yellow'] },
  { id: 'fox', name: 'Cáo Đỏ Tinh Nghịch', icon: '🦊', vscodeType: 'fox', defaultColor: 'red', colors: ['red', 'white'] },
  { id: 'totoro', name: 'Totoro Rừng Xanh', icon: '🍃', vscodeType: 'totoro', defaultColor: 'gray', colors: ['gray'] },
  { id: 'crab', name: 'Cua Biển Nhí Nhảnh', icon: '🦀', vscodeType: 'crab', defaultColor: 'red', colors: ['red'] },
  { id: 'chicken', name: 'Gà Con Lon Ton', icon: '🐔', vscodeType: 'chicken', defaultColor: 'brown', colors: ['brown', 'gray', 'white'] },
  { id: 'panda', name: 'Gấu Trúc Panda', icon: '🐼', vscodeType: 'panda', defaultColor: 'black', colors: ['black'] },
  { id: 'raccoon', name: 'Gấu Mèo Raccoon', icon: '🦝', vscodeType: 'raccoon', defaultColor: 'gray', colors: ['gray'] },
  { id: 'turtle', name: 'Rùa Biển Điềm Tĩnh', icon: '🐢', vscodeType: 'turtle', defaultColor: 'green', colors: ['green'] },
  { id: 'clippy', name: 'Kẹp Giấy Huyền Thoại', icon: '📎', vscodeType: 'clippy', defaultColor: 'green', colors: ['green', 'yellow', 'black'] },
  { id: 'deno', name: 'Khủng Long Deno', icon: '🦖', vscodeType: 'deno', defaultColor: 'green', colors: ['green'] },
  { id: 'horse', name: 'Ngựa Chiến Oai Vệ', icon: '🐎', vscodeType: 'horse', defaultColor: 'brown', colors: ['brown', 'white', 'black'] },
  { id: 'rocky', name: 'Hòn Đá Cưng Rocky', icon: '🪨', vscodeType: 'rocky', defaultColor: 'gray', colors: ['gray'] },
  { id: 'skeleton', name: 'Bộ Xương Khiêu Vũ', icon: '💀', vscodeType: 'skeleton', defaultColor: 'white', colors: ['white'] },
  { id: 'zappy', name: 'Zappy Tia Chớp', icon: '⚡', vscodeType: 'zappy', defaultColor: 'yellow', colors: ['yellow'] },
  { id: 'capybara', name: 'Capybara Đội Cam', icon: '🦫', vscodeType: 'capybara', defaultColor: 'brown', colors: ['brown'] },
];

export const THEME_CATALOG: Array<{ id: PetTheme; name: string; icon: string; desc: string }> = [
  { id: 'forest', name: 'Rừng Thông', icon: '🌲', desc: 'Rừng xanh tĩnh lặng với bầu trời sao' },
  { id: 'beach', name: 'Bãi Biển', icon: '🏖️', desc: 'Bờ cát vàng và sóng biển êm dịu' },
  { id: 'castle', name: 'Lâu Đài Cổ', icon: '🏰', desc: 'Thành trì kiên cố phong cách trung cổ' },
  { id: 'winter', name: 'Mùa Đông', icon: '❄️', desc: 'Xứ sở băng tuyết với hoa tuyết rơi' },
  { id: 'autumn', name: 'Mùa Thu', icon: '🍂', desc: 'Khu rừng mùa thu với lá vàng bay' },
  { id: 'none', name: 'Tối Giản', icon: '⬛', desc: 'Nền trong suốt không cảnh quan' },
];

const ENCOURAGING_TIPS = [
  'Cố lên bạn ơi, chứng chỉ trong tầm tay! 🎯',
  'Hôm nay học chăm chỉ quá ta! ✨',
  'Cứ bình tĩnh, làm chắc từng câu một nhé! 🧠',
  'Chill một chút rồi ôn tiếp nào 🍵',
  'Uống ngụm nước cho tỉnh táo nha! 💧',
  'Nhấp vào sân chơi để ném bóng cho pet nhặt! 🎾',
];

export const StudyPet: React.FC = () => {
  const { isDark } = useTheme();
  const [settings, setSettings] = useState<StudyPetSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_PET_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PET_SETTINGS;
  });

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync settings when modified
  const updateSettings = useCallback((newSettings: Partial<StudyPetSettings>, broadcast = false) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      if (broadcast) {
        window.dispatchEvent(new CustomEvent('quiz_toggle_pet', { detail: updated }));
      }
      return updated;
    });
  }, []);

  // Listen to global custom toggle events from Header
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<StudyPetSettings>>;
      if (customEvent.detail) {
        updateSettings(customEvent.detail);
      } else {
        updateSettings({ enabled: !settings.enabled });
      }
    };
    window.addEventListener('quiz_toggle_pet', handleToggle);
    return () => window.removeEventListener('quiz_toggle_pet', handleToggle);
  }, [settings.enabled, updateSettings]);

  // Rotate encouraging tip every 15s
  useEffect(() => {
    try {
      localStorage.removeItem('quiz_vscode_pets_runtime_state');
    } catch {}
    const timer = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % ENCOURAGING_TIPS.length);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic window space check: hides automatically when window is shrunk
  const [hasSufficientSpace, setHasSufficientSpace] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1400 && window.innerHeight >= 580;
  });

  useEffect(() => {
    const handleResize = () => {
      setHasSufficientSpace(window.innerWidth >= 1400 && window.innerHeight >= 580);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Send action message to iframe
  const postToPetIframe = useCallback((command: string, extraData: Record<string, unknown> = {}) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ command, ...extraData }, '*');
    }
  }, []);

  // Throw Ball action
  const handleThrowBall = () => {
    postToPetIframe('throw-ball');
  };

  // Reset pets action -> cleans extra pets, leaving exactly 1 primary pet
  const handleResetPets = () => {
    postToPetIframe('reset-pet', {
      type: currentPetDef.vscodeType,
      color: iframePetColor,
      name: currentPetDef.name.split(' ')[0],
    });
  };

  // Cycle Habitat theme
  const handleCycleTheme = () => {
    const currentIndex = THEME_CATALOG.findIndex((t) => t.id === (settings.theme || 'forest'));
    const nextIndex = (currentIndex + 1) % THEME_CATALOG.length;
    updateSettings({ theme: THEME_CATALOG[nextIndex].id });
  };

  // Toggle weather atmospheric effects
  const handleToggleEffects = () => {
    const newDisabled = !settings.disableEffects;
    updateSettings({ disableEffects: newDisabled });
    postToPetIframe('disable-effects', { disabled: newDisabled });
  };

  // Swap Corner position: Left <-> Right
  const handleTogglePosition = () => {
    const nextPos: PetPosition = settings.position === 'left' ? 'right' : 'left';
    updateSettings({ position: nextPos }, true);
  };

  // Cycle Habitat Scale: small (285px) -> medium (390px) -> large (500px)
  const currentScale: HabitatScale = settings.habitatScale || 'small';
  const handleCycleScale = () => {
    const nextScale: HabitatScale =
      currentScale === 'small' ? 'medium' : currentScale === 'medium' ? 'large' : 'small';
    updateSettings({ habitatScale: nextScale, minimized: false }, true);
  };

  // Toggle Minimized to Mini Dock Pill
  const handleToggleMinimize = () => {
    updateSettings({ minimized: !settings.minimized }, true);
  };

  // Close / Hide Habitat
  const handleClose = () => {
    updateSettings({ enabled: false }, true);
  };

  if (!settings.enabled || !hasSufficientSpace) return null;

  const currentPetDef = PET_CATALOG.find((p) => p.id === settings.petType) || PET_CATALOG[0];
  const currentThemeDef = THEME_CATALOG.find((t) => t.id === (settings.theme || 'forest')) || THEME_CATALOG[0];

  // Construct iframe source URL
  const iframeTheme = settings.theme || 'forest';
  const iframeThemeKind = isDark ? 2 : 1;
  const iframePetType = currentPetDef.vscodeType;
  const iframePetColor = settings.petColor && currentPetDef.colors.includes(settings.petColor) ? settings.petColor : currentPetDef.defaultColor;
  const iframePetSize = settings.petSize || 'medium';
  const iframeDisableEffects = !!settings.disableEffects;

  const iframeSrc = `/vscode-pets/index.html?theme=${iframeTheme}&themeKind=${iframeThemeKind}&petType=${iframePetType}&petColor=${iframePetColor}&petSize=${iframePetSize}&disableEffects=${iframeDisableEffects}`;

  const positionClass = settings.position === 'left' ? 'left-4' : 'right-4';

  // Render Compact Mini Dock Pill when minimized
  if (settings.minimized) {
    return (
      <div
        aria-label="Thú cưng đang thu gọn"
        className={`fixed bottom-3 ${positionClass} z-20 hidden min-[1400px]:flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-border/70 dark:border-slate-800 bg-card/90 dark:bg-slate-950/85 backdrop-blur-md shadow-lg select-none cursor-pointer hover:border-primary/50 transition-all pointer-events-auto group`}
        onClick={() => updateSettings({ minimized: false }, true)}
      >
        <span className="text-sm">{currentPetDef.icon}</span>
        <span className="text-xs font-bold text-foreground">{currentPetDef.name.split(' ')[0]}</span>
        <span className="text-[10px] text-muted-foreground font-mono">Thu gọn</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateSettings({ minimized: false }, true);
          }}
          title="Mở rộng sân chơi ⤢"
          className="size-5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
        >
          <Maximize2 className="size-3 text-primary" />
        </button>
      </div>
    );
  }

  // Multi-level dimensions
  const widthClass =
    currentScale === 'small'
      ? 'w-[285px]'
      : currentScale === 'medium'
      ? 'w-[390px]'
      : 'w-[500px] sm:w-[520px]';

  const iframeHeightClass =
    currentScale === 'small'
      ? 'h-[165px]'
      : currentScale === 'medium'
      ? 'h-[225px]'
      : 'h-[280px]';

  const scaleTitle =
    currentScale === 'small'
      ? 'Kích thước: Nhỏ 285px (Không che bài) • Bấm để phóng to Vừa'
      : currentScale === 'medium'
      ? 'Kích thước: Vừa 390px • Bấm để phóng to Lớn'
      : 'Kích thước: Lớn 500px (Full view) • Bấm để thu nhỏ';

  return (
    <div
      aria-label="Thú cưng đồng hành"
      className={`fixed bottom-3 ${positionClass} z-20 hidden min-[1400px]:flex flex-col ${widthClass} rounded-2xl border border-border/60 dark:border-slate-800/90 bg-card/90 dark:bg-slate-950/80 backdrop-blur-md p-3 shadow-xl transition-all duration-300 space-y-2 select-none group pointer-events-auto`}
    >
      {/* Top Micro-Toolbar */}
      <div className="flex items-center justify-between gap-1 text-xs relative z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-bold border-emerald-300/60 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 bg-white/70 dark:bg-emerald-950/40 px-2 py-0.5"
          >
            {currentPetDef.icon} {currentPetDef.name.split(' ')[0]}
          </Badge>
          <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase">
            {currentScale === 'small' ? 'Nhỏ' : currentScale === 'medium' ? 'Vừa' : 'To'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Swap Corner: Left <-> Right */}
          <button
            type="button"
            onClick={handleTogglePosition}
            title={`Chuyển sang góc ${settings.position === 'left' ? 'phải' : 'trái'} ⇄`}
            className="size-6 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-border/60 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <ArrowRightLeft className="size-3" />
          </button>

          {/* Multi-level Scale Cycler: Small -> Medium -> Large */}
          <button
            type="button"
            onClick={handleCycleScale}
            title={scaleTitle}
            className="size-6 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-border/60 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            {currentScale === 'large' ? (
              <Minimize2 className="size-3 text-amber-500" />
            ) : (
              <Maximize2 className="size-3 text-primary" />
            )}
          </button>

          {/* Minimize to Mini Dock Pill */}
          <button
            type="button"
            onClick={handleToggleMinimize}
            title="Thu gọn thành thanh mini dock (Tránh che bài khi học) ─"
            className="size-6 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-border/60 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <Minus className="size-3" />
          </button>

          {/* Cycle Theme */}
          <button
            type="button"
            onClick={handleCycleTheme}
            title={`Đổi khung cảnh (${currentThemeDef.name}) 🌲`}
            className="size-6 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-border/60 text-xs flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer shadow-2xs"
          >
            <span>{currentThemeDef.icon}</span>
          </button>

          {/* Throw Ball */}
          <button
            type="button"
            onClick={handleThrowBall}
            title="Ném bóng cho thú cưng 🎾"
            className="size-6 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
          >
            <span>🎾</span>
          </button>

          {/* Reset Pets */}
          <button
            type="button"
            onClick={handleResetPets}
            title="Đặt lại vị trí (1 thú cưng) 🔄"
            className="size-6 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-border/60 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <RotateCcw className="size-3" />
          </button>

          {/* Weather Sparkles */}
          <button
            type="button"
            onClick={handleToggleEffects}
            title={settings.disableEffects ? 'Bật hiệu ứng thời tiết' : 'Tắt hiệu ứng thời tiết'}
            className="size-6 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-border/60 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
          >
            <Sparkles className={`size-3 ${settings.disableEffects ? 'opacity-30' : 'text-amber-400'}`} />
          </button>

          {/* Close / Hide */}
          <button
            type="button"
            onClick={handleClose}
            title="Tạm ẩn thú cưng (Bật lại từ nút Pets trên thanh điều hướng)"
            className="size-6 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors ml-0.5"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Main Habitat Iframe View */}
      <div className={`relative w-full ${iframeHeightClass} rounded-xl overflow-hidden border border-border/40 dark:border-slate-800/80 shadow-inner bg-background/40 transition-all duration-300`}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Study Pet Habitat"
          className="w-full h-full border-0 select-none block"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Encouraging Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
        <span className="flex items-center gap-1.5 truncate">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate">{ENCOURAGING_TIPS[currentTipIndex]}</span>
        </span>
      </div>
    </div>
  );
};
