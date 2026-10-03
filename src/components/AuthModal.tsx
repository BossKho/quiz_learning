import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  signIn, 
  signUp, 
  sendPasswordReset 
} from '@/services/firebaseService';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Reset form when opening modal
  React.useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setShowPassword(false);
      setIsLoading(false);
      setForgotSent(false);
    }
  }, [open, initialMode]);

  // Helper to translate Firebase error codes to friendly Vietnamese
  const getErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
      case 'auth/email-already-in-use':
        return 'Email này đã được đăng ký. Bạn có thể bấm Đăng nhập ngay.';
      case 'auth/weak-password':
        return 'Mật khẩu cần tối thiểu 6 ký tự để đảm bảo an toàn.';
      case 'auth/invalid-email':
        return 'Định dạng email không hợp lệ (ví dụ: yourname@gmail.com).';
      case 'auth/too-many-requests':
        return 'Bạn đã thử đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau ít phút.';
      default:
        return err?.message || 'Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại.';
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.warning('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await signIn(email, password);
      toast.success(`Chào mừng trở lại, ${user.displayName || email.split('@')[0]}! 🎉`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.warning('Vui lòng nhập Email và Mật khẩu.');
      return;
    }
    if (password.length < 6) {
      toast.warning('Mật khẩu phải có độ dài ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      toast.warning('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await signUp(email, password, displayName);
      toast.success(`Đăng ký tài khoản thành công! Chào mừng ${user.displayName || 'bạn'}! 🚀`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.warning('Vui lòng nhập địa chỉ Email của bạn.');
      return;
    }

    try {
      setIsLoading(true);
      await sendPasswordReset(email);
      setForgotSent(true);
      toast.success('Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hộp thư.');
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-border bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl">
        {/* Header Visual Gradient Banner */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-primary to-amber-500 p-6 text-white overflow-hidden">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner border border-white/25">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Quiz Learning Pro
              </DialogTitle>
              <DialogDescription className="text-xs text-white/80 font-medium">
                Hệ thống tài khoản & Đồng bộ tiến độ đám mây
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tab Controls (Only shown for signin/signup) */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 p-1.5 mx-6 mt-4 rounded-xl bg-muted/60 border border-border">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Đăng ký mới
            </button>
          </div>
        )}

        <div className="p-6 pt-3 space-y-4">
          {/* ================= MODE: ĐĂNG NHẬP ================= */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Email tài khoản</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-9 pr-10 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl font-bold bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md hover:opacity-95 transition-opacity cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Đang đăng nhập...
                  </span>
                ) : (
                  'Đăng nhập ngay'
                )}
              </Button>
            </form>
          )}

          {/* ================= MODE: ĐĂNG KÝ ================= */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Họ và tên / Tên hiển thị</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Mật khẩu (tối thiểu 6 ký tự)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-9 pr-10 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Xác nhận mật khẩu</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:opacity-95 transition-opacity cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Đang tạo tài khoản...
                  </span>
                ) : (
                  'Tạo tài khoản ngay'
                )}
              </Button>
            </form>
          )}

          {/* ================= MODE: QUÊN MẬT KHẨU ================= */}
          {mode === 'forgot' && (
            <div className="space-y-3.5 pt-2">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Quay lại Đăng nhập
              </button>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Khôi phục mật khẩu</h4>
                <p className="text-xs text-muted-foreground">
                  Nhập địa chỉ email đăng ký của bạn. Hệ thống sẽ gửi trực tiếp liên kết đặt lại mật khẩu về hòm thư của bạn.
                </p>
              </div>

              {forgotSent ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    Đã gửi email khôi phục!
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Vui lòng kiểm tra hộp thư đến (và thư mục Spam/Quảng cáo) của địa chỉ <strong>{email}</strong> để làm theo hướng dẫn.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForgotSent(false);
                      setMode('signin');
                    }}
                    className="w-full mt-2 text-xs font-bold rounded-xl"
                  >
                    Quay lại màn hình đăng nhập
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Địa chỉ Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 rounded-xl font-bold bg-primary text-white shadow-md hover:opacity-95 cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Đang gửi...
                      </span>
                    ) : (
                      'Gửi liên kết khôi phục'
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Privacy & Safe Note */}
          <div className="pt-2 text-center text-[10.5px] text-muted-foreground">
            Bảo mật chuẩn mã hóa 256-bit • Dữ liệu học tập được tự động đồng bộ hóa an toàn
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
