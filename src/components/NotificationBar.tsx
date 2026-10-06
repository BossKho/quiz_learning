import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  X, 
  Sparkles, 
  BellRing,
  UserCheck
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

  if (!announcement || !announcement.active || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true');
    setIsDismissed(true);
  };

  const isSpecificToMe = announcement.target === 'specific' && 
    currentUserEmail && 
    announcement.targetEmail?.toLowerCase() === currentUserEmail.toLowerCase();

  // Formatting colors based on announcement type
  const typeStyles = {
    info: {
      bg: 'bg-gradient-to-r from-indigo-900/90 via-blue-900/90 to-indigo-900/90 border-indigo-500/40 text-indigo-100',
      badge: 'bg-indigo-500/25 text-indigo-300 border-indigo-400/40',
      icon: <Sparkles className="size-4 text-indigo-400 animate-pulse shrink-0" />,
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-950/90 via-orange-950/90 to-amber-950/90 border-amber-500/40 text-amber-100',
      badge: 'bg-amber-500/25 text-amber-300 border-amber-400/40',
      icon: <AlertTriangle className="size-4 text-amber-400 shrink-0" />,
    },
    urgent: {
      bg: 'bg-gradient-to-r from-rose-950/95 via-purple-950/95 to-rose-950/95 border-rose-500/50 text-rose-100',
      badge: 'bg-rose-500/25 text-rose-300 border-rose-400/40',
      icon: <BellRing className="size-4 text-rose-400 animate-bounce shrink-0" />,
    },
  }[announcement.type || 'info'];

  return (
    <aside 
      aria-label="Thông báo hệ thống" 
      className={`relative z-40 w-full px-4 py-2.5 border-b backdrop-blur-md shadow-md transition-all duration-300 animate-in slide-in-from-top-2 ${typeStyles.bg}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        {/* Left: Icon + Label Badges */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {typeStyles.icon}

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${typeStyles.badge}`}>
              {announcement.type === 'urgent' ? 'Khẩn Cấp' : 'Thông Báo'}
            </span>

            {isSpecificToMe && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40">
                <UserCheck className="size-3" />
                <span>Gửi riêng cho bạn</span>
              </span>
            )}
          </div>

          {/* Center: Exact text message */}
          <div className="font-medium truncate flex-1 select-text">
            <span>{announcement.message}</span>
          </div>
        </div>

        {/* Right: Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          title="Đóng thông báo này"
          className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
};
