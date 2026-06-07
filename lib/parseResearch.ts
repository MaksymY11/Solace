export interface ParseResearchResult {
  understanding: string | null;
  researching: string | null;
  applying: string | null;
  confidence: string | null;
  answer: string | null;
  raw: string;
}

/**
 * Extracts sections delimited by [Analyzing your question...], [Researching sources...], etc,
 * from a raw content string.
 *
 * Returns an object with each section's text (or null if not present)
 * and a `raw` field containing the original content.
 */
export function parseResearch(raw: string): ParseResearchResult {
  const result: ParseResearchResult = {
    understanding: null,
    researching: null,
    applying: null,
    confidence: null,
    answer: null,
    raw: raw ?? ''
  };

  if (!raw) return result;

  const pattern = /\[(Analyzing your question\.\.\.|Researching sources\.\.\.|Applying to your situation\.\.\.|Evaluating confidence\.\.\.|Answering\.\.\.)\]\s*([\s\S]*?)(?=(?:\[(?:Analyzing your question\.\.\.|Researching sources\.\.\.|Applying to your situation\.\.\.|Evaluating confidence\.\.\.|Answering\.\.\.)\])|$)/ig;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const header = match[1].toUpperCase();
    const content = match[2].trim();

    switch (header) {
      case 'ANALYZING YOUR QUESTION...':
        result.understanding = content || null;
        break;
      case 'RESEARCHING SOURCES...':
        result.researching = content || null;
        break;
      case 'APPLYING TO YOUR SITUATION...':
        result.applying = content || null;
        break;
      case 'EVALUATING CONFIDENCE...':
        result.confidence = content || null;
        break;
      case 'ANSWERING...':
        result.answer = content || null;
        break;
    }
  }

  return result;
}
