import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export const toast = {
  show: (message: string, type: ToastType = 'info', title?: string, duration = 3500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, message, title, duration };
    toasts = [newToast, ...toasts].slice(0, 4); // Keep maximum 4 active toasts
    notify();

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  info: (message: string, title?: string) => toast.show(message, 'info', title || 'Thông tin'),
  success: (message: string, title?: string) => toast.show(message, 'success', title || 'Thành công'),
  warning: (message: string, title?: string) => toast.show(message, 'warning', title || 'Thông báo'),
  error: (message: string, title?: string) => toast.show(message, 'error', title || 'Lỗi'),
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
  clear: () => {
    toasts = [];
    notify();
  },
};

export const ToastContainer: React.FC = () => {
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>(toasts);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleUpdate = (updated: ToastItem[]) => setActiveToasts(updated);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  if (!mounted || activeToasts.length === 0) return null;

  return createPortal(
    <div
      data-toast-container="true"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none select-none"
    >
      {activeToasts.map((item) => {
        const isError = item.type === 'error';
        const isWarning = item.type === 'warning';
        const isSuccess = item.type === 'success';

        return (
          <div
            key={item.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={`pointer-events-auto p-4 rounded-2xl border-2 shadow-2xl flex items-start gap-3.5 transition-all animate-in slide-in-from-top-3 fade-in duration-200 bg-card text-card-foreground ${
              isError
                ? 'border-destructive/60 shadow-destructive/10 ring-1 ring-destructive/20'
                : isWarning
                ? 'border-amber-500/60 shadow-amber-500/10 ring-1 ring-amber-500/20'
                : isSuccess
                ? 'border-emerald-500/60 shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                : 'border-primary/60 shadow-primary/10 ring-1 ring-primary/20'
            }`}
          >
            {/* Icon Box */}
            <div
              className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                isError
                  ? 'bg-destructive/15 text-destructive'
                  : isWarning
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : isSuccess
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary/15 text-primary'
              }`}
            >
              {isError && <AlertCircle className="size-5 stroke-[2.5]" />}
              {isWarning && <AlertTriangle className="size-5 stroke-[2.5]" />}
              {isSuccess && <CheckCircle2 className="size-5 stroke-[2.5]" />}
              {!isError && !isWarning && !isSuccess && <Info className="size-5 stroke-[2.5]" />}
            </div>

            {/* Message Body */}
            <div className="flex-1 space-y-1 pr-1 pt-0.5">
              {item.title && (
                <div
                  className={`text-[11px] font-black uppercase tracking-wider ${
                    isError
                      ? 'text-destructive'
                      : isWarning
                      ? 'text-amber-600 dark:text-amber-400'
                      : isSuccess
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-primary'
                  }`}
                >
                  {item.title}
                </div>
              )}
              <div className="text-xs font-semibold leading-relaxed text-foreground">
                {item.message}
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => toast.dismiss(item.id)}
              className="text-muted-foreground hover:text-foreground cursor-pointer p-1.5 rounded-xl hover:bg-muted active:scale-90 transition-all shrink-0 -mr-1 -mt-1"
              aria-label="Đóng thông báo"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

