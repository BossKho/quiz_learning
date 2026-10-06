import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { 
  getCurrentUser, 
  getUserProfileData, 
  updateUserProfileData, 
  changePassword, 
  signOutUser, 
  syncLocalToCloud, 
  pullCloudToLocal, 
  calculateLevel,
  getActivityHistory,
  SYSTEM_BADGES,
  type UserProfileData,
  type LevelInfo
} from '@/services/firebaseService';
import { dbService } from '@/services/db';
import { Button } from '@/components/ui/button';
import { 
  User as UserIcon, 
  Mail, 
  Lock, 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  Flame, 
  Zap, 
  Check, 
  X, 
  Edit3, 
  Calendar, 
  Sparkles, 
  LogOut, 
  ArrowLeft, 
  Loader2, 
  Eye,
  EyeOff,
  Radio,
  Send,
  Crown,
  Trash2,
  Bell,
  Users
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { CURRENT_APP_VERSION } from '@/services/updateService';
import { 
  isUserAdmin, 
  sendSystemAnnouncement, 
  getActiveAnnouncements, 
  deactivateAnnouncement, 
  getRegisteredUsers,
  ADMIN_EMAIL, 
  type SystemAnnouncement,
  type AnnouncementType,
  type AnnouncementTarget,
  type RegisteredMember
} from '@/services/announcementService';

interface ProfileViewProps {
  onBackToDashboard: () => void;
  onStartWeakPractice?: () => void;
  onReloadData?: () => Promise<void>;
  onCheckUpdates?: () => void;
}

// 16 Modern Curated Avatars for Learners
const PRESET_AVATARS = [
  { id: 'dev_guy', emoji: '🧑‍💻', label: 'Dev Nam', bg: 'bg-blue-500/20 text-blue-500' },
  { id: 'dev_girl', emoji: '👩‍💻', label: 'Dev Nữ', bg: 'bg-pink-500/20 text-pink-500' },
  { id: 'robot', emoji: '🤖', label: 'AI Cyber', bg: 'bg-emerald-500/20 text-emerald-500' },
  { id: 'owl', emoji: '🦉', label: 'Cú Trí Tuệ', bg: 'bg-amber-500/20 text-amber-500' },
  { id: 'fox', emoji: '🦊', label: 'Cáo Nhanh Trí', bg: 'bg-orange-500/20 text-orange-500' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja IT', bg: 'bg-slate-500/20 text-slate-400' },
  { id: 'cat', emoji: '🐱', label: 'Mèo Công Nghệ', bg: 'bg-purple-500/20 text-purple-500' },
  { id: 'lion', emoji: '🦁', label: 'Sư Tử Thủ Lĩnh', bg: 'bg-yellow-500/20 text-yellow-500' },
  { id: 'wizard', emoji: '🧙‍♂️', label: 'Phù Thủy Code', bg: 'bg-indigo-500/20 text-indigo-500' },
  { id: 'rocket', emoji: '🚀', label: 'Tên Lửa Tăng Tốc', bg: 'bg-red-500/20 text-red-500' },
  { id: 'brain', emoji: '🧠', label: 'Siêu Trí Não', bg: 'bg-rose-500/20 text-rose-500' },
  { id: 'flash', emoji: '⚡', label: 'Tia Chớp', bg: 'bg-amber-400/20 text-amber-400' },
  { id: 'astronaut', emoji: '👨‍🚀', label: 'Phi Hành Gia', bg: 'bg-sky-500/20 text-sky-500' },
  { id: 'gamer', emoji: '🎮', label: 'Game Thủ Pro', bg: 'bg-violet-500/20 text-violet-500' },
  { id: 'detective', emoji: '🕵️', label: 'Thám Tử Bug', bg: 'bg-stone-500/20 text-stone-400' },
  { id: 'dragon', emoji: '🐉', label: 'Rồng Bất Bại', bg: 'bg-teal-500/20 text-teal-500' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  onBackToDashboard,
  onStartWeakPractice,
  onReloadData,
  onCheckUpdates,
}) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Avatar Picker Modal
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('Chưa đồng bộ');

  // Stats from SQLite
  const [leitnerStats, setLeitnerStats] = useState<{ [box: number]: number }>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  });
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Activity Heatmap Data
  const [activityMap, setActivityMap] = useState<Record<string, { count: number; correct: number }>>({});

  // Admin Announcement Center State (Hidden from regular accounts)
  const isAdmin = useMemo(() => isUserAdmin(user?.email), [user?.email]);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminTarget, setAdminTarget] = useState<AnnouncementTarget>('all');
  const [adminTargetEmail, setAdminTargetEmail] = useState('');
  const [adminType, setAdminType] = useState<AnnouncementType>('info');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

  // List of registered members for targeted notification dropdown
  const [registeredMembers, setRegisteredMembers] = useState<RegisteredMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Load User Data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const currentUser = getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        setNewName(currentUser.displayName || '');
        const prof = await getUserProfileData(currentUser.uid);
        setProfile(prof);

        const act = await getActivityHistory(currentUser.uid);
        setActivityMap(act);
      }

      // Load SQLite leitner stats
      try {
        await dbService.init();
        const overall = await dbService.getOverallStats();
        setTotalQuestions(overall.totalQuestions);

        const questions = await dbService.getCustomQuestions({ count: 99999, scope: 'all' });
        const counts: { [box: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        questions.forEach((q: any) => {
          const box = q.stats?.leitner_box || 1;
          counts[box] = (counts[box] || 0) + 1;
        });
        setLeitnerStats(counts);
      } catch (err) {
        console.error('Failed to load stats:', err);
      }

      setIsLoading(false);
    }
    loadData();
  }, []);

  // Compute Level & XP
  const levelInfo: LevelInfo = useMemo(() => {
    return calculateLevel(profile?.xp || 0);
  }, [profile?.xp]);

  // Handle Save Name
  const handleSaveName = async () => {
    if (!newName.trim()) {
      toast.warning('Tên hiển thị không được để trống.');
      return;
    }
    try {
      setIsSavingName(true);
      await updateUserProfileData(newName.trim());
      setUser(getCurrentUser());
      if (profile) setProfile({ ...profile, displayName: newName.trim() });
      setIsEditingName(false);
      toast.success('Đã cập nhật tên hiển thị thành công!');
    } catch {
      toast.error('Không thể cập nhật tên. Vui lòng thử lại.');
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle Select Avatar
  const handleSelectAvatar = async (avatarEmojiOrUrl: string) => {
    try {
      await updateUserProfileData(undefined, avatarEmojiOrUrl);
      setUser(getCurrentUser());
      if (profile) setProfile({ ...profile, photoURL: avatarEmojiOrUrl });
      setAvatarModalOpen(false);
      toast.success('Đã đổi ảnh đại diện!');
    } catch {
      toast.error('Không thể đổi avatar.');
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.warning('Vui lòng nhập cả mật khẩu cũ và mới.');
      return;
    }
    if (newPassword.length < 6) {
      toast.warning('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    try {
      setIsChangingPass(true);
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Đã đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới nhé.');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Mật khẩu hiện tại không chính xác.');
      } else {
        toast.error(err.message || 'Đổi mật khẩu thất bại.');
      }
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Sync to Cloud
  const handleSyncToCloud = async () => {
    if (!user) {
      toast.warning('Bạn chưa đăng nhập');
      return;
    }
    try {
      setIsSyncing(true);
      const res = await syncLocalToCloud(user.uid);
      setLastSyncText('Vừa xong');
      toast.success(`Đã sao lưu ${res.questionsCount} câu hỏi lên Cloud thành công! ☁️`);
      if (onReloadData) await onReloadData();
    } catch (err: any) {
      toast.error('Lỗi sao lưu: ' + (err.message || String(err)));
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Pull from Cloud
  const handlePullFromCloud = async () => {
    if (!user) return;
    try {
      setIsPulling(true);
      const res = await pullCloudToLocal(user.uid, 'merge');
      toast.success(`Đã tải về và hòa trộn ${res.importedStats} bản ghi từ Cloud! 🎉`);
      if (onReloadData) await onReloadData();
    } catch (err: any) {
      toast.error('Lỗi tải dữ liệu: ' + (err.message || String(err)));
    } finally {
      setIsPulling(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      toast.info('Đã đăng xuất khỏi tài khoản.');
      onBackToDashboard();
    } catch {
      toast.error('Đăng xuất thất bại.');
    }
  };

  // Refresh active announcements list (Admin only)
  const refreshAnnouncements = useCallback(async () => {
    if (!isUserAdmin(user?.email)) return;
    try {
      setIsLoadingAnnouncements(true);
      const list = await getActiveAnnouncements();
      setActiveAnnouncements(list);
    } catch (err) {
      console.warn('Failed to fetch announcements:', err);
    } finally {
      setIsLoadingAnnouncements(false);
    }
  }, [user?.email]);

  // Load all registered members for admin dropdown
  const loadMembers = useCallback(async () => {
    if (!isUserAdmin(user?.email)) return;
    try {
      setIsLoadingMembers(true);
      const members = await getRegisteredUsers();
      setRegisteredMembers(members);
    } catch (err) {
      console.warn('Failed to fetch registered members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (isAdmin) {
      refreshAnnouncements();
      loadMembers();
    }
  }, [isAdmin, refreshAnnouncements, loadMembers]);

  // Handle Send System Announcement (Admin only)
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim()) {
      toast.warning('Vui lòng nhập nội dung thông báo.');
      return;
    }
    if (adminTarget === 'specific' && !adminTargetEmail.trim()) {
      toast.warning('Vui lòng nhập email người nhận đích danh.');
      return;
    }

    try {
      setIsSendingAnnouncement(true);
      await sendSystemAnnouncement({
        message: adminMessage.trim(),
        target: adminTarget,
        targetEmail: adminTarget === 'specific' ? adminTargetEmail.trim() : null,
        senderEmail: user?.email || ADMIN_EMAIL,
        type: adminType,
      });

      toast.success(
        adminTarget === 'all'
          ? 'Đã phát sóng thông báo tới toàn bộ hệ thống! 📢'
          : `Đã gửi thông báo đích danh tới ${adminTargetEmail}! 🎯`
      );
      setAdminMessage('');
      await refreshAnnouncements();
    } catch (err: any) {
      toast.error('Lỗi gửi thông báo: ' + (err.message || String(err)));
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  // Handle Deactivate Announcement (Admin only)
  const handleDeactivateAnnouncement = async (id: string) => {
    try {
      await deactivateAnnouncement(id);
      toast.success('Đã thu hồi thông báo thành công.');
      await refreshAnnouncements();
    } catch (err: any) {
      toast.error('Lỗi thu hồi thông báo: ' + (err.message || String(err)));
    }
  };

  // Render Activity Heatmap Matrix (Last 16 weeks ~ 112 days)
  const heatmapDays = useMemo(() => {
    const days: { dateStr: string; dayOfWeek: number; count: number }[] = [];
    const today = new Date();
    // 16 weeks * 7 = 112 days
    for (let i = 111; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = activityMap[dateStr]?.count || 0;
      days.push({
        dateStr,
        dayOfWeek: d.getDay(),
        count,
      });
    }
    return days;
  }, [activityMap]);

  if (!user && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
          <UserIcon className="size-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">Bạn chưa đăng nhập</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Đăng nhập tài khoản để đồng bộ tiến độ học tập trên đám mây, tích lũy XP thăng hạng và lưu giữ chuỗi Streak rực lửa.
        </p>
        <Button onClick={onBackToDashboard} className="rounded-xl font-bold">
          Quay lại Trang Chủ
        </Button>
      </div>
    );
  }

  const avatarDisplay = profile?.photoURL || user?.photoURL || '🧑‍💻';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Navigation & Back Action */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          Quay lại Bàn học
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Đồng Bộ Đám Mây • Trực Tuyến
          </span>
        </div>
      </div>

      {/* =========================================================================
          HERO BANNER: AVATAR + IDENTITY + LEVEL & XP BAR + STREAK
         ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 size-72 rounded-full bg-gradient-to-br from-primary/10 via-amber-500/10 to-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* Left: Avatar with Change Trigger + Name & Title */}
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer" onClick={() => setAvatarModalOpen(true)}>
              {/* Dynamic Tier Glow Frame */}
              <div className="size-20 sm:size-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-primary to-indigo-600 p-1 shadow-lg shadow-primary/20">
                <div className="size-full rounded-[22px] bg-background flex items-center justify-center text-4xl sm:text-5xl select-none overflow-hidden">
                  {avatarDisplay.startsWith('http') ? (
                    <img src={avatarDisplay} alt="Avatar" className="size-full object-cover" />
                  ) : (
                    <span>{avatarDisplay}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 size-7 rounded-xl bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors cursor-pointer"
                title="Đổi Avatar"
              >
                <Edit3 className="size-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-8 px-2.5 rounded-lg border border-primary bg-background text-sm font-bold text-foreground focus:outline-hidden"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={isSavingName}
                      onClick={handleSaveName}
                      className="size-8 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 cursor-pointer"
                    >
                      {isSavingName ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="size-8 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                      {user?.displayName || 'Học Viên QuizPro'}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                      title="Chỉnh sửa tên"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Mail className="size-3.5" />
                {user?.email}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {levelInfo.title}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Tham gia: {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('vi-VN') : '2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Level Badge & XP Progress + Streak Flame */}
          <div className="flex items-center gap-6 sm:gap-8 bg-muted/30 p-4 rounded-2xl border border-border/80">
            {/* Streak Flame */}
            <div className="flex items-center gap-2.5">
              <div className="size-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/30">
                <Flame className="size-6 fill-white" />
              </div>
              <div>
                <div className="text-lg font-black text-foreground">
                  {profile?.streakDays || 1} Ngày
                </div>
                <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Chuỗi học tập 🔥
                </div>
              </div>
            </div>

            {/* Level & XP */}
            <div className="space-y-1.5 min-w-[140px] sm:min-w-[180px]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-primary font-black">Cấp {levelInfo.level}</span>
                <span className="text-muted-foreground font-mono">
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {100 - levelInfo.progressPercent}% nữa để lên Level {levelInfo.level + 1}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BENTO GRID 3 COLUMNS: HUY HIỆU | HEATMAP & LEITNER | CLOUD & BẢO MẬT
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ================= COLUMN 1: KỆ HUY HIỆU THÀNH TỰU ================= */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Kệ Huy Hiệu Thành Tựu
            </h3>
            <span className="text-[11px] font-bold text-muted-foreground font-mono">
              2/{SYSTEM_BADGES.length} đã mở
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {SYSTEM_BADGES.map((b) => (
              <div
                key={b.id}
                className={`p-3 rounded-2xl border transition-all ${
                  b.unlocked
                    ? 'border-amber-500/30 bg-amber-500/5 shadow-2xs'
                    : 'border-border/60 bg-muted/20 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl select-none">{b.icon}</span>
                  <div className="text-xs font-bold text-foreground truncate">{b.title}</div>
                </div>
                <p className="text-[10.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ================= COLUMN 2: HEATMAP & PHÂN BỐ LEITNER ================= */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-2xs">
          {/* GitHub-style Activity Heatmap */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Lịch Hoạt Động (Activity Heatmap)
              </h3>
              <span className="text-[10px] text-muted-foreground font-bold">16 tuần gần nhất</span>
            </div>

            {/* Heatmap Grid Matrix */}
            <div className="p-3 rounded-2xl bg-muted/30 border border-border overflow-x-auto">
              <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-[320px]">
                {heatmapDays.map((d, i) => {
                  let colorClass = 'bg-muted-foreground/15';
                  if (d.count > 0 && d.count <= 5) colorClass = 'bg-emerald-300 dark:bg-emerald-950/60';
                  else if (d.count > 5 && d.count <= 15) colorClass = 'bg-emerald-400 dark:bg-emerald-700';
                  else if (d.count > 15 && d.count <= 30) colorClass = 'bg-emerald-500 dark:bg-emerald-500';
                  else if (d.count > 30) colorClass = 'bg-emerald-600 dark:bg-emerald-400';

                  return (
                    <div
                      key={i}
                      title={`${d.dateStr}: ${d.count} câu hỏi`}
                      className={`size-2.5 sm:size-3 rounded-xs transition-colors cursor-pointer ${colorClass}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2">
                <span>Ít</span>
                <div className="flex items-center gap-1">
                  <div className="size-2 rounded-xs bg-muted-foreground/15" />
                  <div className="size-2 rounded-xs bg-emerald-300 dark:bg-emerald-950/60" />
                  <div className="size-2 rounded-xs bg-emerald-500 dark:bg-emerald-500" />
                  <div className="size-2 rounded-xs bg-emerald-600 dark:bg-emerald-400" />
                </div>
                <span>Nhiều câu</span>
              </div>
            </div>
          </div>

          {/* Leitner Box Breakdown & Quick Practice */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Phân bố 5 Hộp Trí Nhớ (Leitner)</span>
              <span className="font-mono text-muted-foreground">{totalQuestions} câu tổng cộng</span>
            </div>

            <div className="space-y-1.5">
              {[
                { box: 1, label: 'Hộp 1 • Mới học', count: leitnerStats[1], color: 'bg-rose-500' },
                { box: 2, label: 'Hộp 2 • Bắt đầu nhớ', count: leitnerStats[2], color: 'bg-amber-500' },
                { box: 3, label: 'Hộp 3 • Ghi nhớ tốt', count: leitnerStats[3], color: 'bg-blue-500' },
                { box: 4, label: 'Hộp 4 • Vững vàng', count: leitnerStats[4], color: 'bg-indigo-500' },
                { box: 5, label: 'Hộp 5 • Thuần thục (Mastered)', count: leitnerStats[5], color: 'bg-emerald-500' },
              ].map((item) => {
                const percent = totalQuestions > 0 ? Math.round((item.count / totalQuestions) * 100) : 0;
                return (
                  <div key={item.box} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="font-mono font-bold text-muted-foreground">
                        {item.count} câu ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Smart Action Button */}
            {onStartWeakPractice && (leitnerStats[1] > 0 || leitnerStats[2] > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onStartWeakPractice}
                className="w-full mt-2 rounded-xl text-xs font-bold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
              >
                <Zap className="size-3.5 fill-current mr-1.5" />
                Luyện ngay {leitnerStats[1] + leitnerStats[2]} câu đang yếu (Hộp 1 & 2)
              </Button>
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: TRUNG TÂM ĐÁM MÂY & BẢO MẬT ================= */}
        <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-2xs">
          {/* Cloud Sync Center */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Cloud className="size-4 text-blue-500" />
                Trung Tâm Đồng Bộ Đám Mây
              </h3>
            </div>

            <div className="p-4 rounded-2xl border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Trạng thái:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Đã kết nối máy chủ Cloud
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Lần đồng bộ gần nhất:</span>
                <span className="font-mono font-bold text-foreground">{lastSyncText}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={isSyncing}
                  onClick={handleSyncToCloud}
                  className="rounded-xl text-xs font-bold bg-primary text-white hover:opacity-95 cursor-pointer"
                >
                  {isSyncing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Đang đẩy...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <CloudUpload className="size-3.5" /> Sao lưu lên Cloud
                    </span>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPulling}
                  onClick={handlePullFromCloud}
                  className="rounded-xl text-xs font-bold hover:bg-muted cursor-pointer"
                >
                  {isPulling ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Đang tải...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <CloudDownload className="size-3.5" /> Tải về máy này
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Password Change Security Form */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              Đổi Mật Khẩu An Toàn
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-2.5">
              <div className="relative">
                <input
                  type={showOldPass ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  className="w-full h-9 pl-3 pr-9 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPass(!showOldPass)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showOldPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full h-9 pl-3 pr-9 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>

              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={isChangingPass}
                className="w-full rounded-xl text-xs font-bold cursor-pointer"
              >
                {isChangingPass ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" /> Đang cập nhật...
                  </span>
                ) : (
                  'Cập nhật mật khẩu mới'
                )}
              </Button>
            </form>
          </div>

          {/* App Version & Update Section */}
          <div className="pt-3 border-t border-border space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">Phiên bản ứng dụng:</span>
              <span className="font-mono font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border">v{CURRENT_APP_VERSION}</span>
            </div>
            {onCheckUpdates && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCheckUpdates}
                className="w-full rounded-xl text-xs font-bold gap-1.5 cursor-pointer hover:bg-muted"
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Kiểm tra bản cập nhật</span>
              </Button>
            )}
          </div>

          {/* Sign Out Action */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer"
            >
              <LogOut className="size-3.5 mr-2" />
              Đăng xuất khỏi tài khoản
            </Button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ADMIN ONLY: TRUNG TÂM PHÁT SÓNG THÔNG BÁO TOÀN HỆ THỐNG
         ========================================================================= */}
      {isAdmin && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xs">
                <Crown className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-foreground">Trung Tâm Phát Sóng Thông Báo (Admin Privileges)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
                    Chế độ Quản trị
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gửi thông báo xuất hiện tức thời trên Notification Bar của người dùng khác hoặc chính bạn để kiểm thử.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                refreshAnnouncements();
                loadMembers();
              }}
              disabled={isLoadingAnnouncements || isLoadingMembers}
              className="rounded-xl text-xs font-bold border-border hover:bg-muted"
            >
              {isLoadingAnnouncements || isLoadingMembers ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Radio className="size-3.5 text-amber-500 mr-1.5" />
              )}
              Làm mới danh sách
            </Button>
          </div>

          <form onSubmit={handleSendAnnouncement} className="space-y-4">
            {/* Target Selection & Quick Test Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Đối tượng nhận thông báo:</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdminTarget('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    adminTarget === 'all'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  🌐 Toàn bộ người dùng (All Users)
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTarget('specific')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    adminTarget === 'specific'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  🎯 Đích danh người dùng (Specific Member)
                </button>
              </div>

              {adminTarget === 'specific' && (
                <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" />
                      Chọn thành viên nhận thông báo:
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {isLoadingMembers ? 'Đang tải danh sách...' : `${registeredMembers.length} thành viên khả dụng`}
                    </span>
                  </div>

                  <select
                    value={adminTargetEmail}
                    onChange={(e) => setAdminTargetEmail(e.target.value)}
                    required
                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Chọn thành viên từ danh sách đã đăng ký --</option>
                    {registeredMembers.map((member) => (
                      <option key={member.uid} value={member.email}>
                        {member.displayName} ({member.email})
                        {member.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? ' • [Admin / Bạn]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Loại thông báo & Phong cách hiển thị:</label>
              <div className="flex items-center gap-2">
                {[
                  { id: 'info', label: 'Thông Tin (Standard)' },
                  { id: 'warning', label: 'Cảnh Báo (Warning)' },
                  { id: 'urgent', label: 'Khẩn Cấp (Urgent)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminType(t.id as AnnouncementType)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      adminType === t.id
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Nội dung văn bản thông báo:</label>
              <textarea
                required
                rows={3}
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="Nhập nguyên văn thông báo sẽ hiển thị trực tiếp trên thanh thông báo ở máy người dùng..."
                className="w-full p-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden resize-none"
              />
            </div>

            {/* Send Button */}
            <div className="flex items-center justify-end">
              <Button
                type="submit"
                disabled={isSendingAnnouncement}
                className="rounded-xl text-xs font-bold bg-primary text-white hover:opacity-95 cursor-pointer px-5"
              >
                {isSendingAnnouncement ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Đang phát sóng...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="size-3.5" /> Phát sóng thông báo ngay
                  </span>
                )}
              </Button>
            </div>
          </form>

          {/* Active Announcements List */}
          {activeAnnouncements.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-foreground flex items-center gap-1.5">
                  <Bell className="size-3.5 text-amber-500" />
                  Các thông báo đang hiển thị trực tuyến ({activeAnnouncements.length}):
                </span>
              </div>

              <div className="space-y-2">
                {activeAnnouncements.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-border/80 bg-background flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground uppercase">
                          {item.type}
                        </span>
                        <span className="text-[11px] font-bold text-primary">
                          {item.target === 'all' ? '🌐 Toàn hệ thống' : `🎯 Đích danh: ${item.targetEmail}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(item.createdAt).toLocaleTimeString('vi-VN')}
                        </span>
                      </div>
                      <p className="font-medium text-foreground truncate select-text">
                        {item.message}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivateAnnouncement(item.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl text-xs font-bold cursor-pointer shrink-0"
                      title="Thu hồi / Hủy phát sóng thông báo này"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Thu hồi
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          AVATAR PICKER MODAL (16 PRO CURATED AVATARS)
         ========================================================================= */}
      {avatarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">Chọn Ảnh Đại Diện</h3>
                <p className="text-xs text-muted-foreground">Chọn linh vật đại diện phong cách học tập của bạn</p>
              </div>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 16 Preset Avatars Grid */}
            <div className="grid grid-cols-4 gap-3 py-2">
              {PRESET_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => handleSelectAvatar(av.emoji)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    avatarDisplay === av.emoji
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <span className="text-3xl select-none">{av.emoji}</span>
                  <span className="text-[10px] font-bold text-muted-foreground truncate w-full text-center">
                    {av.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom URL Input */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <label className="text-xs font-bold text-foreground">Hoặc nhập liên kết ảnh (URL):</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="flex-1 h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (customAvatarUrl.trim()) handleSelectAvatar(customAvatarUrl.trim());
                  }}
                  className="rounded-xl text-xs font-bold"
                >
                  Áp dụng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
