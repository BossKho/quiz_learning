import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertTriangle, 
  X, 
  BellRing,
  UserCheck,
  Radio
} from 'lucide-react';
import type { SystemAnnouncement } from '@/services/announcementService';

interface NotificationBarProps {
  announcement: SystemAnnouncement | null;
  currentUserEmail?: string | null;
}

export const NotificationBar: React.FC<NotificationBarProps> = ({
  announcement,
  currentUserEmail,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDismiss = useCallback(() => {
    if (announcement) {
      localStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true');
    }
    setIsDismissed(true);
  }, [announcement]);

  // Check if this specific announcement has been dismissed by this client
  useEffect(() => {
    if (!announcement) {
      setIsDismissed(false);
      return;
    }
    const dismissedKey = `dismissed_announcement_${announcement.id}`;
    const dismissed = localStorage.getItem(dismissedKey) === 'true';
    setIsDismissed(dismissed);
  }, [announcement]);

  // Auto-dismiss after 5 seconds (5000ms) or allow user to dismiss manually early
  useEffect(() => {
    if (!announcement || !announcement.active || isDismissed) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [announcement, isDismissed, handleDismiss]);

  if (!mounted || !announcement || !announcement.active || isDismissed) {
    return null;
  }

  const isSpecificToMe = announcement.target === 'specific' && 
    currentUserEmail && 
    announcement.targetEmail?.toLowerCase() === currentUserEmail.toLowerCase();

  // Formatting colors matching toast notification cards based on announcement type
  const typeConfig = {
    info: {
      card: 'border-primary/70 shadow-primary/20 ring-1 ring-primary/30',
      iconBox: 'bg-primary/20 text-primary',
      icon: <Radio className="size-5 stroke-[2.5] animate-pulse" />,
      badge: 'bg-primary/20 text-primary border-primary/30',
      progressBar: 'bg-primary',
      title: 'Thông Báo Hệ Thống',
    },
    warning: {
      card: 'border-amber-500/70 shadow-amber-500/20 ring-1 ring-amber-500/30',
      iconBox: 'bg-amber-500/20 text-amber-500',
      icon: <AlertTriangle className="size-5 stroke-[2.5]" />,
      badge: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
      progressBar: 'bg-amber-500',
      title: 'Cảnh Báo Từ Hệ Thống',
    },
    urgent: {
      card: 'border-rose-500/80 shadow-rose-500/25 ring-1 ring-rose-500/40',
      iconBox: 'bg-rose-500/20 text-rose-500',
      icon: <BellRing className="size-5 stroke-[2.5] animate-bounce" />,
      badge: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
      progressBar: 'bg-rose-500',
      title: 'Thông Báo Khẩn Cấp',
    },
  }[announcement.type || 'info'];

  return createPortal(
    <div
      data-system-announcement="true"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9990] flex flex-col gap-2 max-w-lg w-full px-4 pointer-events-none select-none"
    >
      <style>{`
        @keyframes announcementProgressCountdown {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`relative overflow-hidden pointer-events-auto p-4 rounded-2xl border-2 shadow-2xl flex items-start gap-3.5 transition-all animate-in slide-in-from-top-4 fade-in duration-300 bg-card text-card-foreground ${typeConfig.card}`}
      >
        {/* Left Icon Box */}
        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.iconBox}`}>
          {typeConfig.icon}
        </div>

        {/* Message Body */}
        <div className="flex-1 space-y-1 pr-1 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${typeConfig.badge}`}>
              {typeConfig.title}
            </span>

            {isSpecificToMe && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <UserCheck className="size-3" />
                <span>Gửi riêng cho bạn</span>
              </span>
            )}
          </div>

          <div className="text-xs font-semibold leading-relaxed text-foreground select-text pt-0.5">
            {announcement.message}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground cursor-pointer p-1.5 rounded-xl hover:bg-muted active:scale-90 transition-all shrink-0 -mr-1 -mt-1"
          aria-label="Đóng thông báo"
          title="Đóng thông báo"
        >
          <X className="size-4" />
        </button>

        {/* 5-second Auto-dismiss Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-foreground/10 overflow-hidden">
          <div 
            className={`h-full ${typeConfig.progressBar}`}
            style={{ animation: 'announcementProgressCountdown 5000ms linear forwards' }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
