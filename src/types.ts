export type Mode = 'foryou' | 'news' | 'stories';

export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  content?: string;
  didYouKnow?: string;
  tags?: string[];
  isGenerated?: boolean;
  date?: string;
  source?: string;
}

export interface UserProfile {
  interactions: Record<string, number>;
  lastDecay?: number; // timestamp of last temporal decay pass
}
