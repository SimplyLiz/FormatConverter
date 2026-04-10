import type { CompressibleSegment, FormatConverter } from './types.js';

/**
 * Returns true if a string reads as prose rather than a structured atomic value.
 * Prose: 6+ words AND 100+ characters.
 */
export function looksLikeProse(text: string): boolean {
  const t = text.trim();
  return t.split(/\s+/).length >= 6 && t.length >= 100;
}

/**
 * Sentence-final punctuation followed by a discourse marker — a strong signal
 * that a new argumentative unit is beginning. Used to split prose into finer
 * segments than paragraph breaks alone.
 *
 * Covers: contrast (However, But), cause/effect (Therefore, Thus),
 * addition (Furthermore, Moreover), elaboration (Specifically, For example),
 * sequence (First, Finally), and warnings (Note that, Important).
 */
const DISCOURSE_BOUNDARY_RE =
  /(?<=[.!?]["']?)\s+(?=(?:However|But|Although|Nevertheless|Yet|Still|Therefore|Thus|Consequently|Hence|Furthermore|Moreover|Additionally|In addition|Specifically|In particular|For example|For instance|Note that|Keep in mind|Important|Warning|Caution|First|Second|Third|Finally|Lastly|In contrast|On the other hand)\b)/gi;

/**
 * Split prose text into discourse-aware segments.
 *
 * 1. Split on paragraph breaks (two or more newlines).
 * 2. Within each paragraph, split before discourse boundary markers
 *    (contrast, cause, addition, elaboration, sequence signals).
 *
 * Returns non-empty, trimmed strings. Finer-grained than paragraph splitting
 * alone — gives summarizers better sentence-level units to work with.
 */
export function splitProse(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((para) => para.split(DISCOURSE_BOUNDARY_RE))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Locate each text segment in the original content string, returning
 * CompressibleSegments with byte offsets and lengths.
 *
 * Searches forward through the content so that segments are attributed to
 * their first occurrence in document order. Falls back to searching from the
 * beginning if a segment is not found after the current position (handles
 * duplicate values).
 */
export function findSegments(content: string, texts: string[]): CompressibleSegment[] {
  let cursor = 0;
  return texts.map((text) => {
    let offset = content.indexOf(text, cursor);
    if (offset === -1) {
      // Fallback: search from beginning (handles out-of-order or duplicate text)
      offset = content.indexOf(text);
    }
    if (offset !== -1) cursor = offset + text.length;
    return { text, offset: offset >= 0 ? offset : 0, length: text.length };
  });
}

/**
 * Return CompressibleSegments for any FormatConverter.
 *
 * Uses the converter's own extractSegments() if implemented; otherwise falls
 * back to findSegments() over extractCompressible() output.
 */
export function segmentsOf(converter: FormatConverter, content: string): CompressibleSegment[] {
  if (converter.extractSegments) {
    return converter.extractSegments(content);
  }
  return findSegments(content, converter.extractCompressible(content));
}
