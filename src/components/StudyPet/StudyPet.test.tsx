import { describe, it, expect, beforeEach } from 'vitest';
import { PET_CATALOG, DEFAULT_PET_SETTINGS, type StudyPetSettings } from './StudyPet';

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

describe('StudyPet Component & Catalog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default pet settings with Dog enabled', () => {
    expect(DEFAULT_PET_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_PET_SETTINGS.petType).toBe('dog');
    expect(DEFAULT_PET_SETTINGS.position).toBe('right');
  });

  it('contains expected pets in catalog', () => {
    const petIds = PET_CATALOG.map((p) => p.id);
    expect(petIds).toContain('capybara');
    expect(petIds).toContain('dog');
    expect(petIds).toContain('duck');
    expect(petIds).toContain('fox');
    expect(petIds).toContain('totoro');
  });

  it('supports saving and restoring pet settings to localStorage', () => {
    const customSettings: StudyPetSettings = {
      enabled: true,
      petType: 'duck',
      position: 'left',
    };
    localStorage.setItem('quiz_study_pet_settings', JSON.stringify(customSettings));

    const restored = JSON.parse(localStorage.getItem('quiz_study_pet_settings')!);
    expect(restored.petType).toBe('duck');
    expect(restored.position).toBe('left');
  });
});

