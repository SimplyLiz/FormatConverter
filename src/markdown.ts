/**
 * Markdown format converter.
 *
 * Preserves headings and tables (structural anchors). Compresses paragraph
 * prose between structural elements using discourse-aware splitting for
 * finer-grained segments.
 *
 * Handles: READMEs, changelogs, API docs, specs, runbooks, blog posts.
 */

import { splitProse, findSegments } from './shared.js';
import type { FormatConverter, CompressionBudget, CompressibleSegment } from './types.js';

const MD_HEADING_RE = /^#{1,6}\s+\S/;
const MD_TABLE_LINE_RE = /^\|.+\|$/;
const MD_TABLE_SEP_RE = /^\|[-| :]+\|$/;

/** Returns true if the content is structured Markdown. */
export function detectMarkdown(content: string): boolean {
  const lines = content.split('\n');
  const headingCount = lines.filter((l) => MD_HEADING_RE.test(l)).length;
  return headingCount >= 2 && content.length >= 200;
}

/**
 * Markdown FormatConverter — preserves headings and tables, compresses
 * paragraph prose with discourse-aware splitting.
 */
export const MarkdownConverter: FormatConverter = {
  name: 'markdown',

  budget: { structural: 0.0, prose: 0.80 } satisfies CompressionBudget,

  detect: detectMarkdown,

  compressionFeasible(content: string): boolean {
    return this.extractCompressible(content).some((s) => s.length >= 100);
  },

  extractPreserved(content: string): string[] {
    const preserved: string[] = [];
    let tableLines: string[] = [];

    for (const line of content.split('\n')) {
      if (MD_HEADING_RE.test(line)) {
        if (tableLines.length > 0) {
          preserved.push(tableLines.join('\n'));
          tableLines = [];
        }
        preserved.push(line);
      } else if (MD_TABLE_LINE_RE.test(line) || MD_TABLE_SEP_RE.test(line)) {
        tableLines.push(line);
      } else {
        if (tableLines.length > 0) {
          preserved.push(tableLines.join('\n'));
          tableLines = [];
        }
      }
    }
    if (tableLines.length > 0) preserved.push(tableLines.join('\n'));

    return preserved;
  },

  extractCompressible(content: string): string[] {
    const prose = content
      .split('\n')
      .filter(
        (l) =>
          !MD_HEADING_RE.test(l) &&
          !MD_TABLE_LINE_RE.test(l) &&
          !MD_TABLE_SEP_RE.test(l) &&
          !/^[-*_]{3,}\s*$/.test(l),
      )
      .join('\n');

    // Discourse-aware splitting: split within paragraphs at discourse boundaries
    return prose
      .split(/\n{2,}/)
      .flatMap((para) => splitProse(para))
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  },

  extractSegments(content: string): CompressibleSegment[] {
    // For segments, use paragraph-level granularity (not discourse-split)
    // so offsets map cleanly to original source spans
    const prose = content
      .split('\n')
      .filter(
        (l) =>
          !MD_HEADING_RE.test(l) &&
          !MD_TABLE_LINE_RE.test(l) &&
          !MD_TABLE_SEP_RE.test(l) &&
          !/^[-*_]{3,}\s*$/.test(l),
      )
      .join('\n');

    const paragraphs = prose
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return findSegments(content, paragraphs);
  },

  reconstruct(preserved: string[], summary: string): string {
    const parts = [...preserved];
    if (summary) parts.push(summary);
    return parts.join('\n\n');
  },
};
