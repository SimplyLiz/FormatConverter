import { describe, it, expect } from 'vitest';
import { MarkdownConverter, detectMarkdown } from '../src/markdown.js';

const readmeMarkdown = `# MyProject

A fast, minimal framework for building APIs.

## Overview

MyProject provides a clean abstraction over HTTP routing, middleware chaining,
and context propagation. It is designed to be embedded in larger applications
without imposing opinions on your project structure.

## Installation

Run the following to add MyProject to your Go module.

## Usage

Import the package and create a new instance. Configure routes and middleware
before calling Run to start the server. The framework handles graceful shutdown
automatically when the process receives SIGTERM.

## Configuration

All configuration is done through environment variables. See the configuration
reference for the full list of supported options and their defaults.`;

const changelogMarkdown = `# Changelog

All notable changes to this project will be documented here.

## [2.0.0] - 2026-04-01

### Breaking Changes

The configuration API has been completely redesigned. Migration requires updating
all configuration files to use the new key-value format described in the docs.

## [1.9.0] - 2026-02-15

### Fixed

Resolved a race condition in the connection pool that caused intermittent
failures under high concurrency on systems with more than 32 CPU cores.`;

const docWithTable = `# Doc

Some intro text here.

## Table Section

More text about the table.

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |

## End

Final paragraph content here.`;

describe('detectMarkdown', () => {
  it('detects structured README', () => {
    expect(detectMarkdown(readmeMarkdown)).toBe(true);
  });

  it('detects changelog', () => {
    expect(detectMarkdown(changelogMarkdown)).toBe(true);
  });

  it('rejects single-heading doc', () => {
    expect(detectMarkdown('# Title\n\nJust one paragraph here with some content.')).toBe(false);
  });

  it('rejects plain prose', () => {
    expect(detectMarkdown('No headings, just plain text content here.')).toBe(false);
  });

  it('rejects short content even with two headings', () => {
    expect(detectMarkdown('## A\n## B\n')).toBe(false);
  });
});

describe('MarkdownConverter.extractPreserved', () => {
  it('includes all headings', () => {
    const preserved = MarkdownConverter.extractPreserved(readmeMarkdown);
    const joined = preserved.join('\n');
    expect(joined).toContain('# MyProject');
    expect(joined).toContain('## Overview');
    expect(joined).toContain('## Installation');
    expect(joined).toContain('## Usage');
    expect(joined).toContain('## Configuration');
  });

  it('does not include paragraph prose', () => {
    const preserved = MarkdownConverter.extractPreserved(readmeMarkdown);
    const joined = preserved.join('\n');
    expect(joined).not.toContain('clean abstraction');
    expect(joined).not.toContain('graceful shutdown');
  });

  it('preserves tables with separator rows', () => {
    const preserved = MarkdownConverter.extractPreserved(docWithTable);
    const joined = preserved.join('\n');
    expect(joined).toContain('| A | B | C |');
    expect(joined).toContain('| 1 | 2 | 3 |');
  });

  it('flushes pending table when heading is encountered', () => {
    const preserved = MarkdownConverter.extractPreserved(docWithTable);
    const joined = preserved.join('\n');
    // Table should appear before ## End
    const tableIdx = joined.indexOf('| A |');
    const endIdx = joined.indexOf('## End');
    expect(tableIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(tableIdx);
  });
});

describe('MarkdownConverter.extractCompressible', () => {
  it('returns paragraph text', () => {
    const compressible = MarkdownConverter.extractCompressible(readmeMarkdown);
    expect(compressible.length).toBeGreaterThan(0);
    expect(compressible.some((c) => c.includes('clean abstraction'))).toBe(true);
  });

  it('does not include headings', () => {
    const compressible = MarkdownConverter.extractCompressible(readmeMarkdown);
    expect(compressible.every((c) => !c.startsWith('#'))).toBe(true);
  });

  it('does not include horizontal rules', () => {
    const content = `# A\n\nParagraph one.\n\n---\n\n## B\n\nParagraph two with more text.`;
    const compressible = MarkdownConverter.extractCompressible(content);
    expect(compressible.every((c) => !/^[-*_]{3}/.test(c))).toBe(true);
  });

  it('splits on double newlines into separate segments', () => {
    const compressible = MarkdownConverter.extractCompressible(readmeMarkdown);
    // Each segment should be a single paragraph, not the whole document
    expect(compressible.every((c) => !c.includes('\n\n'))).toBe(true);
  });
});

describe('MarkdownConverter.reconstruct', () => {
  it('joins preserved elements with double newlines', () => {
    const result = MarkdownConverter.reconstruct(['# Title', '## Section'], 'prose summary');
    expect(result).toBe('# Title\n\n## Section\n\nprose summary');
  });

  it('omits summary when empty', () => {
    const result = MarkdownConverter.reconstruct(['# Title', '## Section'], '');
    expect(result).toBe('# Title\n\n## Section');
  });
});

describe('MarkdownConverter roundtrip', () => {
  it('produces shorter output than input for prose-heavy doc', () => {
    const preserved = MarkdownConverter.extractPreserved(readmeMarkdown);
    const compressible = MarkdownConverter.extractCompressible(readmeMarkdown);
    const summary = compressible.join(' ').slice(0, 80);
    const output = MarkdownConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(readmeMarkdown.length);
  });
});
