/**
 * A format converter splits structured content into parts that must survive
 * verbatim (structure) and parts that can be compressed (prose), then
 * reassembles them after summarization.
 */
export interface FormatConverter {
  /** Unique identifier — used in trace output. */
  name: string;

  /** Returns true if this converter can handle the given content. Keep fast — called on every message. */
  detect(content: string): boolean;

  /** Extract the structural parts that must be preserved verbatim. */
  extractPreserved(content: string): string[];

  /** Extract prose segments that can be summarized or compressed. */
  extractCompressible(content: string): string[];

  /**
   * Reassemble the output from preserved structure and a (possibly empty) summary.
   * Must return something shorter than the original for compression to apply —
   * callers should check length and fall back to the original if not.
   */
  reconstruct(preserved: string[], summary: string): string;
}

/** Detection result with the matched converter and format name. */
export interface DetectResult {
  converter: FormatConverter;
  format: string;
}
