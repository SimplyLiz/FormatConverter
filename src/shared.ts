/**
 * Returns true if text reads as prose rather than a structured atomic value.
 * Prose: 6+ words AND 100+ characters.
 */
export function looksLikeProse(text: string): boolean {
  const t = text.trim();
  return t.split(/\s+/).length >= 6 && t.length >= 100;
}
