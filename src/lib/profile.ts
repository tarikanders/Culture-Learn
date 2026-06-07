import localforage from 'localforage';
import { UserProfile } from '../types';

// Temporal decay: score halves every HALF_LIFE_DAYS days.
// Recent interest weighs more than old interest — TikTok core mechanic.
const HALF_LIFE_DAYS = 7;

export async function getProfile(): Promise<UserProfile> {
  const p = await localforage.getItem<UserProfile>('user_profile');
  const profile: UserProfile = p || { interactions: {}, lastDecay: Date.now() };

  // Migration: ensure fields exist
  if (!profile.interactions) profile.interactions = {};
  if (!profile.lastDecay) profile.lastDecay = Date.now();

  // Apply exponential decay if enough time has passed (avoid micro-decays < 2h)
  const now = Date.now();
  const elapsedDays = (now - profile.lastDecay) / (1000 * 60 * 60 * 24);
  if (elapsedDays > 0.08) {
    const factor = Math.pow(0.5, elapsedDays / HALF_LIFE_DAYS);
    for (const key of Object.keys(profile.interactions)) {
      profile.interactions[key] = profile.interactions[key] * factor;
    }
    profile.lastDecay = now;
    await localforage.setItem('user_profile', profile);
  }

  return profile;
}

export async function updateProfile(tagOrCategory: string, weight: number = 1) {
  const p = await getProfile();
  if (!p.interactions) p.interactions = {};
  const current = p.interactions[tagOrCategory] || 0;
  p.interactions[tagOrCategory] = Math.max(-20, Math.min(50, current + weight));
  await localforage.setItem('user_profile', p);
}

/**
 * Record implicit engagement signal (TikTok-style).
 * Called when the user leaves an article — captures dwell time + read completion.
 *
 * Score logic:
 *  - fast bounce (<4 s)     → strong negative (-3): user didn't want this
 *  - short dwell (4–15 s)   → maps linearly from 0 to +2
 *  - long dwell (>15 s)     → +2 base (they stayed)
 *  - completion boost       → completion(0..1) × 3 (read to the end = +3)
 *  - per-event delta clamped to [-4, +6]
 *  - category gets full weight; tags get 60% weight
 */
export async function recordEngagement(
  category: string,
  tags: string[] | undefined,
  { dwellMs, completion }: { dwellMs: number; completion: number }
) {
  let dwellScore: number;
  if (dwellMs < 4_000) {
    dwellScore = -3; // fast bounce
  } else if (dwellMs < 15_000) {
    dwellScore = ((dwellMs - 4_000) / 11_000) * 2; // linear 0..+2
  } else {
    dwellScore = 2;
  }

  const completionScore = completion * 3; // fully read → +3
  const delta = Math.max(-4, Math.min(6, dwellScore + completionScore));

  await updateProfile(category, delta);
  if (tags) {
    for (const tag of tags) {
      await updateProfile(tag, delta * 0.6);
    }
  }
}

export async function getTopPreferences(): Promise<{ liked: string[]; disliked: string[] }> {
  const p = await getProfile();
  const entries = Object.entries(p.interactions || {}).sort((a, b) => b[1] - a[1]);
  // Top 8 liked topics for more precise personalisation
  const liked = entries.filter(([, v]) => v > 3).slice(0, 8).map(([k]) => k);
  const disliked = entries.filter(([, v]) => v < -2).slice(0, 4).map(([k]) => k);
  return { liked, disliked };
}
