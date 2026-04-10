import { describe, it, expect } from 'vitest';
import { CsvConverter, detectCsv } from '../src/csv.js';

const usersCsv = `id,name,email,role,created_at
1,Alice Johnson,alice@example.com,admin,2024-01-15
2,Bob Smith,bob@example.com,user,2024-02-20
3,Carol White,carol@example.com,user,2024-03-10
4,Dave Brown,dave@example.com,moderator,2024-04-05
5,Eve Davis,eve@example.com,user,2024-05-12`;

const salesCsv = `date,product,quantity,unit_price,total
2026-01-01,Widget A,100,9.99,999.00
2026-01-02,Widget B,50,19.99,999.50
2026-01-03,Widget C,200,4.99,998.00`;

describe('detectCsv', () => {
  it('detects user CSV', () => {
    expect(detectCsv(usersCsv)).toBe(true);
  });

  it('detects sales CSV', () => {
    expect(detectCsv(salesCsv)).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectCsv('Just a sentence.')).toBe(false);
  });

  it('rejects content without commas', () => {
    expect(detectCsv('name\nAlice\nBob\nCarol')).toBe(false);
  });

  it('rejects too few lines', () => {
    expect(detectCsv('id,name\n1,Alice')).toBe(false);
  });

  it('rejects inconsistent column count', () => {
    expect(detectCsv('a,b,c\n1,2\n3,4,5,6\n7,8,9')).toBe(false);
  });
});

describe('CsvConverter.extractPreserved', () => {
  it('returns header row as first element', () => {
    const preserved = CsvConverter.extractPreserved(usersCsv);
    expect(preserved[0]).toBe('id,name,email,role,created_at');
  });

  it('returns row count as second element', () => {
    const preserved = CsvConverter.extractPreserved(usersCsv);
    expect(preserved[1]).toBe('5 rows');
  });

  it('uses singular for one row', () => {
    const oneRow = 'a,b,c\n1,2,3';
    const preserved = CsvConverter.extractPreserved(oneRow);
    expect(preserved[1]).toBe('1 row');
  });
});

describe('CsvConverter.extractCompressible', () => {
  it('returns all data rows', () => {
    const compressible = CsvConverter.extractCompressible(usersCsv);
    expect(compressible).toHaveLength(5);
  });

  it('does not include the header', () => {
    const compressible = CsvConverter.extractCompressible(usersCsv);
    expect(compressible.every((r) => !r.startsWith('id,'))).toBe(true);
  });
});

describe('CsvConverter.reconstruct', () => {
  it('outputs header + summary annotation', () => {
    const preserved = CsvConverter.extractPreserved(usersCsv);
    const result = CsvConverter.reconstruct(preserved, 'user records with id, name, email, role');
    expect(result).toContain('id,name,email,role,created_at');
    expect(result).toContain('[5 rows: user records with id, name, email, role]');
  });

  it('outputs header + row count when summary is empty', () => {
    const preserved = CsvConverter.extractPreserved(usersCsv);
    const result = CsvConverter.reconstruct(preserved, '');
    expect(result).toContain('[5 rows]');
    expect(result).toContain('id,name,email,role,created_at');
  });
});

describe('CsvConverter end-to-end', () => {
  it('produces shorter output than input', () => {
    const preserved = CsvConverter.extractPreserved(usersCsv);
    const output = CsvConverter.reconstruct(preserved, 'user records');
    expect(output.length).toBeLessThan(usersCsv.length);
  });
});
