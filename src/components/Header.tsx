import React, { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Home, 
  Sun, 
  Moon,
  ArrowRightLeft,
  Zap,
  User as UserIcon,
  Flame,
  Cloud,
  LogOut,
  Sparkles,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { signOutUser } from '@/services/firebaseService';
import { toast } from '@/components/ui/toast';
import { CURRENT_APP_VERSION } from '@/services/updateService';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCommandPalette: () => void;
  onOpenSyncModal?: () => void;
  onOpenBusyModal?: () => void;
  busyEnabled?: boolean;
  busyInterval?: number;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
  onQuickSync?: () => Promise<void>;
  isSyncingCloud?: boolean;
  streakDays?: number;
  onCheckUpdates?: () => void;
  hasPendingUpdate?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCommandPalette,
  onOpenSyncModal,
  onOpenBusyModal,
  busyEnabled = false,
  busyInterval = 3,
  currentUser = null,
  onOpenAuthModal,
  onQuickSync,
  isSyncingCloud = false,
  streakDays = 1,
  onCheckUpdates,
  hasPendingUpdate = false,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    try {
      await signOutUser();
      toast.info('Đã đăng xuất khỏi tài khoản.');
      onNavigate('dashboard');
    } catch {
      toast.error('Đăng xuất thất bại.');
    }
  };

  const avatarDisplay = currentUser?.photoURL || '🧑‍💻';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 text-card-foreground backdrop-blur-md transition-colors shadow-2xs">
      <div className="flex h-15 items-center justify-between px-6 max-w-7xl mx-auto">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-7">
          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-3 cursor-pointer group select-none py-1"
          >
            {/* Logo Chữ K */}
            <div className="relative flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-[1.5px] border border-slate-700/60 shadow-md shadow-indigo-500/25 group-hover:shadow-indigo-500/45 group-hover:scale-105 transition-all duration-300">
              <div className="flex size-full items-center justify-center rounded-[14px] bg-slate-950/95 overflow-hidden">
                <svg viewBox="0 0 32 32" className="size-6" fill="none">
                  <defs>
                    <linearGradient id="flame-k-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                    <linearGradient id="flame-k-magenta" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                    <linearGradient id="flame-k-fire" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="45%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                    <filter id="flame-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#f97316" floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Left Cyber Spine */}
                  <path
                    d="M7 6h3.5v20H7l1.2-2V8L7 6z"
                    fill="url(#flame-k-cyan)"
                  />

                  {/* Lower Diagonal Leg */}
                  <path
                    d="M12.5 16l6.5 10h4.5l-8-12.5-3 2.5z"
                    fill="url(#flame-k-magenta)"
                  />

                  {/* Upper Diagonal Arm morphing into Fiery Crest */}
                  <path
                    d="M12.5 17L18 8c0.8 2.2-0.2 3.6 1.8 3.5 1.2 1.5 0.5 3 1.8 3.8 1.2-3 2.2-4.5 3.4-3.5 0.8 1.8-0.2 3.8 0.5 5.2-1.5 2-4 3.5-6.5 3.5l-7-3.5z"
                    fill="url(#flame-k-fire)"
                    filter="url(#flame-glow)"
                  />

                  {/* Floating Flame Embers */}
                  <circle cx="24" cy="6.5" r="1" fill="#fbbf24" className="animate-pulse" />
                  <circle cx="21" cy="4.5" r="0.75" fill="#f97316" />
                </svg>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-foreground flex items-center gap-1.5 leading-tight">
                Quiz Learning
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/25 font-bold tracking-wider">
                  PRO
                </span>
              </span>
              <span className="text-[12.5px] font-serif italic font-black tracking-wide bg-gradient-to-r from-amber-600 via-rose-500 to-indigo-600 dark:from-amber-400 dark:via-rose-400 dark:to-indigo-400 bg-clip-text text-transparent leading-snug">
                Khô Style ✨
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
            <Button
              variant={currentView === 'dashboard' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('dashboard')}
              className={`gap-1.5 h-9 px-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                currentView === 'dashboard' 
                  ? 'bg-secondary text-secondary-foreground border border-border shadow-2xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Home className="size-3.5" />
              Dashboard
            </Button>
            <Button
              variant={currentView === 'explorer' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onNavigate('explorer')}
              className={`gap-1.5 h-9 px-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                currentView === 'explorer' 
                  ? 'bg-secondary text-secondary-foreground border border-border shadow-2xs' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Search className="size-3.5" />
              Tra cứu câu hỏi
            </Button>
          </nav>
        </div>

        {/* Right: High-Contrast Search Bar, User Profile, Sync & Theme Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenCommandPalette}
            className="hidden lg:flex items-center gap-2.5 h-9 px-3.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-xs text-foreground transition-all cursor-pointer shadow-2xs group"
          >
            <Search className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-[11.5px] font-medium text-muted-foreground group-hover:text-foreground">Tìm kiếm câu hỏi hoặc đề thi...</span>
            <kbd className="pointer-events-none inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[9px] font-bold text-foreground shadow-2xs">
              <span className="text-[8.5px]">Ctrl</span>K
            </kbd>
          </button>

          {/* Busy Mode Config Button */}
          {onOpenBusyModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBusyModal}
              title="Cấu hình Chế độ Người bận rộn (Busy Mode popup định kỳ)"
              className={`h-9 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 gap-1.5 shadow-2xs ${
                busyEnabled
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                  : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Zap className={`size-3.5 ${busyEnabled ? 'text-amber-500 fill-amber-500 animate-pulse' : 'text-amber-500'}`} />
              <span className="hidden sm:inline">Busy Mode</span>
              {busyEnabled && (
                <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  {busyInterval}p
                </span>
              )}
            </Button>
          )}

          {/* Manual JSON Sync Button */}
          {onOpenSyncModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSyncModal}
              title="Xuất/Nhập file JSON tiến độ thủ công"
              className="hidden sm:flex h-9 px-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95 gap-1.5 shadow-2xs"
            >
              <ArrowRightLeft className="size-3.5 text-muted-foreground" />
              <span>JSON</span>
            </Button>
          )}

          {/* Theme Switcher */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleTheme}
            title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            className="h-9 w-9 rounded-xl border border-border bg-muted/40 text-foreground hover:bg-muted transition-transform active:scale-95 cursor-pointer shadow-2xs"
          >
            {isDark ? (
              <Sun className="size-4 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="size-4 text-indigo-500 hover:-rotate-12 transition-transform" />
            )}
          </Button>

          {/* New Version Alert Badge */}
          {hasPendingUpdate && (
            <button
              type="button"
              onClick={onCheckUpdates}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-all cursor-pointer animate-pulse shadow-xs"
              title="Đã có phiên bản mới! Bấm để cập nhật"
            >
              <Sparkles className="size-3.5 fill-current" />
              <span>Bản mới!</span>
            </button>
          )}

          {/* ================================================================= */}
          {/* USER AUTH & PROFILE DROPDOWN MENU */}
          {/* ================================================================= */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-xl border border-border bg-card hover:bg-muted/70 transition-all cursor-pointer shadow-2xs group"
              >
                {/* Mini Avatar */}
                <div className="size-7 rounded-lg bg-gradient-to-tr from-amber-500/20 to-primary/20 flex items-center justify-center text-base overflow-hidden border border-border select-none">
                  {avatarDisplay.startsWith('http') ? (
                    <img src={avatarDisplay} alt="User" className="size-full object-cover" />
                  ) : (
                    <span>{avatarDisplay}</span>
                  )}
                </div>

                {/* Name & Cloud Dot */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <span className="max-w-[90px] truncate">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                  <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" title="Đã kết nối máy chủ Cloud" />
                </div>

                {/* Mini Streak */}
                {streakDays > 0 && (
                  <span className="hidden md:inline-flex items-center gap-0.5 text-[11px] font-black text-amber-600 dark:text-amber-400 px-1 py-0.2 rounded-md bg-amber-500/10">
                    <Flame className="size-3 fill-current" />
                    {streakDays}
                  </span>
                )}

                <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground transition-transform" />
              </button>

              {/* Dropdown Menu Popup */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                  {/* User Info Header */}
                  <div className="px-3 py-2 border-b border-border/80">
                    <div className="text-xs font-bold text-foreground truncate">
                      {currentUser.displayName || 'Học Viên QuizPro'}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate font-mono">
                      {currentUser.email}
                    </div>
                  </div>

                  {/* Menu Options */}
                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('profile');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left"
                    >
                      <UserIcon className="size-4 text-primary" />
                      <span>Trang Hồ Sơ & Huy Hiệu</span>
                    </button>

                    {onQuickSync && (
                      <button
                        type="button"
                        disabled={isSyncingCloud}
                        onClick={async () => {
                          await onQuickSync();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2.5">
                          <Cloud className="size-4 text-blue-500" />
                          <span>Đồng bộ Cloud ngay</span>
                        </span>
                        {isSyncingCloud && <Loader2 className="size-3.5 animate-spin text-primary" />}
                      </button>
                    )}

                    {onCheckUpdates && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onCheckUpdates();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2.5">
                          <Sparkles className="size-4 text-amber-500" />
                          <span>Kiểm tra bản cập nhật</span>
                        </span>
                        {hasPendingUpdate ? (
                          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">v{CURRENT_APP_VERSION}</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Sign Out Option */}
                  <div className="pt-1 border-t border-border/80">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="size-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onOpenAuthModal}
              className="h-9 px-3.5 rounded-xl font-bold bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md hover:opacity-95 transition-opacity cursor-pointer gap-1.5"
            >
              <Sparkles className="size-3.5" />
              <span>Đăng nhập</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

