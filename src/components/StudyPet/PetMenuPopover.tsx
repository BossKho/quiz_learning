import React, { useState, useRef, useEffect } from 'react';
import { PawPrint, Check } from 'lucide-react';
import { 
  PET_CATALOG, 
  THEME_CATALOG, 
  type StudyPetSettings, 
  type PetTheme,
  DEFAULT_PET_SETTINGS, 
  STORAGE_KEY 
} from './StudyPet';

export const PetMenuPopover: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<StudyPetSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_PET_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PET_SETTINGS;
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Sync state if changed from floating toolbar on Pet
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<StudyPetSettings>>;
      if (customEvent.detail) {
        setSettings((prev) => ({ ...prev, ...customEvent.detail }));
      }
    };
    window.addEventListener('quiz_toggle_pet', handleSync);
    return () => window.removeEventListener('quiz_toggle_pet', handleSync);
  }, []);

  const update = (partial: Partial<StudyPetSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent('quiz_toggle_pet', { detail: updated }));
  };

  const currentPet = PET_CATALOG.find((p) => p.id === settings.petType) || PET_CATALOG[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Sân chơi thú cưng 🐾"
        className={`h-9 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 active:scale-95 ${
          settings.enabled
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 ring-1 ring-amber-500/20'
            : 'border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="text-sm">{currentPet.icon}</span>
        <span className="hidden xl:inline">{settings.enabled ? currentPet.name.split(' ')[0] : 'Pets'}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
          {/* Header & Toggle Switch */}
          <div className="flex items-center justify-between pb-2 border-b border-border/80">
            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
              <PawPrint className="size-4 text-amber-500" />
              <span>Sân Chơi Thú Cưng</span>
            </div>
            <button
              type="button"
              onClick={() => update({ enabled: !settings.enabled, minimized: false })}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                settings.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {settings.enabled ? 'Đang bật' : 'Đang tắt'}
            </button>
          </div>

          {/* Theme Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-wider">
              Khung cảnh nền (Theme):
            </span>
            <div className="grid grid-cols-3 gap-1">
              {THEME_CATALOG.map((t) => {
                const isSelected = (settings.theme || 'forest') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ theme: t.id as PetTheme, enabled: true })}
                    className={`flex items-center gap-1 p-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span className="truncate">{t.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select Pet Type */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-wider">
              Bé thú cưng chính:
            </span>
            <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
              {PET_CATALOG.map((p) => {
                const isSelected = settings.petType === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update({ petType: p.id, petColor: p.defaultColor, enabled: true })}
                    className={`flex items-center justify-between p-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                        : 'hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{p.icon}</span>
                      <span>{p.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Habitat Size Selector */}
          <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium text-[11px]">Kích thước:</span>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => update({ habitatScale: 'small', minimized: false })}
                title="Nhỏ (285px - Vừa vặn trong lề màn hình, không chạm bài học)"
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  (settings.habitatScale || 'small') === 'small' && !settings.minimized
                    ? 'bg-card text-foreground shadow-2xs font-bold text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Nhỏ
              </button>
              <button
                type="button"
                onClick={() => update({ habitatScale: 'medium', minimized: false })}
                title="Vừa (390px)"
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  settings.habitatScale === 'medium' && !settings.minimized
                    ? 'bg-card text-foreground shadow-2xs font-bold text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Vừa
              </button>
              <button
                type="button"
                onClick={() => update({ habitatScale: 'large', minimized: false })}
                title="Lớn (500px - Chiêm ngưỡng toàn cảnh)"
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  settings.habitatScale === 'large' && !settings.minimized
                    ? 'bg-card text-foreground shadow-2xs font-bold text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Lớn
              </button>
            </div>
          </div>

          {/* Position Selector */}
          <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium text-[11px]">Vị trí góc:</span>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => update({ position: 'left' })}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  settings.position === 'left'
                    ? 'bg-card text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Trái
              </button>
              <button
                type="button"
                onClick={() => update({ position: 'right' })}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  settings.position === 'right'
                    ? 'bg-card text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Phải
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
