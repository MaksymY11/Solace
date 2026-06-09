// Parses the research agent's structured [Citations...] section into clickable pills.
// Cleans answer text by stripping markdown links, Bing markers, and orphaned punctuation.

export interface Citation {
  name: string;
  url: string;
}

export interface ParsedCitations {
  cleanedText: string;
  citations: Citation[];
}

export function parseCitations(answerText: string, citationsSection?: string): ParsedCitations {

  const cleanedText = answerText
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/\s*\(\s*\)/g, '')
      .replace(/【[^】]*】/g, '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ +\./g, '.')
      .trim()

  const citations: Citation[] = [];
  if (citationsSection) {
    for (const line of citationsSection.split('\n')) {
      const parts = line.split(' | ')
      if (parts.length === 2 && parts[1].startsWith('http')) {
        citations.push({name: parts[0].trim(), url: parts[1].trim()})
      }
    }
  }

  return {cleanedText, citations};
}
