import { FeedItem } from '../types';

const FEED_TTL = 25 * 60 * 1000;      // 25 min (under server's 30min)
const FEED_FRESH = 5 * 60 * 1000;     // consider fresh for 5 min, no background refresh
const ARTICLE_TTL = 24 * 60 * 60 * 1000; // 24h

export function getCachedFeed(tab: string): FeedItem[] | null {
  try {
    const raw = localStorage.getItem(`cl_feed_${tab}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > FEED_TTL) return null;
    return data;
  } catch { return null; }
}

export function setCachedFeed(tab: string, data: FeedItem[]) {
  try {
    localStorage.setItem(`cl_feed_${tab}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function isFeedFresh(tab: string): boolean {
  try {
    const raw = localStorage.getItem(`cl_feed_${tab}`);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts < FEED_FRESH;
  } catch { return false; }
}

export function getCachedArticle(id: string): Pick<FeedItem, 'content' | 'didYouKnow' | 'tags'> | null {
  try {
    const raw = localStorage.getItem(`cl_article_${id}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ARTICLE_TTL) return null;
    return data;
  } catch { return null; }
}

export function setCachedArticle(id: string, data: Pick<FeedItem, 'content' | 'didYouKnow' | 'tags'>) {
  try {
    localStorage.setItem(`cl_article_${id}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}
