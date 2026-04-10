/**
 * XML format converter.
 *
 * Preserves the structural skeleton (all tags with attributes, short text values).
 * Compresses text nodes and comments that look like prose (6+ words, 100+ chars).
 *
 * Handles: Maven POMs, Kubernetes manifests, Spring configs, WSDL, SVG, Atom/RSS,
 * JUnit reports, Ant build files, Logback configs.
 */

import { looksLikeProse, findSegments } from './shared.js';
import type { FormatConverter, CompressionBudget, CompressibleSegment } from './types.js';

const XML_DETECT_RE = /^\s*(?:<\?xml[^>]*\?>\s*)?<[a-zA-Z]/;
const XML_CLOSE_RE = /<\/[a-zA-Z]/;
const XML_TEXT_NODE_RE = />([^<]{1,})</g;

/** Collapse long prose text nodes to `[…]`; keep short values intact. */
export function xmlSkeleton(content: string): string {
  return content.replace(XML_TEXT_NODE_RE, (_match, text: string) => {
    if (looksLikeProse(text)) return '>[…]<';
    return `>${text}<`;
  });
}

/** Extract text nodes and XML comments that look like prose. */
export function xmlProseNodes(content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;

  const textRe = new RegExp(XML_TEXT_NODE_RE.source, 'g');
  while ((m = textRe.exec(content)) !== null) {
    if (looksLikeProse(m[1])) out.push(m[1].trim());
  }

  const commentRe = /<!--([\s\S]*?)-->/g;
  while ((m = commentRe.exec(content)) !== null) {
    const text = m[1].trim();
    if (looksLikeProse(text)) out.push(text);
  }

  return out;
}

/** Detects XML content. */
export function detectXml(content: string): boolean {
  return XML_DETECT_RE.test(content) && XML_CLOSE_RE.test(content);
}

/**
 * XML FormatConverter — preserves structural skeleton, compresses prose nodes.
 */
export const XmlConverter: FormatConverter = {
  name: 'xml',

  budget: { structural: 0.05, prose: 0.75 } satisfies CompressionBudget,

  detect: detectXml,

  compressionFeasible(content: string): boolean {
    return xmlProseNodes(content).length > 0;
  },

  extractPreserved(content: string): string[] {
    return [xmlSkeleton(content).trim()];
  },

  extractCompressible: xmlProseNodes,

  extractSegments(content: string): CompressibleSegment[] {
    return findSegments(content, xmlProseNodes(content));
  },

  reconstruct(preserved: string[], summary: string): string {
    if (!summary) return preserved.join('\n');
    return `${preserved.join('\n')}\n<!-- ${summary} -->`;
  },
};
