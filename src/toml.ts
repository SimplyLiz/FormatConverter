/**
 * TOML format converter.
 *
 * Preserves keys with short/atomic values, section headers, and structure.
 * Compresses string values that look like prose.
 *
 * Handles: Cargo.toml, pyproject.toml, go.toml, config.toml, Hugo/Zola site
 * configs, Taplo configs, and any TOML-based configuration file.
 */

import { looksLikeProse } from './shared.js';
import type { FormatConverter } from './types.js';

// key = value (TOML uses = not :)
const TOML_KEY_RE = /^([ \t]*)([\w][\w.-]*)\s*=\s*(.+)$/;
const TOML_SECTION_RE = /^\[{1,2}[\w. "-]+\]{1,2}$/;

/** Returns true if the content looks like a TOML document. */
export function detectToml(content: string): boolean {
  const lines = content.split('\n');
  const nonEmpty = lines.filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  if (nonEmpty.length < 3) return false;
  const keyLines = nonEmpty.filter((l) => TOML_KEY_RE.test(l));
  // Must have both = assignments and either a section header or enough key lines
  const hasSections = nonEmpty.some((l) => TOML_SECTION_RE.test(l.trim()));
  return keyLines.length >= 2 && (hasSections || keyLines.length / nonEmpty.length > 0.4);
}

/** Returns true if a TOML value is atomic (short, non-prose). */
export function isAtomicTomlValue(value: string): boolean {
  const v = value.trim();
  // Booleans, numbers, dates
  if (/^(?:true|false|\d[\d._-]*(?:e[+-]?\d+)?|0x[\da-f]+)$/i.test(v)) return true;
  // Inline arrays and tables — preserve regardless of length
  if (v.startsWith('[') || v.startsWith('{')) return true;
  // Multiline string indicators
  if (v === '"""' || v === "'''") return true;
  // Quoted strings: strip quotes and check length
  const inner = v.replace(/^["']|["']$/g, '');
  return inner.length <= 60;
}

/**
 * TOML FormatConverter — preserves structure and atomic values, compresses
 * long prose string values.
 */
export const TomlConverter: FormatConverter = {
  name: 'toml',

  detect: detectToml,

  extractPreserved(content: string): string[] {
    return content.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true; // blank + comments preserved
      if (TOML_SECTION_RE.test(trimmed)) return true; // section headers always preserved
      const m = line.match(TOML_KEY_RE);
      if (!m) return true; // multi-line values, continuation lines
      return isAtomicTomlValue(m[3]);
    });
  },

  extractCompressible(content: string): string[] {
    const out: string[] = [];
    for (const line of content.split('\n')) {
      const m = line.match(TOML_KEY_RE);
      if (m && !isAtomicTomlValue(m[3])) {
        // Strip surrounding quotes from value
        const raw = m[3].trim().replace(/^["']|["']$/g, '');
        if (looksLikeProse(raw)) out.push(`${m[2]} = ${raw}`);
      }
    }
    return out;
  },

  reconstruct(preserved: string[], summary: string): string {
    const parts = [...preserved];
    if (summary) parts.push(`# ${summary}`);
    return parts.join('\n');
  },
};
