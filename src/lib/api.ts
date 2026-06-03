export async function generateArticle(id: string, title: string, summary: string, category: string) {
  const res = await fetch('/api/generate-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, title, summary, category }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to generate article');
  }
  return res.json();
}
