import { UserPreferences } from '../types';

const PREFS_KEY = 'audiobrain_prefs';

export function getPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { categories: {} };
  
  const stored = localStorage.getItem(PREFS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {}
  }
  return { categories: {} };
}

export function updatePreference(category: string, weightChange: number) {
  if (typeof window === 'undefined') return;
  
  const prefs = getPreferences();
  const current = prefs.categories[category] || 0;
  
  // Apply a decay or limit if necessary, but simple add for now
  prefs.categories[category] = current + weightChange;
  
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
