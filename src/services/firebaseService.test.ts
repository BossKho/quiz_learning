import { describe, it, expect } from 'vitest';
import { calculateLevel, SYSTEM_BADGES } from './firebaseService';

describe('FirebaseService Gamification Engine', () => {
  it('calculates level 1 for 0 XP', () => {
    const levelInfo = calculateLevel(0);
    expect(levelInfo.level).toBe(1);
    expect(levelInfo.title).toBe('Tập Sự Năng Động');
    expect(levelInfo.progressPercent).toBe(0);
  });

  it('calculates level progression as XP increases', () => {
    // Level 1: 0 - 150 XP
    const lvl1 = calculateLevel(75);
    expect(lvl1.level).toBe(1);
    expect(lvl1.progressPercent).toBe(50);

    // Level 2: 150 - 450 XP (cost is 300)
    const lvl2 = calculateLevel(150);
    expect(lvl2.level).toBe(2);
    expect(lvl2.currentLevelXp).toBe(0);

    // High level title check
    const lvl15 = calculateLevel(15000);
    expect(lvl15.level).toBeGreaterThanOrEqual(10);
    expect(lvl15.title).not.toBe('Tập Sự Năng Động');
  });

  it('contains expected system badges', () => {
    expect(SYSTEM_BADGES.length).toBeGreaterThanOrEqual(8);
    const firstStep = SYSTEM_BADGES.find((b) => b.id === 'first_step');
    expect(firstStep).toBeDefined();
    expect(firstStep?.unlocked).toBe(true);
  });
});

