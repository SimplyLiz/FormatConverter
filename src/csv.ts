/**
 * CSV format converter.
 *
 * Preserves the header row (column names) and row count. Data rows are
 * compressible — callers can summarize them (e.g. "150 user records with
 * id, name, email").
 *
 * Handles: tabular tool results, exported spreadsheets, database query output,
 * API responses in CSV mode, log exports.
 */

import type { FormatConverter } from './types.js';

/** Returns true if the content looks like CSV data. */
export function detectCsv(content: string): boolean {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 3) return false;
  if (!lines[0].includes(',') || !lines[1].includes(',')) return false;
  // Consistent column count across first few rows
  const headerCols = lines[0].split(',').length;
  return lines
    .slice(1, Math.min(5, lines.length))
    .every((l) => l.split(',').length === headerCols);
}

/**
 * CSV FormatConverter — preserves the header row and records the row count;
 * data rows are the compressible payload.
 */
export const CsvConverter: FormatConverter = {
  name: 'csv',

  detect: detectCsv,

  extractPreserved(content: string): string[] {
    const lines = content.split('\n').filter((l) => l.trim());
    const header = lines[0];
    const rowCount = lines.length - 1;
    return [header, `${rowCount} row${rowCount !== 1 ? 's' : ''}`];
  },

  extractCompressible(content: string): string[] {
    const lines = content.split('\n').filter((l) => l.trim());
    // Return data rows (skip header); callers summarize them
    return lines.slice(1);
  },

  reconstruct(preserved: string[], summary: string): string {
    const [header, rowInfo] = preserved;
    if (!summary) return `${header}\n[${rowInfo}]`;
    return `${header}\n[${rowInfo}: ${summary}]`;
  },
};
