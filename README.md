# format-converters

[![CI](https://github.com/SimplyLiz/FormatConverters/actions/workflows/ci.yml/badge.svg)](https://github.com/SimplyLiz/FormatConverters/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@lisa/format-converters.svg)](https://www.npmjs.com/package/@lisa/format-converters)
[![license](https://img.shields.io/badge/license-Community-blue)](#license)

Zero-dependency TypeScript library for detecting and splitting structured formats — JSON, XML, YAML, and Markdown — into parts that must survive verbatim and parts that can be compressed or summarized. **87 tests. Zero dependencies. Works everywhere JavaScript runs.**

```ts
import { detect } from '@lisa/format-converters';

const result = detect(content);
// result.format  → 'xml' | 'yaml' | 'markdown'
// result.converter.extractPreserved(content)   → structural skeleton
// result.converter.extractCompressible(content) → prose segments
```

Works in Node 18+, Deno, Bun, and edge runtimes. ESM only.

---

## Why

LLM pipelines often receive documents — config files, API responses, changelogs, manifests — as message content. Treating them as plain prose wastes tokens and destroys structure. This library splits each format at the right seam:

| Format | Preserved | Compressible |
|---|---|---|
| JSON | Keys, short values, numbers, booleans | String values that are prose (6+ words, 100+ chars) |
| XML | Tags, attributes, short values | Prose text nodes, verbose comments |
| YAML | Keys, booleans, numbers, short strings | Keys with long prose values |
| Markdown | Headings, tables | Paragraph prose between headings |

The splitting logic is the same pattern used in [context-compression-engine](https://github.com/SimplyLiz/ContextCompressionEngine) — extracted here so it can be reused independently.

---

## Install

```bash
npm install @lisa/format-converters
```

---

## Usage

### Auto-detect

```ts
import { detect } from '@lisa/format-converters';

const result = detect(content);
if (result) {
  const preserved = result.converter.extractPreserved(content);
  const compressible = result.converter.extractCompressible(content);
  const output = result.converter.reconstruct(preserved, summarize(compressible));
}
```

### Individual converters

```ts
import { XmlConverter, YamlConverter, MarkdownConverter } from '@lisa/format-converters';

if (XmlConverter.detect(content)) {
  const skeleton = XmlConverter.extractPreserved(content);  // ['<project>...</project>']
  const prose = XmlConverter.extractCompressible(content);  // ['long description text...']
}
```

### Custom converter

```ts
import type { FormatConverter } from '@lisa/format-converters';

const CsvConverter: FormatConverter = {
  name: 'csv',
  detect: (content) => content.split('\n').length >= 3 && content.includes(','),
  extractPreserved: (content) => [content.split('\n')[0]],     // header row
  extractCompressible: (content) => content.split('\n').slice(1),
  reconstruct: (preserved, summary) => `${preserved.join('\n')}\n[${summary}]`,
};
```

### All converters

```ts
import { converters } from '@lisa/format-converters';
// [XmlConverter, YamlConverter, MarkdownConverter]
// First match wins — XML is checked before YAML.
```

---

## API

### `detect(content: string): DetectResult | undefined`

Returns the first matching converter, or `undefined` if no converter matches.

```ts
interface DetectResult {
  converter: FormatConverter;
  format: string; // 'xml' | 'yaml' | 'markdown'
}
```

### `FormatConverter` interface

```ts
interface FormatConverter {
  name: string;
  detect(content: string): boolean;
  extractPreserved(content: string): string[];
  extractCompressible(content: string): string[];
  reconstruct(preserved: string[], summary: string): string;
}
```

`reconstruct()` must return something shorter than the original for compression to apply — check the length and fall back to the original if not.

### Built-in converters

| Export | Name | Detects |
|---|---|---|
| `JsonConverter` | `'json'` | Valid JSON object (≥2 keys) or array (≥2 items) |
| `XmlConverter` | `'xml'` | Starts with `<?xml` or a letter-tag + has a closing tag |
| `YamlConverter` | `'yaml'` | ≥4 non-empty lines, >35% are `key: value` lines |
| `MarkdownConverter` | `'markdown'` | ≥2 heading lines (`#`–`######`) and content ≥200 chars |

### Low-level exports

```ts
// JSON
import { detectJson } from '@lisa/format-converters';

// XML
import { detectXml, xmlSkeleton, xmlProseNodes } from '@lisa/format-converters';

// YAML
import { detectYaml, isAtomicYamlValue } from '@lisa/format-converters';

// Markdown
import { detectMarkdown } from '@lisa/format-converters';

// Shared
import { looksLikeProse } from '@lisa/format-converters';
```

---

## Integration with context-compression-engine

`FormatConverter` (this library) and `FormatAdapter` ([context-compression-engine](https://github.com/SimplyLiz/ContextCompressionEngine)) are structurally identical — same four methods, same signatures. TypeScript's structural typing means you can pass converters directly as adapters with no wrapper:

```ts
import { compress } from 'context-compression-engine';
import { XmlConverter, YamlConverter, MarkdownConverter } from '@lisa/format-converters';

compress(messages, {
  adapters: [XmlConverter, YamlConverter, MarkdownConverter],
});
```

---

## Contributing

Bug reports and pull requests are welcome. Please open an issue first for anything beyond small fixes so we can align on direction.

```bash
git clone https://github.com/SimplyLiz/FormatConverters.git
cd FormatConverters
npm install
npm test
```

Adding a new converter? Implement `FormatConverter`, add it to `src/registry.ts`, export it from `src/index.ts`, and add tests covering `detect`, `extractPreserved`, `extractCompressible`, and `reconstruct`.

---

## License

**Free** for personal projects, educational use, academic research, and organizations with annual revenue below **USD 25,000**.

**Commercial license required** for organizations with annual revenue of USD 25,000 or more. Contact [lisa@tastehub.io](mailto:lisa@tastehub.io) for terms.

See [LICENSE](LICENSE) for the full terms.
