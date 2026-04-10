/**
 * Markdown format converter.
 *
 * Preserves headings and tables (structural anchors). Compresses paragraph
 * prose between structural elements.
 *
 * Handles: READMEs, changelogs, API docs, specs, runbooks, blog posts.
 *
 * Note: content with code fences is typically handled by a separate code-split
 * pass before this converter is checked. This converter focuses on prose-heavy
 * Markdown without code blocks. If you need unified handling, run a code-aware
 * pass first.
 */

import type { FormatConverter } from './types.js';

const MD_HEADING_RE = /^#{1,6}\s+\S/;
const MD_TABLE_LINE_RE = /^\|.+\|$/;
const MD_TABLE_SEP_RE = /^\|[-| :]+\|$/;

/**
 * Returns true if the content is structured Markdown: at least 2 headings and
 * at least 200 characters of content.
 */
export function detectMarkdown(content: string): boolean {
  const lines = content.split('\n');
  const headingCount = lines.filter((l) => MD_HEADING_RE.test(l)).length;
  return headingCount >= 2 && content.length >= 200;
}

/**
 * Markdown FormatConverter — preserves headings and tables, compresses
 * paragraph prose.
 */
export const MarkdownConverter: FormatConverter = {
  name: 'markdown',

  detect: detectMarkdown,

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

    return prose
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  },

  reconstruct(preserved: string[], summary: string): string {
    const parts = [...preserved];
    if (summary) parts.push(summary);
    return parts.join('\n\n');
  },
};
