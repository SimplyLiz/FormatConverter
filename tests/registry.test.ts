import { describe, it, expect } from 'vitest';
import { detect, converters } from '../src/registry.js';

describe('detect', () => {
  it('detects XML', () => {
    const result = detect('<root><child>value</child></root>');
    expect(result?.format).toBe('xml');
  });

  it('detects YAML', () => {
    const yaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: nginx\n  namespace: prod\nspec:\n  replicas: 3\n`;
    const result = detect(yaml);
    expect(result?.format).toBe('yaml');
  });

  it('detects Markdown', () => {
    const md = `# Title\n\nThis is a paragraph explaining the purpose of this document in some detail.\n\n## Section\n\nMore content here explaining the section topic with sufficient length.\n\n## Another\n\nFinal paragraph content with enough text to exceed the 200-char threshold.`;
    const result = detect(md);
    expect(result?.format).toBe('markdown');
  });

  it('returns undefined for plain prose', () => {
    expect(detect('Just plain text.')).toBeUndefined();
  });

  it('XML wins over YAML when content starts with tags', () => {
    // XML comes first in the default order
    const xml = '<config><key>value</key></config>';
    expect(detect(xml)?.format).toBe('xml');
  });
});

describe('converters', () => {
  it('exports four built-in converters', () => {
    expect(converters).toHaveLength(4);
  });

  it('names are json, xml, yaml, markdown in detection order', () => {
    expect(converters.map((c) => c.name)).toEqual(['json', 'xml', 'yaml', 'markdown']);
  });
});
