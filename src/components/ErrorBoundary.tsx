import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home, Copy, Check, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

const CRASH_LOGS_KEY = 'quiz_crash_history';
const MAX_SAVED_LOGS = 5;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[QuizLearning Crash Interceptor] Uncaught component render error:', error, errorInfo);

    // Persist crash telemetry to localStorage for diagnostics
    try {
      const crashRecord = {
        timestamp: new Date().toISOString(),
        message: error.message || String(error),
        name: error.name || 'Error',
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      const existingRaw = localStorage.getItem(CRASH_LOGS_KEY);
      const history: Array<typeof crashRecord> = existingRaw ? JSON.parse(existingRaw) : [];
      history.unshift(crashRecord);
      if (history.length > MAX_SAVED_LOGS) {
        history.length = MAX_SAVED_LOGS;
      }
      localStorage.setItem(CRASH_LOGS_KEY, JSON.stringify(history));
      localStorage.setItem('quiz_last_crash_report', JSON.stringify(crashRecord));
    } catch (saveErr) {
      console.warn('Failed to record crash diagnostics to localStorage:', saveErr);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetToHome = (): void => {
    try {
      // Clear any stuck transient keys if necessary
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.origin + window.location.pathname;
  };

  handleCopyDiagnostics = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const report = [
      `=== QUIZ LEARNING PRO CRASH REPORT ===`,
      `Time: ${new Date().toISOString()}`,
      `Error Name: ${error?.name || 'Unknown'}`,
      `Message: ${error?.message || 'No message'}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `\n--- Stack Trace ---`,
      error?.stack || 'No stack trace available',
      `\n--- Component Tree Stack ---`,
      errorInfo?.componentStack || 'No component stack available',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Fallback copy using textarea
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, copied } = this.state;

      return (
        <div className="min-h-screen w-full bg-[#090d16] text-[#f8fafc] flex items-center justify-center p-4 sm:p-6 select-none font-sans antialiased">
          <div className="w-full max-w-xl rounded-3xl border border-border/80 bg-[#111827] shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Icon & Title */}
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10">
                <AlertTriangle className="size-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Đã Xảy Ra Sự Cố Hiển Thị
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Ứng dụng đã tự động chặn đứng sự cố giao diện để bảo vệ an toàn tuyệt đối cho tiến độ học tập và cơ sở dữ liệu của bạn.
                </p>
              </div>
            </div>

            {/* Error Message Snippet */}
            <div className="rounded-2xl bg-black/50 border border-border/60 p-4 space-y-2 text-left">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-rose-400">
                  <Terminal className="size-3.5" /> Chi tiết kỹ thuật
                </span>
                <span className="text-[10px] text-muted-foreground/80">Crash Protected</span>
              </div>
              <p className="text-xs font-mono text-rose-300 break-words leading-relaxed select-text">
                {error?.name}: {error?.message || 'Lỗi hiển thị chưa xác định'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="default"
                onClick={this.handleReload}
                className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <RotateCcw className="size-4" />
                Tải lại ứng dụng (F5)
              </Button>

              <Button
                variant="outline"
                onClick={this.handleResetToHome}
                className="flex-1 h-11 rounded-xl border-border/80 text-foreground hover:bg-muted/60 font-semibold text-xs sm:text-sm gap-2 cursor-pointer active:scale-95"
              >
                <Home className="size-4" />
                Về Trang chủ an toàn
              </Button>
            </div>

            {/* Diagnostic Copy Link */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span className="text-[11px]">
                Phím tắt: Bấm <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground">F5</kbd> hoặc <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground">Ctrl + R</kbd> để làm mới tức thì.
              </span>
              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer font-medium"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Đã chép mã lỗi</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Sao chép mã lỗi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
