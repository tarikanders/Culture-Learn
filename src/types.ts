export type Mode = 'foryou' | 'news' | 'stories' | 'podcast' | 'history';

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
  imagePrompt?: string;
}

export interface TranscriptLine {
  speaker: 1 | 2;
  name: string;
  text: string;
}

export interface GenerationResponse {
  id?: string;
  title: string;
  summary: string;
  transcript: TranscriptLine[];
  audioBase64?: string;
  audioError?: string;
  createdAt?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
}

export interface UserProfile {
  interactions: Record<string, number>;
}
