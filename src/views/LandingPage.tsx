import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Cloud, 
  Brain, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Award,
  UserPlus,
  LogIn
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { ClickSpark, FloatingDust, Magnet, TiltedCard } from '@/components/motion';

interface LandingPageProps {
  onOpenAuthModal: (mode: 'signin' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuthModal }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <ClickSpark sparkColors={['#6366f1', '#3b82f6', '#ec4899', '#f59e0b', '#10b981']} sparkCount={9} className="min-h-screen">
      <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* =========================================================================
          TOP NAVBAR
         ========================================================================= */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 select-none">
            <div className="relative flex size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-[1.5px] border border-slate-700/60 shadow-md shadow-indigo-500/25">
              <div className="flex size-full items-center justify-center rounded-[14px] bg-slate-950/95 overflow-hidden">
                <svg viewBox="0 0 32 32" className="size-6" fill="none">
                  <defs>
                    <linearGradient id="landing-flame-k" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="45%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                  </defs>
                  <path d="M7 6h3.5v20H7l1.2-2V8L7 6z" fill="#38bdf8" />
                  <path d="M12.5 16l6.5 10h4.5l-8-12.5-3 2.5z" fill="#c084fc" />
                  <path d="M12.5 17L18 8c0.8 2.2-0.2 3.6 1.8 3.5 1.2 1.5 0.5 3 1.8 3.8 1.2-3 2.2-4.5 3.4-3.5 0.8 1.8-0.2 3.8 0.5 5.2-1.5 2-4 3.5-6.5 3.5l-7-3.5z" fill="url(#landing-flame-k)" />
                  <circle cx="24" cy="6.5" r="1" fill="#fbbf24" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-foreground">
                  Quiz Learning
                </span>
                <span className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-1.5 py-0.2 text-[9px] font-black text-white uppercase tracking-wider">
                  Pro
                </span>
              </div>
              <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 tracking-wider">
                Khô Style ✨
              </span>
            </div>
          </div>

          {/* Right Actions: Theme Toggle + Auth Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Đổi giao diện Sáng / Tối"
            >
              {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-indigo-500" />}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenAuthModal('signin')}
              className="rounded-xl font-bold text-xs gap-1.5 h-9 px-3.5 border-border hover:bg-muted cursor-pointer"
            >
              <LogIn className="size-3.5" />
              <span>Đăng nhập</span>
            </Button>

            <Button
              size="sm"
              onClick={() => onOpenAuthModal('signup')}
              className="rounded-xl font-bold text-xs gap-1.5 h-9 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:opacity-95 text-white shadow-md shadow-primary/20 cursor-pointer"
            >
              <Sparkles className="size-3.5" />
              <span>Đăng ký ngay</span>
            </Button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION
         ========================================================================= */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-6 border-b border-border/40">
        {/* Glow ambient backgrounds */}
        <FloatingDust count={28} className="opacity-70 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-gradient-to-tr from-primary/10 via-indigo-500/10 to-amber-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          {/* Enterprise Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            Nền Tảng Ôn Thi Trắc Nghiệm Thông Minh • Local-First 2026
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.2] max-w-4xl mx-auto">
            Chinh Phục Mọi Kỳ Thi Với <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-amber-500">
              Phương Pháp Ghi Nhớ <span className="whitespace-nowrap">Khoa Học</span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Học tập hiệu quả với thuật toán <strong>Lặp lại ngắt quãng (Leitner 5 Hộp)</strong>, phòng thi thực chiến tính giờ tiêu chuẩn và công nghệ <strong>Local-First siêu tốc</strong> hoạt động mượt mà ngay cả khi không có mạng.
          </p>

          {/* Main Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Magnet strength={0.2}>
              <Button
                size="lg"
                onClick={() => onOpenAuthModal('signin')}
                className="w-full sm:w-auto h-12 px-7 rounded-2xl font-black text-sm bg-gradient-to-r from-primary via-indigo-600 to-violet-600 hover:opacity-95 text-white shadow-xl shadow-primary/25 cursor-pointer gap-2.5 group whitespace-nowrap"
              >
                <span className="whitespace-nowrap">Bắt đầu học ngay — Đăng nhập</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Magnet>

            <Magnet strength={0.2}>
              <Button
                variant="outline"
                size="lg"
                onClick={() => onOpenAuthModal('signup')}
                className="w-full sm:w-auto h-12 px-6 rounded-2xl font-bold text-sm border-border bg-card/80 hover:bg-muted text-foreground cursor-pointer gap-2 shadow-xs whitespace-nowrap"
              >
                <UserPlus className="size-4 text-primary" />
                <span className="whitespace-nowrap">Tạo tài khoản học viên mới</span>
              </Button>
            </Magnet>
          </div>

          {/* Trust Indicators */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-semibold">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Tiến độ phân tách riêng theo từng tài khoản</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="size-4 text-amber-500" />
              <span>Chạy ngoại tuyến Offline siêu tốc</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cloud className="size-4 text-blue-500" />
              <span>Tự động đồng bộ đám mây đa thiết bị</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE SHOWCASE (4 BENTO CARDS)
         ========================================================================= */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full space-y-10">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Bộ Công Cụ Luyện Thi Tiêu Chuẩn Quốc Tế
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Được thiết kế tối ưu hóa cho trải nghiệm ôn tập chuyên sâu của các chứng chỉ chuyên nghiệp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Leitner Box System */}
          <TiltedCard maxRotate={5} scaleOnHover={1.015} className="h-full rounded-3xl">
            <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 space-y-4 shadow-sm hover:border-primary/40 transition-colors h-full flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <Brain className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-foreground">
                    Ghi Nhớ Ngắt Quãng (Leitner 5 Hộp)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tự động thăng cấp câu hỏi khi trả lời đúng (Hộp 1 ➔ Hộp 5). Khi trả lời sai, câu hỏi lập tức quay về Hộp 1 để bạn luyện tập lại đúng trọng tâm, tiết kiệm 70% thời gian ôn luyện.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 pt-2">
                {[1, 2, 3, 4, 5].map((box) => (
                  <div key={box} className="flex-1 py-1.5 rounded-lg bg-muted/80 text-center text-[10px] font-bold text-muted-foreground border border-border/50">
                    Hộp {box}
                  </div>
                ))}
              </div>
            </div>
          </TiltedCard>

          {/* Card 2: Local-First Offline Speed */}
          <TiltedCard maxRotate={5} scaleOnHover={1.015} className="h-full rounded-3xl">
            <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 space-y-4 shadow-sm hover:border-primary/40 transition-colors h-full flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                  <Zap className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-foreground">
                    Kiến Trúc Local-First & Không Gián Đoạn
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cơ sở dữ liệu SQLite hiệu năng cao nhúng trực tiếp ngay trong máy tính. Bạn có thể làm bài trên máy bay, quán cà phê không mạng mà không gặp bất kỳ độ trễ nào.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                <span>Phản hồi dưới 5ms • Không giật lag</span>
              </div>
            </div>
          </TiltedCard>

          {/* Card 3: Multi-User Isolation & Cloud Sync */}
          <TiltedCard maxRotate={5} scaleOnHover={1.015} className="h-full rounded-3xl">
            <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 space-y-4 shadow-sm hover:border-primary/40 transition-colors h-full flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                  <Cloud className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-foreground">
                    Phân Tách Dữ Liệu & Đồng Bộ Đám Mây
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mỗi tài khoản sở hữu không gian học tập riêng biệt. Đăng xuất an toàn tuyệt đối, người khác mở app sẽ không thấy bài dở dang hay điểm số của bạn.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="size-3.5" />
                <span>Bảo vệ quyền riêng tư cá nhân</span>
              </div>
            </div>
          </TiltedCard>

          {/* Card 4: Exam Arena & Flashcard */}
          <TiltedCard maxRotate={5} scaleOnHover={1.015} className="h-full rounded-3xl">
            <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 space-y-4 shadow-sm hover:border-primary/40 transition-colors h-full flex flex-col justify-between">
              <div>
                <div className="size-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                  <Award className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-foreground">
                    Phòng Thi Thực Chiến & Thẻ Flashcard
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mô phỏng áp lực phòng thi thật với đồng hồ đếm ngược, đảo ngẫu nhiên đáp án, hỗ trợ phím tắt số 1-4 và lật thẻ Flashcard nhanh bằng phím Space.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                <CheckCircle2 className="size-3.5" />
                <span>Tùy chỉnh 15 / 30 / 60 câu hỏi</span>
              </div>
            </div>
          </TiltedCard>
        </div>
      </section>

      {/* =========================================================================
          BOTTOM CALL TO ACTION
         ========================================================================= */}
      <section className="py-12 px-6 max-w-5xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card/90 to-primary/5 p-8 sm:p-12 text-center space-y-6 shadow-xl">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Sparkles className="size-7" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Sẵn Sàng Nâng Tầm Kết Quả <span className="whitespace-nowrap">Học Tập?</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Đăng nhập hoặc tạo tài khoản mới để bắt đầu hành trình ôn luyện, tích lũy XP thăng cấp và làm chủ kiến thức ngay hôm nay.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => onOpenAuthModal('signup')}
              className="w-full sm:w-auto h-11 px-7 rounded-2xl font-black text-xs bg-primary hover:opacity-95 text-white shadow-lg shadow-primary/20 cursor-pointer whitespace-nowrap"
            >
              <span className="whitespace-nowrap">Tạo tài khoản học viên mới</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onOpenAuthModal('signin')}
              className="w-full sm:w-auto h-11 px-6 rounded-2xl font-bold text-xs border-border hover:bg-muted cursor-pointer whitespace-nowrap"
            >
              <span className="whitespace-nowrap">Đăng nhập vào tài khoản</span>
            </Button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
         ========================================================================= */}
      <footer className="mt-auto border-t border-border py-6 px-6 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Quiz Learning Pro — Enterprise Certification Practice. All rights reserved.</p>
          <p className="font-medium text-[11px]">Bảo mật chuẩn 256-bit • Local-First Architecture</p>
        </div>
      </footer>
    </div>
  </ClickSpark>
  );
};
