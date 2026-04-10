/**
 * Tests for the four research-driven improvements:
 * 1. Source offset tracking (CompressibleSegment / extractSegments / segmentsOf)
 * 2. Compression budget hints (budget property)
 * 3. Fast pre-check (compressionFeasible)
 * 4. Discourse-aware prose splitting (splitProse)
 */

import { describe, it, expect } from 'vitest';
import {
  splitProse,
  findSegments,
  segmentsOf,
  JsonConverter,
  XmlConverter,
  HtmlConverter,
  YamlConverter,
  TomlConverter,
  MarkdownConverter,
  CsvConverter,
  DockerfileConverter,
  converters,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const proseWithDiscourse = `The deployment succeeded on the first attempt. However, memory usage spiked to 90% within minutes. Therefore, we rolled back to the previous version. Furthermore, a post-mortem was scheduled for the following day.`;

const proseNoDiscourse = `The service handles all incoming requests and routes them to the appropriate backend based on load balancing logic and health check status across the cluster.`;

const yamlWithProse = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  namespace: production
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        description: This container runs the nginx web server and handles all incoming HTTP traffic for the production environment serving thousands of users daily`;

const yamlAllAtomic = `name: myapp\nversion: 1.0.0\nenabled: true\nreplicas: 3\nport: 8080\n`;

const markdownDoc = `# API Reference

This document provides a comprehensive overview of the authentication API endpoints and how to use them in your application.

## Authentication

All requests require a Bearer token. However, some endpoints support API key authentication as an alternative method for server-to-server calls.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /users | List users |`;

const dockerfileWithProse = `# syntax=docker/dockerfile:1
# This stage compiles the Go binary and runs all unit tests to ensure correctness before packaging into the distroless runtime image.
FROM golang:1.22-alpine AS builder
WORKDIR /app
RUN go build -o server .
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server .
ENTRYPOINT ["/app/server"]`;

const dockerfileNoComments = `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
EXPOSE 3000`;

// ---------------------------------------------------------------------------
// 1. Discourse-aware prose splitting (splitProse)
// ---------------------------------------------------------------------------

describe('splitProse', () => {
  it('splits on paragraph breaks', () => {
    const text = 'First paragraph here.\n\nSecond paragraph here.';
    const result = splitProse(text);
    expect(result).toHaveLength(2);
  });

  it('splits at discourse boundaries within a paragraph', () => {
    const result = splitProse(proseWithDiscourse);
    // Should split before However, Therefore, Furthermore
    expect(result.length).toBeGreaterThan(1);
    expect(result.some((s) => s.startsWith('However'))).toBe(true);
    expect(result.some((s) => s.startsWith('Therefore'))).toBe(true);
    expect(result.some((s) => s.startsWith('Furthermore'))).toBe(true);
  });

  it('does not split prose without discourse markers', () => {
    const result = splitProse(proseNoDiscourse);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(proseNoDiscourse);
  });

  it('filters empty segments', () => {
    const result = splitProse('\n\n\n');
    expect(result).toHaveLength(0);
  });

  it('trims whitespace from segments', () => {
    const result = splitProse('  First sentence.  \n\n  Second sentence.  ');
    expect(result.every((s) => s === s.trim())).toBe(true);
  });

  it('handles all supported discourse markers', () => {
    const markers = ['But', 'Although', 'Nevertheless', 'Thus', 'Consequently',
      'Furthermore', 'Moreover', 'Additionally', 'Specifically', 'For example',
      'Note that', 'Finally', 'In contrast'];
    for (const marker of markers) {
      const text = `First sentence ends here. ${marker} this continues.`;
      const result = splitProse(text);
      expect(result.some((s) => s.startsWith(marker)), `expected split before "${marker}"`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Source offset tracking (findSegments / extractSegments / segmentsOf)
// ---------------------------------------------------------------------------

describe('findSegments', () => {
  it('returns correct offset for a known substring', () => {
    const content = 'hello world foo bar';
    const segments = findSegments(content, ['world']);
    expect(segments[0].offset).toBe(6);
    expect(segments[0].length).toBe(5);
    expect(segments[0].text).toBe('world');
  });

  it('searches forward in document order', () => {
    const content = 'aaa bbb aaa ccc';
    const segments = findSegments(content, ['aaa', 'ccc']);
    expect(segments[0].offset).toBe(0); // first 'aaa'
    expect(segments[1].offset).toBe(12); // 'ccc'
  });

  it('falls back to start when text not found after cursor', () => {
    const content = 'foo bar foo';
    // Ask for two 'foo' segments — cursor advances past first, finds second
    const segments = findSegments(content, ['foo', 'foo']);
    expect(segments[0].offset).toBe(0);
    expect(segments[1].offset).toBe(8);
  });

  it('offset + length matches original text', () => {
    const content = 'The quick brown fox';
    const texts = ['quick', 'fox'];
    const segments = findSegments(content, texts);
    for (const seg of segments) {
      expect(content.slice(seg.offset, seg.offset + seg.length)).toBe(seg.text);
    }
  });
});

describe('segmentsOf', () => {
  it('uses extractSegments when available', () => {
    const segments = segmentsOf(YamlConverter, yamlWithProse);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0]).toHaveProperty('offset');
    expect(segments[0]).toHaveProperty('length');
    expect(segments[0]).toHaveProperty('text');
  });

  it('falls back to findSegments for converter without extractSegments', () => {
    // Create a minimal converter without extractSegments
    const minimal = {
      name: 'test',
      budget: { structural: 0, prose: 0.5 },
      detect: () => true,
      compressionFeasible: () => true,
      extractPreserved: () => [],
      extractCompressible: (c: string) => [c.slice(0, 10)],
      reconstruct: (p: string[]) => p.join(''),
    };
    const segments = segmentsOf(minimal, 'hello world');
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('hello worl');
  });

  it('segment offsets point to actual text in original content', () => {
    const segments = segmentsOf(XmlConverter, `<root><desc>${'A '.repeat(60)}</desc></root>`);
    for (const seg of segments) {
      const original = `<root><desc>${'A '.repeat(60)}</desc></root>`;
      expect(original.slice(seg.offset, seg.offset + seg.length)).toBe(seg.text);
    }
  });
});

describe('extractSegments on built-in converters', () => {
  it('JsonConverter.extractSegments returns offsets', () => {
    const json = JSON.stringify({
      name: 'app',
      description: 'This is a lengthy description that explains everything about the application in verbose terms for documentation purposes.',
    }, null, 2);
    const segs = JsonConverter.extractSegments!(json);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].offset).toBeGreaterThan(0);
    expect(json.slice(segs[0].offset, segs[0].offset + segs[0].length)).toBe(segs[0].text);
  });

  it('MarkdownConverter.extractSegments returns paragraph offsets', () => {
    const segs = MarkdownConverter.extractSegments!(markdownDoc);
    expect(segs.length).toBeGreaterThan(0);
    for (const seg of segs) {
      expect(markdownDoc.slice(seg.offset, seg.offset + seg.length)).toBe(seg.text);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Compression budget hints
// ---------------------------------------------------------------------------

describe('budget property', () => {
  it('all converters expose a budget', () => {
    for (const converter of converters) {
      expect(converter.budget, `${converter.name} missing budget`).toBeDefined();
      expect(typeof converter.budget.structural).toBe('number');
      expect(typeof converter.budget.prose).toBe('number');
    }
  });

  it('structural budget is 0 for format-preserving converters', () => {
    // JSON, YAML, TOML, Markdown, CSV, Dockerfile all keep structure verbatim
    for (const name of ['json', 'yaml', 'toml', 'markdown', 'csv', 'dockerfile']) {
      const c = converters.find((x) => x.name === name)!;
      expect(c.budget.structural, `${name} structural budget`).toBe(0);
    }
  });

  it('XML and HTML have small non-zero structural budget', () => {
    expect(XmlConverter.budget.structural).toBeGreaterThan(0);
    expect(HtmlConverter.budget.structural).toBeGreaterThan(0);
  });

  it('CSV has the highest prose budget (most compressible)', () => {
    const maxProse = Math.max(...converters.map((c) => c.budget.prose));
    expect(CsvConverter.budget.prose).toBe(maxProse);
  });

  it('Dockerfile has the lowest prose budget (comments worth keeping)', () => {
    const minProse = Math.min(...converters.map((c) => c.budget.prose));
    expect(DockerfileConverter.budget.prose).toBe(minProse);
  });

  it('prose budgets are in [0, 1] range', () => {
    for (const c of converters) {
      expect(c.budget.prose).toBeGreaterThanOrEqual(0);
      expect(c.budget.prose).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. compressionFeasible
// ---------------------------------------------------------------------------

describe('compressionFeasible', () => {
  it('all converters expose compressionFeasible', () => {
    for (const c of converters) {
      expect(typeof c.compressionFeasible).toBe('function');
    }
  });

  it('YamlConverter returns false for all-atomic YAML', () => {
    expect(YamlConverter.compressionFeasible(yamlAllAtomic)).toBe(false);
  });

  it('YamlConverter returns true for YAML with prose', () => {
    expect(YamlConverter.compressionFeasible(yamlWithProse)).toBe(true);
  });

  it('DockerfileConverter returns false for Dockerfile without prose comments', () => {
    expect(DockerfileConverter.compressionFeasible(dockerfileNoComments)).toBe(false);
  });

  it('DockerfileConverter returns true for Dockerfile with prose comments', () => {
    expect(DockerfileConverter.compressionFeasible(dockerfileWithProse)).toBe(true);
  });

  it('MarkdownConverter returns false for headings-only doc', () => {
    // All headings, no prose paragraphs
    const headingsOnly = `# Title\n\n## Section\n\n### Subsection\n\n## Another Section\n\n### Another Sub`;
    expect(MarkdownConverter.compressionFeasible(headingsOnly)).toBe(false);
  });

  it('MarkdownConverter returns true for doc with prose', () => {
    expect(MarkdownConverter.compressionFeasible(markdownDoc)).toBe(true);
  });

  it('CsvConverter returns true when there are data rows', () => {
    const csv = 'id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com';
    expect(CsvConverter.compressionFeasible(csv)).toBe(true);
  });

  it('JsonConverter returns false for all-atomic JSON', () => {
    const atomic = JSON.stringify({ name: 'app', version: '1.0', port: 3000 }, null, 2);
    expect(JsonConverter.compressionFeasible(atomic)).toBe(false);
  });

  it('JsonConverter returns true for JSON with prose string values', () => {
    const withProse = JSON.stringify({
      name: 'app',
      description: 'This is a lengthy description that explains everything about the application in verbose terms for users and documentation purposes.',
      version: '1.0',
    }, null, 2);
    expect(JsonConverter.compressionFeasible(withProse)).toBe(true);
  });

  it('TomlConverter returns false for all-atomic TOML', () => {
    expect(TomlConverter.compressionFeasible(yamlAllAtomic.replace(/:/g, ' ='))).toBe(false);
  });

  it('feasibility check is fast — no expensive operations', () => {
    // Just verify it returns quickly without doing full skeleton extraction
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      YamlConverter.compressionFeasible(yamlAllAtomic);
    }
    expect(Date.now() - start).toBeLessThan(200);
  });
});
