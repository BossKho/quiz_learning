// Service managing global submerged application wallpaper

export interface WallpaperSettings {
  enabled: boolean;
  imageUrl: string | null;
  opacity: number; // 0.05 to 0.60
  blur: number;    // 0 to 20 px
}

export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  enabled: false,
  imageUrl: null,
  opacity: 0.18,
  blur: 0,
};

const STORAGE_SETTINGS_KEY = 'quiz_app_wallpaper_meta';
const DB_NAME = 'QuizAppWallpaperDB';
const STORE_NAME = 'wallpapers';
const DB_VERSION = 1;

// IndexedDB Helper for storing large image files / data URLs without 5MB quota errors
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImageToDB(dataUrl: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(dataUrl, 'current_wallpaper');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getImageFromDB(): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_wallpaper');
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function deleteImageFromDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete('current_wallpaper');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

type WallpaperListener = (settings: WallpaperSettings) => void;

class WallpaperService {
  private settings: WallpaperSettings = DEFAULT_WALLPAPER_SETTINGS;
  private listeners = new Set<WallpaperListener>();
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === 'undefined') return;
    try {
      const meta = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (meta) {
        const parsed = JSON.parse(meta);
        this.settings = { ...DEFAULT_WALLPAPER_SETTINGS, ...parsed, imageUrl: null };
      }
      // Load actual image data from IndexedDB
      const img = await getImageFromDB();
      if (img && this.settings.enabled) {
        this.settings.imageUrl = img;
      }
      this.initialized = true;
      this.notify();
    } catch {
      this.settings = { ...DEFAULT_WALLPAPER_SETTINGS };
      this.initialized = true;
    }
  }

  public getSettings(): WallpaperSettings {
    return { ...this.settings };
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public async setWallpaperImage(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          await saveImageToDB(dataUrl);
          this.settings.imageUrl = dataUrl;
          this.settings.enabled = true;
          this.saveMeta();
          this.notify();
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  public async removeWallpaper(): Promise<void> {
    await deleteImageFromDB();
    this.settings.imageUrl = null;
    this.settings.enabled = false;
    this.saveMeta();
    this.notify();
  }

  public updateDisplaySettings(partial: Partial<Pick<WallpaperSettings, 'opacity' | 'blur' | 'enabled'>>) {
    this.settings = { ...this.settings, ...partial };
    this.saveMeta();
    this.notify();
  }

  private saveMeta() {
    try {
      const metaToSave = {
        enabled: this.settings.enabled,
        opacity: this.settings.opacity,
        blur: this.settings.blur,
      };
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(metaToSave));
    } catch {}
  }

  public subscribe(listener: WallpaperListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const current = this.getSettings();
    this.listeners.forEach((l) => l(current));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quiz_wallpaper_updated', { detail: current }));
    }
  }
}

export const wallpaperService = new WallpaperService();

