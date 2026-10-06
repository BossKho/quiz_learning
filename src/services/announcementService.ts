import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { firestore } from '@/firebase';

export const ADMIN_EMAIL = 'vithanlangthang333@gmail.com';

export type AnnouncementType = 'info' | 'warning' | 'urgent';
export type AnnouncementTarget = 'all' | 'specific';

export interface SystemAnnouncement {
  id: string;
  message: string;
  target: AnnouncementTarget;
  targetEmail: string | null;
  senderEmail: string;
  type: AnnouncementType;
  createdAt: string;
  active: boolean;
}

const COLLECTION_NAME = 'system_announcements';

/**
 * Checks whether an email address possesses Administrator privileges
 */
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Sends a server broadcast or targeted announcement (Admin only)
 */
export async function sendSystemAnnouncement(params: {
  message: string;
  target: AnnouncementTarget;
  targetEmail?: string | null;
  senderEmail: string;
  type?: AnnouncementType;
}): Promise<SystemAnnouncement> {
  const id = `announcement_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = doc(firestore, COLLECTION_NAME, id);

  const announcement: SystemAnnouncement = {
    id,
    message: params.message.trim(),
    target: params.target,
    targetEmail: params.target === 'specific' ? (params.targetEmail?.trim().toLowerCase() || null) : null,
    senderEmail: params.senderEmail.trim().toLowerCase(),
    type: params.type || 'info',
    createdAt: new Date().toISOString(),
    active: true,
  };

  await setDoc(docRef, announcement);
  return announcement;
}

/**
 * Deactivates or removes an active announcement (Admin only)
 */
export async function deactivateAnnouncement(id: string): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, id);
    await updateDoc(docRef, { active: false });
  } catch (err) {
    console.error('Failed to deactivate announcement:', err);
    throw err;
  }
}

/**
 * Permanently deletes an announcement (Admin only)
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete announcement:', err);
    throw err;
  }
}

/**
 * Fetches all active announcements created by the admin
 */
export async function getActiveAnnouncements(): Promise<SystemAnnouncement[]> {
  try {
    const colRef = collection(firestore, COLLECTION_NAME);
    const q = query(colRef, where('active', '==', true));
    const snap = await getDocs(q);
    const list: SystemAnnouncement[] = [];
    snap.forEach((d) => {
      list.push(d.data() as SystemAnnouncement);
    });
    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.warn('Failed to fetch announcements:', err);
    return [];
  }
}

/**
 * Subscribes to live server announcements targeting all users or the current user specifically
 */
export function subscribeToLiveAnnouncements(
  userEmail: string | null | undefined,
  onUpdate: (activeNotification: SystemAnnouncement | null) => void
): () => void {
  try {
    const colRef = collection(firestore, COLLECTION_NAME);
    const q = query(colRef, where('active', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const matches: SystemAnnouncement[] = [];
        const cleanUserEmail = userEmail?.trim().toLowerCase();

        snapshot.forEach((d) => {
          const item = d.data() as SystemAnnouncement;
          if (!item.active) return;

          if (item.target === 'all') {
            matches.push(item);
          } else if (item.target === 'specific' && cleanUserEmail && item.targetEmail?.toLowerCase() === cleanUserEmail) {
            matches.push(item);
          }
        });

        // Pick the newest active announcement
        if (matches.length > 0) {
          matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          onUpdate(matches[0]);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.warn('Live announcement subscription error:', error);
        onUpdate(null);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Could not establish announcement listener:', err);
    return () => {};
  }
}
