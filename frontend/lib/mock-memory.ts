export const memoryPackage = {
  mode: 'demo',
  person: { id: 'meizhen', name: 'Lin Meizhen', chineseName: '林美珍', born: 1954, places: ['Suzhou', 'Shanghai'] },
  source: { type: 'processed-transcript', interviewId: 'demo-interview-001', language: 'en' },
  facts: [
    { text: 'Meizhen left Suzhou for factory work in Shanghai at nineteen.', confidence: 'confirmed' },
    { text: 'Her mother placed a green tea tin in her bag.', confidence: 'confirmed' },
    { text: 'The exact month of departure is not remembered.', confidence: 'uncertain' },
  ],
  media: { status: 'prepared-placeholder', images: [], video: null },
} as const;
