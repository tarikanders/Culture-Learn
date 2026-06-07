import { FeedItem, UserProfile } from '../types';

// Epsilon-greedy exploration weight.
// Each item gets a random bonus in [0, EXPLORATION_WEIGHT] added to its affinity score.
// → Liked topics win most of the time, but new topics occasionally surface
//   (avoids filter bubble, a core TikTok design choice).
const EXPLORATION_WEIGHT = 3;

/**
 * Score a single feed item against the user profile.
 * Higher = more relevant to the user right now (after temporal decay was applied).
 */
export function scoreItem(item: FeedItem, profile: UserProfile): number {
  const interactions = profile.interactions || {};
  let score = 0;

  // Category affinity (full weight).
  // Keys in interactions are stored as-is from updateProfile calls.
  score += interactions[item.category] || 0;

  // Tag affinities (60% weight each).
  if (item.tags) {
    for (const tag of item.tags) {
      score += (interactions[tag] || 0) * 0.6;
    }
  }

  // Slight recency bonus for items explicitly dated "today" (news).
  if (item.date && item.date.toLowerCase().includes("aujourd")) {
    score += 0.5;
  }

  return score;
}

/**
 * Rank a list of feed items by relevance to the user profile.
 * Uses epsilon-greedy: adds random noise so the algorithm explores
 * occasionally rather than always showing the same categories.
 */
export function rankItems(items: FeedItem[], profile: UserProfile): FeedItem[] {
  const scored = items.map((item) => ({
    item,
    score: scoreItem(item, profile) + Math.random() * EXPLORATION_WEIGHT,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
