import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, firestore } from '@/firebase';
import { dbService } from '@/services/db';
import type { ProgressExportData } from '@/types/quiz';

/**
 * ========================================================
 * 1. FIREBASE AUTHENTICATION (XÁC THỰC NGƯỜI DÙNG)
 * ========================================================
 */

export interface UserProfileData {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  createdAt: any;
  lastLoginAt: any;
  xp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  achievements: string[]; // IDs of unlocked badges
  targetExam?: string;
}

/**
 * Đăng ký tài khoản mới bằng Email và Mật khẩu
 */
export async function signUp(email: string, password: string, displayName?: string): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;
  const name = displayName?.trim() || email.split('@')[0];

  await updateProfile(user, { displayName: name });

  // Khởi tạo hồ sơ người dùng trên Firestore với các thông số Gamification
  try {
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(firestore, `users/${user.uid}`), {
      uid: user.uid,
      email: user.email,
      displayName: name,
      photoURL: null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      xp: 0,
      level: 1,
      streakDays: 1,
      lastActiveDate: today,
      achievements: ['first_step'],
      targetExam: 'Fast Track 2026',
    }, { merge: true });
  } catch (err) {
    console.warn('Lưu hồ sơ người dùng ban đầu gặp lỗi (offline hoặc quyền):', err);
  }

  return user;
}

/**
 * Đăng nhập bằng Email và Mật khẩu
 */
export async function signIn(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Cập nhật mốc thời gian đăng nhập gần nhất
  try {
    await setDoc(doc(firestore, `users/${user.uid}`), {
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Không chặn luồng nếu đang offline
  }

  return user;
}

/**
 * Gửi email đặt lại mật khẩu từ Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!email || !email.trim()) {
    throw new Error('Vui lòng nhập địa chỉ Email.');
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Đổi mật khẩu tài khoản (Yêu cầu mật khẩu cũ để xác thực an toàn)
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Bạn chưa đăng nhập vào hệ thống.');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải có độ dài ít nhất 6 ký tự.');
  }

  // 1. Xác thực lại với mật khẩu hiện tại
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // 2. Cập nhật mật khẩu mới
  await updatePassword(user, newPassword);
}

/**
 * Cập nhật thông tin hiển thị (Tên và Avatar)
 */
export async function updateUserProfileData(
  displayName?: string, 
  photoURL?: string | null
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const updates: { displayName?: string; photoURL?: string | null } = {};
  if (displayName !== undefined) updates.displayName = displayName.trim();
  if (photoURL !== undefined) updates.photoURL = photoURL;

  // 1. Update Auth profile
  await updateProfile(user, updates);

  // 2. Update Firestore user doc
  try {
    await setDoc(doc(firestore, `users/${user.uid}`), {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Lỗi cập nhật profile lên Firestore:', err);
  }
}

/**
 * Đọc hồ sơ cá nhân đầy đủ từ Firestore
 */
export async function getUserProfileData(userId: string): Promise<UserProfileData | null> {
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(firestore, `users/${userId}`));
    if (!snap.exists()) return null;
    return snap.data() as UserProfileData;
  } catch {
    return null;
  }
}

/**
 * Đăng xuất khỏi hệ thống
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Lấy đối tượng người dùng hiện tại
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Lắng nghe thay đổi trạng thái đăng nhập
 */
export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * ========================================================
 * 2. GAMIFICATION & LEVEL & STREAK SYSTEM (HỆ THỐNG XP & DANH HIỆU)
 * ========================================================
 */

export interface LevelInfo {
  level: number;
  title: string;
  badgeColor: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

/**
 * Tính toán Cấp độ và Danh hiệu từ tổng điểm XP
 */
export function calculateLevel(totalXp: number = 0): LevelInfo {
  // Mỗi level cần (level * 150) XP. 
  // Level 1: 0 - 150, Level 2: 150 - 450, v.v.
  let level = 1;
  let accumulated = 0;
  while (true) {
    const cost = level * 150;
    if (totalXp < accumulated + cost || level >= 99) {
      const currentLevelXp = totalXp - accumulated;
      const progressPercent = Math.min(100, Math.round((currentLevelXp / cost) * 100));
      
      let title = 'Tập Sự Năng Động';
      let badgeColor = 'from-amber-500 to-orange-500';
      if (level >= 10) { title = 'Học Viên Chuyên Cần'; badgeColor = 'from-blue-500 to-cyan-500'; }
      if (level >= 25) { title = 'Lập Trình Viên Tri Thức'; badgeColor = 'from-emerald-500 to-teal-500'; }
      if (level >= 50) { title = 'Kỹ Sư Kiến Trúc Cấp Cao'; badgeColor = 'from-purple-500 to-indigo-500'; }
      if (level >= 75) { title = 'Bậc Thầy Fast-Track'; badgeColor = 'from-rose-500 to-amber-500'; }

      return {
        level,
        title,
        badgeColor,
        currentLevelXp,
        nextLevelXp: cost,
        progressPercent,
      };
    }
    accumulated += cost;
    level++;
  }
}

/**
 * Cộng thêm XP và tự động cập nhật chuỗi Streak
 */
export async function addXP(userId: string, points: number): Promise<void> {
  if (!userId || points <= 0) return;

  try {
    const userRef = doc(firestore, `users/${userId}`);
    const snap = await getDoc(userRef);
    const data = snap.data() || {};
    const currentXp = (data.xp || 0) + points;
    const { level } = calculateLevel(currentXp);

    const today = new Date().toISOString().split('T')[0];
    let streakDays = data.streakDays || 1;
    const lastActiveDate = data.lastActiveDate || '';

    if (lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastActiveDate === yesterday) {
        streakDays += 1;
      } else if (lastActiveDate < yesterday) {
        streakDays = 1; // reset streak if missed
      }
    }

    await setDoc(userRef, {
      xp: currentXp,
      level,
      streakDays,
      lastActiveDate: today,
    }, { merge: true });
  } catch (err) {
    console.warn('Lỗi lưu XP:', err);
  }
}

/**
 * Ghi nhận hoạt động hàng ngày vào Calendar Heatmap
 */
export async function recordDailyActivity(
  userId: string, 
  questionCount: number, 
  correctCount: number
): Promise<void> {
  if (!userId) return;

  const today = new Date().toISOString().split('T')[0];
  try {
    const actRef = doc(firestore, `users/${userId}/activity/${today}`);
    const snap = await getDoc(actRef);
    const existing = snap.data() || { count: 0, correct: 0 };

    await setDoc(actRef, {
      date: today,
      count: (existing.count || 0) + questionCount,
      correct: (existing.correct || 0) + correctCount,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Lỗi ghi nhật ký hoạt động:', err);
  }
}

/**
 * Lấy lịch sử hoạt động để vẽ Activity Heatmap (GitHub-style)
 */
export async function getActivityHistory(userId: string): Promise<Record<string, { count: number; correct: number }>> {
  if (!userId) return {};

  try {
    const colRef = collection(firestore, `users/${userId}/activity`);
    const snap = await getDocs(colRef);
    const map: Record<string, { count: number; correct: number }> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      map[d.id] = { count: data.count || 0, correct: data.correct || 0 };
    });
    return map;
  } catch {
    return {};
  }
}

/**
 * ========================================================
 * 3. ACHIEVEMENTS & BADGES (KỆ HUY HIỆU THÀNH TỰU)
 * ========================================================
 */

export interface AchievementBadge {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  color: string;
}

export const SYSTEM_BADGES: AchievementBadge[] = [
  { id: 'first_step', title: 'Khởi Đầu Mới', desc: 'Tạo tài khoản và tham gia nền tảng Quiz Learning Pro', icon: '🚀', unlocked: true, color: 'text-blue-500' },
  { id: 'first_blood', title: 'Chiến Tích Đầu Tiên', desc: 'Trả lời chính xác câu hỏi trắc nghiệm đầu tiên', icon: '🎯', unlocked: true, color: 'text-amber-500' },
  { id: 'streak_3', title: 'Giữ Lửa 3 Ngày', desc: 'Duy trì chuỗi học tập liên tục trong 3 ngày', icon: '🔥', unlocked: false, color: 'text-orange-500' },
  { id: 'streak_7', title: 'Kỷ Luật Thép', desc: 'Duy trì chuỗi học tập liên tục trong 7 ngày', icon: '🛡️', unlocked: false, color: 'text-red-500' },
  { id: 'leitner_master', title: 'Bậc Thầy Leitner', desc: 'Đưa ít nhất 50 câu hỏi vào Hộp 5 (Trí nhớ dài hạn)', icon: '👑', unlocked: false, color: 'text-yellow-500' },
  { id: 'busy_worker', title: 'Chiến Binh Bận Rộn', desc: 'Hoàn thành 20 câu hỏi xuất hiện từ chế độ Busy Mode', icon: '💼', unlocked: false, color: 'text-purple-500' },
  { id: 'night_owl', title: 'Cú Đêm Tri Thức', desc: 'Ôn luyện chăm chỉ trong khung giờ từ 23:00 đến 04:00', icon: '🦉', unlocked: false, color: 'text-indigo-400' },
  { id: 'speed_demon', title: 'Tốc Độ Ánh Sáng', desc: 'Trả lời đúng liên tiếp với tốc độ phản xạ dưới 5 giây', icon: '⚡', unlocked: false, color: 'text-yellow-400' },
];

/**
 * ========================================================
 * 4. FIRESTORE CLOUD SYNC BRIDGE (ĐỒNG BỘ TIẾN ĐỘ LOCAL-FIRST)
 * ========================================================
 */

/**
 * Lưu toàn bộ snapshot tiến độ học tập (Hộp Leitner, bookmark, phiên thi) của user lên Firestore
 * Vị trí tài liệu: /users/{userId}/progress/latest
 */
export async function saveUserProgress(
  userId: string, 
  progressData: ProgressExportData
): Promise<void> {
  if (!userId) throw new Error('Yêu cầu userId để lưu tiến độ lên Cloud');

  const progressRef = doc(firestore, `users/${userId}/progress/latest`);
  await setDoc(progressRef, {
    ...progressData,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Đọc tiến độ học tập mới nhất của user từ Firestore
 */
export async function getUserProgress(userId: string): Promise<ProgressExportData | null> {
  if (!userId) return null;

  const progressRef = doc(firestore, `users/${userId}/progress/latest`);
  const snap = await getDoc(progressRef);

  if (!snap.exists()) {
    return null;
  }

  return snap.data() as ProgressExportData;
}

/**
 * Đẩy toàn bộ tiến độ hiện tại từ SQLite cục bộ lên Cloud Firestore
 */
export async function syncLocalToCloud(userId: string): Promise<{ questionsCount: number; exportedAt: number }> {
  if (!userId) throw new Error('Chưa đăng nhập tài khoản');

  // 1. Trích xuất tiến độ từ SQLite nội bộ
  const localJson = await dbService.exportProgressJSON();
  const parsedData: ProgressExportData = JSON.parse(localJson);

  // 2. Ghi lên Firestore
  await saveUserProgress(userId, parsedData);

  // 3. Ghi nhận mốc sync vào profile
  try {
    await setDoc(doc(firestore, `users/${userId}`), {
      lastSyncedAt: serverTimestamp(),
      syncedQuestionsCount: parsedData.question_stats.length,
    }, { merge: true });
  } catch {}

  return {
    questionsCount: parsedData.question_stats.length,
    exportedAt: parsedData.exported_at,
  };
}

/**
 * Kéo tiến độ từ Cloud Firestore về và hòa trộn vào SQLite cục bộ
 */
export async function pullCloudToLocal(
  userId: string,
  mergeMode: 'merge' | 'overwrite' = 'merge'
): Promise<{ importedStats: number; importedSessions: number }> {
  if (!userId) throw new Error('Chưa đăng nhập tài khoản');

  // 1. Lấy dữ liệu từ Cloud
  const cloudData = await getUserProgress(userId);
  if (!cloudData) {
    return { importedStats: 0, importedSessions: 0 };
  }

  // 2. Nạp vào SQLite
  const jsonString = JSON.stringify(cloudData);
  return await dbService.importProgressJSON(jsonString, mergeMode);
}
