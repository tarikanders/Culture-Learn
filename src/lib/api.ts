import { GenerationResponse, Mode, TranscriptLine } from '../types';

export async function generateContent(mode: Mode, input: string): Promise<GenerationResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ mode, input })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to generate content");
  }

  return res.json();
}

export async function generateAudio(transcript: TranscriptLine[]): Promise<{ audioBase64: string }> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transcript })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to generate audio");
  }

  return res.json();
}
