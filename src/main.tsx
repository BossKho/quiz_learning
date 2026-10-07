import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BusyPopupWindow } from '@/views/BusyPopupWindow'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Register Global Crash Prevention & Telemetry
if (typeof window !== 'undefined') {
  // Global F5 and Ctrl+R recovery hotkeys for desktop WebView2
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      window.location.reload();
    }
  });

  // Global uncaught JS error logger
  window.addEventListener('error', (event) => {
    try {
      const crashLog = {
        timestamp: new Date().toISOString(),
        message: event.message,
        source: `${event.filename}:${event.lineno}:${event.colno}`,
        stack: event.error?.stack || '',
      };
      const existing = JSON.parse(localStorage.getItem('quiz_crash_history') || '[]');
      existing.unshift(crashLog);
      if (existing.length > 5) existing.length = 5;
      localStorage.setItem('quiz_crash_history', JSON.stringify(existing));
    } catch {}
  });

  // Global unhandled promise rejection logger
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const crashLog = {
        timestamp: new Date().toISOString(),
        message: reason?.message || String(reason),
        stack: reason?.stack || '',
        type: 'UnhandledPromiseRejection',
      };
      const existing = JSON.parse(localStorage.getItem('quiz_crash_history') || '[]');
      existing.unshift(crashLog);
      if (existing.length > 5) existing.length = 5;
      localStorage.setItem('quiz_crash_history', JSON.stringify(existing));
    } catch {}
  });
}

const isBusyPopupWindow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('window') === 'busy_popup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isBusyPopupWindow ? <BusyPopupWindow /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
