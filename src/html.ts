/**
 * HTML format converter.
 *
 * Preserves the structural skeleton (all tags with attributes). Script and
 * style blocks are replaced with `[code]` markers — they are code, not prose.
 * Long text nodes are collapsed to `[…]`.
 *
 * Handles: web pages, scraped content, email templates, documentation HTML,
 * API responses with HTML bodies.
 */

import { looksLikeProse, splitProse, findSegments } from './shared.js';
import type { FormatConverter, CompressionBudget, CompressibleSegment } from './types.js';

const HTML_DETECT_RE = /<!DOCTYPE\s+html|<html[\s>]/i;
const HTML_CLOSE_RE = /<\/(?:html|body|div|p|section|article|main|header|footer|nav|ul|ol|table)/i;
const HTML_TEXT_NODE_RE = />([^<]{2,})</g;

/** Returns true if content looks like an HTML document. */
export function detectHtml(content: string): boolean {
  return HTML_DETECT_RE.test(content) && HTML_CLOSE_RE.test(content);
}

/** Extract text nodes that look like prose. */
export function htmlProseNodes(content: string): string[] {
  // Strip script/style first so we don't harvest their content
  const stripped = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(HTML_TEXT_NODE_RE.source, 'g');
  while ((m = re.exec(stripped)) !== null) {
    const text = m[1].trim();
    if (looksLikeProse(text)) out.push(text);
  }

  const commentRe = /<!--([\s\S]*?)-->/g;
  while ((m = commentRe.exec(stripped)) !== null) {
    const text = m[1].trim();
    if (looksLikeProse(text)) out.push(text);
  }

  return out;
}

/** Collapse script/style to markers and prose text nodes to `[…]`. */
export function htmlSkeleton(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '<script>[code]</script>')
    .replace(/<style[\s\S]*?<\/style>/gi, '<style>[code]</style>')
    .replace(HTML_TEXT_NODE_RE, (_match, text: string) => {
      if (looksLikeProse(text.trim())) return '>[…]<';
      return `>${text}<`;
    });
}

/**
 * HTML FormatConverter — preserves structural skeleton with script/style as
 * `[code]` markers; compresses prose text nodes using discourse-aware splitting.
 */
export const HtmlConverter: FormatConverter = {
  name: 'html',

  budget: { structural: 0.05, prose: 0.80 } satisfies CompressionBudget,

  detect: detectHtml,

  compressionFeasible(content: string): boolean {
    return htmlProseNodes(content).length > 0;
  },

  extractPreserved(content: string): string[] {
    return [htmlSkeleton(content).trim()];
  },

  extractCompressible(content: string): string[] {
    // Apply discourse-aware splitting within each prose node for finer segments
    return htmlProseNodes(content).flatMap((node) => splitProse(node));
  },

  extractSegments(content: string): CompressibleSegment[] {
    return findSegments(content, htmlProseNodes(content));
  },

  reconstruct(preserved: string[], summary: string): string {
    if (!summary) return preserved.join('\n');
    return `${preserved.join('\n')}\n<!-- ${summary} -->`;
  },
};
