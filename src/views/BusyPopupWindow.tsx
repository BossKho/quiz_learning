import React, { useState, useEffect } from 'react';
import { BusyPopup } from '@/components/BusyPopup';
import { dbService } from '@/services/db';

export const BusyPopupWindow: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  // Sync theme between windows via localStorage
  useEffect(() => {
    const applyTheme = () => {
      const saved = localStorage.getItem('theme');
      if (saved === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    };
    applyTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        applyTheme();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Ensure window is truly transparent so DWM doesn't paint a white frame
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  useEffect(() => {
    async function init() {
      await dbService.init();
      setIsReady(true);
      // NOTE: Do NOT auto-trigger question on mount!
      // This window must remain quiet until the main window timer fires or user tests it.
    }
    init();
  }, []);

  if (!isReady) return null;

  return (
    <div className="h-screen w-screen p-2.5 bg-transparent overflow-hidden flex flex-col justify-end select-none">
      <BusyPopup isStandaloneWindow={true} />
    </div>
  );
};
