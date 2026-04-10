/**
 * YAML format converter.
 *
 * Preserves keys with atomic values (names, versions, booleans, numbers,
 * commands, short strings ≤60 chars). Compresses keys whose values are long
 * prose strings.
 *
 * Handles: Kubernetes manifests, Docker Compose, GitHub Actions, Helm charts,
 * CI/CD configs.
 */

import { findSegments } from './shared.js';
import type { FormatConverter, CompressionBudget, CompressibleSegment } from './types.js';

const YAML_KEY_LINE_RE = /^([ \t]*)([\w][\w.-]*)\s*:\s*(.*)$/;

/** Returns true if the content looks like a YAML document. */
export function detectYaml(content: string): boolean {
  const lines = content.split('\n');
  const nonEmpty = lines.filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  if (nonEmpty.length < 4) return false;
  const keyLines = nonEmpty.filter((l) => YAML_KEY_LINE_RE.test(l));
  return keyLines.length / nonEmpty.length > 0.35;
}

/** Returns true if a YAML value should be preserved verbatim (atomic / short). */
export function isAtomicYamlValue(value: string): boolean {
  const v = value.trim();
  if (v === '' || v.startsWith('&') || v.startsWith('*') || v === '|' || v === '>') return true;
  if (/^(?:true|false|null|~|\d[\d.,_]*(?:e[+-]?\d+)?)$/i.test(v)) return true;
  if (v.length <= 60) return true;
  return false;
}

/**
 * YAML FormatConverter — preserves keys with atomic values, compresses long
 * prose string values.
 */
export const YamlConverter: FormatConverter = {
  name: 'yaml',

  budget: { structural: 0.0, prose: 0.75 } satisfies CompressionBudget,

  detect: detectYaml,

  compressionFeasible(content: string): boolean {
    return this.extractCompressible(content).length > 0;
  },

  extractPreserved(content: string): string[] {
    return content.split('\n').filter((line) => {
      const m = line.match(YAML_KEY_LINE_RE);
      if (!m) return true;
      return isAtomicYamlValue(m[3]);
    });
  },

  extractCompressible(content: string): string[] {
    const out: string[] = [];
    for (const line of content.split('\n')) {
      const m = line.match(YAML_KEY_LINE_RE);
      if (m && !isAtomicYamlValue(m[3])) {
        out.push(`${m[2]}: ${m[3].trim()}`);
      }
    }
    return out;
  },

  extractSegments(content: string): CompressibleSegment[] {
    return findSegments(content, this.extractCompressible(content));
  },

  reconstruct(preserved: string[], summary: string): string {
    const parts = [...preserved];
    if (summary) parts.push(`# ${summary}`);
    return parts.join('\n');
  },
};
