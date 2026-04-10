import { describe, it, expect } from 'vitest';
import { JsonConverter, detectJson } from '../src/json.js';

const packageJson = JSON.stringify(
  {
    name: 'my-service',
    version: '2.1.0',
    description:
      'This package provides a comprehensive set of utilities for building scalable microservices. It includes middleware, routing, and observability tooling designed for high-traffic production environments.',
    main: './dist/index.js',
    license: 'MIT',
    dependencies: {
      express: '^4.18.0',
      winston: '^3.8.0',
    },
  },
  null,
  2,
);

const apiResponse = JSON.stringify(
  {
    id: 'req_abc123',
    status: 'success',
    model: 'gpt-4',
    usage: { prompt_tokens: 120, completion_tokens: 80 },
    message: {
      role: 'assistant',
      content:
        'The deployment failed because the health check endpoint returned a 503 status code repeatedly over a five-minute window. This typically indicates that the application process started but failed to bind to the configured port, or that a required downstream service was unavailable at startup time.',
    },
  },
  null,
  2,
);

const tsconfigJson = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2020',
      module: 'NodeNext',
      strict: true,
      outDir: 'dist',
    },
    include: ['src'],
  },
  null,
  2,
);

const arrayOfObjects = JSON.stringify(
  [
    {
      id: 1,
      name: 'Alice',
      bio: 'Alice is a senior engineer who has spent the last decade building distributed systems at scale, with a focus on observability and reliability engineering in cloud-native environments.',
    },
    {
      id: 2,
      name: 'Bob',
      bio: 'Bob leads the platform team and is responsible for designing infrastructure abstractions that allow product teams to ship faster without managing operational complexity directly.',
    },
  ],
  null,
  2,
);

// ---------------------------------------------------------------------------
// detectJson
// ---------------------------------------------------------------------------

describe('detectJson', () => {
  it('detects JSON object', () => {
    expect(detectJson(packageJson)).toBe(true);
  });

  it('detects JSON array', () => {
    expect(detectJson(arrayOfObjects)).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectJson('Just a plain sentence.')).toBe(false);
  });

  it('rejects XML', () => {
    expect(detectJson('<root><child>value</child></root>')).toBe(false);
  });

  it('rejects YAML', () => {
    expect(detectJson('name: foo\nversion: 1.0.0\n')).toBe(false);
  });

  it('rejects JSON primitive', () => {
    expect(detectJson('"just a string"')).toBe(false);
    expect(detectJson('42')).toBe(false);
    expect(detectJson('true')).toBe(false);
  });

  it('rejects single-key object', () => {
    expect(detectJson('{"key": "value"}')).toBe(false);
  });

  it('rejects single-element array', () => {
    expect(detectJson('[{"a": 1}]')).toBe(false);
  });

  it('rejects invalid JSON', () => {
    expect(detectJson('{not valid json}')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractPreserved
// ---------------------------------------------------------------------------

describe('JsonConverter.extractPreserved', () => {
  it('returns a single serialized skeleton string', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    expect(preserved).toHaveLength(1);
  });

  it('preserves short atomic values', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const skeleton = preserved[0];
    expect(skeleton).toContain('"my-service"');
    expect(skeleton).toContain('"2.1.0"');
    expect(skeleton).toContain('"MIT"');
  });

  it('replaces long prose values with placeholder', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const skeleton = preserved[0];
    expect(skeleton).toContain('[…]');
    expect(skeleton).not.toContain('comprehensive set of utilities');
  });

  it('preserves all keys', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const skeleton = preserved[0];
    expect(skeleton).toContain('"name"');
    expect(skeleton).toContain('"description"');
    expect(skeleton).toContain('"dependencies"');
  });

  it('handles nested objects', () => {
    const preserved = JsonConverter.extractPreserved(apiResponse);
    const skeleton = preserved[0];
    expect(skeleton).toContain('"usage"');
    expect(skeleton).toContain('"prompt_tokens"');
    expect(skeleton).not.toContain('health check endpoint');
  });

  it('handles arrays of objects', () => {
    const preserved = JsonConverter.extractPreserved(arrayOfObjects);
    const skeleton = preserved[0];
    expect(skeleton).toContain('"Alice"');
    expect(skeleton).not.toContain('distributed systems at scale');
  });

  it('returns content unchanged on invalid JSON', () => {
    const bad = '{not json}';
    const preserved = JsonConverter.extractPreserved(bad);
    expect(preserved[0]).toBe(bad);
  });
});

// ---------------------------------------------------------------------------
// extractCompressible
// ---------------------------------------------------------------------------

describe('JsonConverter.extractCompressible', () => {
  it('extracts long prose string values', () => {
    const compressible = JsonConverter.extractCompressible(packageJson);
    expect(compressible.length).toBeGreaterThan(0);
    expect(compressible.some((c) => c.includes('comprehensive set of utilities'))).toBe(true);
  });

  it('does not include short atomic values', () => {
    const compressible = JsonConverter.extractCompressible(packageJson);
    expect(compressible.every((c) => c !== 'my-service')).toBe(true);
    expect(compressible.every((c) => c !== '2.1.0')).toBe(true);
  });

  it('extracts prose from nested objects', () => {
    const compressible = JsonConverter.extractCompressible(apiResponse);
    expect(compressible.some((c) => c.includes('health check endpoint'))).toBe(true);
  });

  it('extracts prose from arrays of objects', () => {
    const compressible = JsonConverter.extractCompressible(arrayOfObjects);
    expect(compressible.length).toBe(2);
    expect(compressible.some((c) => c.includes('distributed systems'))).toBe(true);
    expect(compressible.some((c) => c.includes('platform team'))).toBe(true);
  });

  it('returns empty for all-atomic JSON', () => {
    const atomic = JSON.stringify({ name: 'app', version: '1.0', port: 3000, debug: false }, null, 2);
    expect(JsonConverter.extractCompressible(atomic)).toHaveLength(0);
  });

  it('returns empty on invalid JSON', () => {
    expect(JsonConverter.extractCompressible('{not json}')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// reconstruct
// ---------------------------------------------------------------------------

describe('JsonConverter.reconstruct', () => {
  it('adds _summary key to object skeleton', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const result = JsonConverter.reconstruct(preserved, 'utilities for microservices with routing');
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed._summary).toBe('utilities for microservices with routing');
    expect(parsed.name).toBe('my-service');
  });

  it('wraps array skeleton with _data and _summary', () => {
    const preserved = JsonConverter.extractPreserved(arrayOfObjects);
    const result = JsonConverter.reconstruct(preserved, 'two engineers: Alice and Bob');
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed._summary).toBe('two engineers: Alice and Bob');
    expect(Array.isArray(parsed._data)).toBe(true);
  });

  it('omits _summary when summary is empty', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const result = JsonConverter.reconstruct(preserved, '');
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed._summary).toBeUndefined();
  });

  it('output is valid JSON', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const result = JsonConverter.reconstruct(preserved, 'some summary text here');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// end-to-end
// ---------------------------------------------------------------------------

describe('JsonConverter end-to-end', () => {
  it('produces shorter output than input for prose-heavy JSON', () => {
    const preserved = JsonConverter.extractPreserved(packageJson);
    const compressible = JsonConverter.extractCompressible(packageJson);
    const summary = compressible.join(' ').slice(0, 80);
    const output = JsonConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(packageJson.length);
  });

  it('produces shorter output for API response with long content field', () => {
    const preserved = JsonConverter.extractPreserved(apiResponse);
    const compressible = JsonConverter.extractCompressible(apiResponse);
    const summary = compressible.join(' ').slice(0, 80);
    const output = JsonConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(apiResponse.length);
  });
});
