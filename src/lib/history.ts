import localforage from 'localforage';
import { GenerationResponse } from '../types';

localforage.config({
  name: "aistudio-podcast"
});

export async function saveToHistory(item: GenerationResponse) {
  if (!item.id) {
    item.id = Date.now().toString() + Math.random().toString(36).substring(7);
  }
  if (!item.createdAt) {
    item.createdAt = Date.now();
  }
  const history: GenerationResponse[] = await getHistory();
  // check if already saved
  const exists = history.find(h => h.id === item.id);
  if (!exists) {
    history.unshift(item);
    await localforage.setItem('podcasts', history);
  } else {
    // replace if exists to update audioBase64
    const index = history.findIndex(h => h.id === item.id);
    history[index] = item;
    await localforage.setItem('podcasts', history);
  }
  return item;
}

export async function getHistory(): Promise<GenerationResponse[]> {
  const history = await localforage.getItem<GenerationResponse[]>('podcasts');
  return history || [];
}

export async function deleteFromHistory(id: string) {
  const history: GenerationResponse[] = await getHistory();
  const filtered = history.filter(h => h.id !== id);
  await localforage.setItem('podcasts', filtered);
}
