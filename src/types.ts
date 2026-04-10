/**
 * A prose segment extracted from structured content, with its byte position
 * in the original string for faithful reconstruction from source spans.
 */
export interface CompressibleSegment {
  /** The prose text to compress or summarize. */
  text: string;
  /** Byte offset of this segment in the original content string. */
  offset: number;
  /** Byte length of this segment in the original content string. */
  length: number;
}

/**
 * Recommended compression aggressiveness for structural vs prose parts.
 * 0.0 = keep verbatim, 1.0 = fully compressible.
 *
 * Use `prose` to size your summarizer's output budget:
 *   maxTokens = Math.round(estimatedTokens * (1 - budget.prose))
 */
export interface CompressionBudget {
  /**
   * How aggressively to compress structural parts (tags, keys, headings).
   * Most formats set this to 0 — structure must survive verbatim.
   */
  structural: number;
  /**
   * How aggressively to compress prose parts.
   * Typical range: 0.65 (Dockerfiles) to 0.95 (CSV data rows).
   */
  prose: number;
}

/**
 * A format converter splits structured content into parts that must survive
 * verbatim (structure) and parts that can be compressed (prose), then
 * reassembles them after summarization.
 */
export interface FormatConverter {
  /** Unique identifier — used in trace output. */
  name: string;

  /** Recommended compression aggressiveness for this format. */
  budget: CompressionBudget;

  /** Returns true if this converter can handle the given content. Keep fast — called on every message. */
  detect(content: string): boolean;

  /**
   * Fast pre-check: returns false if there is no prose worth compressing.
   * Call before extractCompressible() to skip work on structure-only content
   * (e.g. a JSON object with no string values, a Dockerfile with no comments).
   */
  compressionFeasible(content: string): boolean;

  /** Extract the structural parts that must be preserved verbatim. */
  extractPreserved(content: string): string[];

  /** Extract prose segments that can be summarized or compressed. */
  extractCompressible(content: string): string[];

  /**
   * Like extractCompressible(), but each segment carries its byte offset and
   * length in the original content string. Enables faithful reconstruction
   * from source spans — summaries can only reference actual source text.
   *
   * Optional: use segmentsOf() from shared.ts for a fallback that works with
   * any FormatConverter that implements extractCompressible().
   */
  extractSegments?(content: string): CompressibleSegment[];

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
