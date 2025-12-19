
import { Document, Chunk } from "../types";

export const processDocument = (title: string, content: string): Document => {
  const id = Math.random().toString(36).substring(7);
  // Simple chunking: split by paragraphs or double newlines
  const rawChunks = content.split(/\n\n+/).filter(c => c.trim().length > 0);
  
  const chunks: Chunk[] = rawChunks.map((text, idx) => ({
    id: `${id}-chunk-${idx}`,
    docId: id,
    text: text.trim()
  }));

  return {
    id,
    title,
    content,
    chunks,
    timestamp: Date.now()
  };
};

export const retrieveChunks = (query: string, documents: Document[], topK = 3): Chunk[] => {
  const allChunks: Chunk[] = documents.flatMap(doc => doc.chunks);
  const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);

  // Simple keyword-based scoring (BM25 simulation)
  const scoredChunks = allChunks.map(chunk => {
    let score = 0;
    const text = chunk.text.toLowerCase();
    queryTerms.forEach(term => {
      if (text.includes(term)) score += 1;
    });
    return { ...chunk, score };
  });

  return scoredChunks
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .filter(c => (c.score || 0) > 0)
    .slice(0, topK);
};
