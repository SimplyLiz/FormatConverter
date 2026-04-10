/**
 * JSON format converter.
 *
 * Preserves the structural skeleton (all keys, short/atomic values). Compresses
 * string values that look like prose (6+ words, 100+ chars) — descriptions,
 * summaries, error messages, verbose annotations.
 *
 * Handles: package.json, tsconfig, API responses, tool call results,
 * OpenAPI specs, GitHub API payloads, LLM response objects.
 */

import { looksLikeProse, findSegments } from './shared.js';
import type { FormatConverter, CompressionBudget, CompressibleSegment } from './types.js';

/** Returns true if the content is a parseable JSON object or array with enough entries. */
export function detectJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null || typeof parsed !== 'object') return false;
    if (Array.isArray(parsed)) return parsed.length >= 2;
    return Object.keys(parsed as object).length >= 2;
  } catch {
    return false;
  }
}

/** Recursively replace prose string values with `[…]`. */
function buildSkeleton(value: unknown): unknown {
  if (typeof value === 'string') {
    return looksLikeProse(value) ? '[…]' : value;
  }
  if (Array.isArray(value)) {
    return value.map(buildSkeleton);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = buildSkeleton(v);
    }
    return result;
  }
  return value;
}

/** Recursively collect string values that look like prose. */
function collectProse(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (looksLikeProse(value)) out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectProse(item, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectProse(v, out);
    }
  }
}

/**
 * JSON FormatConverter — preserves structural skeleton with atomic values,
 * compresses long prose string values.
 */
export const JsonConverter: FormatConverter = {
  name: 'json',

  budget: { structural: 0.0, prose: 0.75 } satisfies CompressionBudget,

  detect: detectJson,

  compressionFeasible(content: string): boolean {
    return this.extractCompressible(content).length > 0;
  },

  extractPreserved(content: string): string[] {
    try {
      const parsed = JSON.parse(content.trim()) as unknown;
      return [JSON.stringify(buildSkeleton(parsed), null, 2)];
    } catch {
      return [content];
    }
  },

  extractCompressible(content: string): string[] {
    try {
      const parsed = JSON.parse(content.trim()) as unknown;
      const out: string[] = [];
      collectProse(parsed, out);
      return out;
    } catch {
      return [];
    }
  },

  extractSegments(content: string): CompressibleSegment[] {
    return findSegments(content, this.extractCompressible(content));
  },

  reconstruct(preserved: string[], summary: string): string {
    if (!summary) return preserved.join('\n');
    try {
      const obj = JSON.parse(preserved[0]) as unknown;
      if (Array.isArray(obj)) {
        return JSON.stringify({ _data: obj, _summary: summary }, null, 2);
      }
      const result = { ...(obj as Record<string, unknown>), _summary: summary };
      return JSON.stringify(result, null, 2);
    } catch {
      return `${preserved.join('\n')}\n// ${summary}`;
    }
  },
};
