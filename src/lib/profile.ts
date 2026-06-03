import localforage from 'localforage';
import { UserProfile } from '../types';

export async function getProfile(): Promise<UserProfile> {
  const p = await localforage.getItem<UserProfile>('user_profile');
  return p || { interactions: {} };
}

export async function updateProfile(tagOrCategory: string, weight: number = 1) {
  const p = await getProfile();
  if (!p.interactions) p.interactions = {};
  const current = p.interactions[tagOrCategory] || 0;
  p.interactions[tagOrCategory] = Math.max(-20, Math.min(50, current + weight));
  await localforage.setItem('user_profile', p);
}

export async function getTopPreferences(): Promise<{ liked: string[]; disliked: string[] }> {
  const p = await getProfile();
  const entries = Object.entries(p.interactions || {}).sort((a, b) => b[1] - a[1]);
  // Top 8 liked topics (raised from 5) for more precise personalisation
  const liked = entries.filter(([, v]) => v > 3).slice(0, 8).map(([k]) => k);
  const disliked = entries.filter(([, v]) => v < -2).slice(0, 4).map(([k]) => k);
  return { liked, disliked };
}
