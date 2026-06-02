import localforage from 'localforage';
import { UserProfile } from '../types';

export async function getProfile(): Promise<UserProfile> {
  const p = await localforage.getItem<UserProfile>('user_profile');
  return p || { interactions: {} };
}

export async function updateProfile(tagOrCategory: string, weight: number = 1) {
  const p = await getProfile();
  if (!p.interactions) p.interactions = {};
  p.interactions[tagOrCategory] = (p.interactions[tagOrCategory] || 0) + weight;
  await localforage.setItem('user_profile', p);
}
