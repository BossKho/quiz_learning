import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { safeJsonParse } from '@/services/db';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] || null,
    length: 0,
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { href: 'http://localhost/', pathname: '/', origin: 'http://localhost' },
  } as any;
}

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {
    userAgent: 'Vitest Environment',
  } as any;
}

describe('Crash Prevention & Recovery System', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('ErrorBoundary Class Logic', () => {
    it('getDerivedStateFromError updates state to hasError: true', () => {
      const err = new Error('Test crash error');
      const state = ErrorBoundary.getDerivedStateFromError(err);
      expect(state.hasError).toBe(true);
      expect(state.error).toBe(err);
    });

    it('componentDidCatch persists crash telemetry to localStorage', () => {
      const boundary = new ErrorBoundary({ children: null });
      const error = new Error('Simulated critical crash');
      const errorInfo = { componentStack: '\n    in ProblematicComponent\n    in App' };

      // Suppress console.error during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      boundary.componentDidCatch(error, errorInfo);

      const savedHistory = localStorage.getItem('quiz_crash_history');
      expect(savedHistory).toBeTruthy();
      const history = JSON.parse(savedHistory!);
      expect(history.length).toBe(1);
      expect(history[0].message).toBe('Simulated critical crash');
      expect(history[0].componentStack).toContain('in ProblematicComponent');

      const lastReport = localStorage.getItem('quiz_last_crash_report');
      expect(lastReport).toBeTruthy();
      const report = JSON.parse(lastReport!);
      expect(report.name).toBe('Error');

      consoleSpy.mockRestore();
    });

    it('renders fallback when hasError is true', () => {
      const boundary = new ErrorBoundary({ children: 'Healthy Content' });
      boundary.state = {
        hasError: true,
        error: new Error('Visual Error'),
        errorInfo: { componentStack: 'stack' },
        copied: false,
      };

      const result = boundary.render();
      expect(result).not.toBe('Healthy Content');
      expect(React.isValidElement(result)).toBe(true);
    });

    it('renders custom fallback when provided and hasError is true', () => {
      const customFallback = React.createElement('div', null, 'Custom Fallback UI');
      const boundary = new ErrorBoundary({ children: 'Healthy Content', fallback: customFallback });
      boundary.state = {
        hasError: true,
        error: new Error('Visual Error'),
        errorInfo: { componentStack: 'stack' },
        copied: false,
      };

      const result = boundary.render();
      expect(result).toBe(customFallback);
    });
  });

  describe('safeJsonParse', () => {
    it('correctly parses valid JSON string', () => {
      const result = safeJsonParse('{"key":"value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('safely returns fallback when JSON is malformed without crashing', () => {
      const fallback = [1, 2, 3];
      const result = safeJsonParse('{malformed json string', fallback);
      expect(result).toEqual(fallback);
    });

    it('safely returns fallback when input is empty or null or undefined', () => {
      expect(safeJsonParse(null, 'default')).toBe('default');
      expect(safeJsonParse('', [])).toEqual([]);
      expect(safeJsonParse(undefined, 123)).toBe(123);
    });
  });
});

