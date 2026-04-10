# format-converters

[![CI](https://github.com/SimplyLiz/FormatConverter/actions/workflows/ci.yml/badge.svg)](https://github.com/SimplyLiz/FormatConverter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@lisa/format-converters.svg)](https://www.npmjs.com/package/@lisa/format-converters)
[![license](https://img.shields.io/badge/license-Community-blue)](#license)

Detect and split structured content into what must stay verbatim and what can be compressed or summarized. Zero dependencies. 152 tests. Works everywhere JavaScript runs.

```ts
import { detect } from '@lisa/format-converters';

const result = detect(content);
// result?.format      → 'json' | 'xml' | 'html' | 'yaml' | 'toml' | 'markdown' | 'csv' | 'dockerfile'
// result?.converter.extractPreserved(content)    → structural skeleton
// result?.converter.extractCompressible(content) → prose segments to summarize
// result?.converter.reconstruct(preserved, summary) → reassembled output
```

Supports **JSON, XML, HTML, YAML, TOML, Markdown, CSV, and Dockerfile**. Node 18+, Deno, Bun, edge runtimes. ESM only.

---

## The problem it solves

LLM pipelines regularly receive structured documents — Kubernetes manifests, API responses, changelogs, Dockerfiles — as message content. Treating them as flat prose wastes tokens and destroys the structure the LLM needs to reason about them.

`format-converters` splits each format at the right seam: keep the structure, compress the prose.

**Before** (a Kubernetes deployment, 480 chars):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        description: This container runs the nginx web server and handles all
          incoming HTTP and HTTPS traffic for the production environment,
          serving requests from thousands of concurrent users daily with
          automatic health checking and graceful restart on failure.
```

**After** (skeleton + summary comment, 148 chars):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
# nginx web server for production, high-traffic, health-checked
```

The keys, versions, and replica count survive verbatim. The verbose prose description is replaced by a summary. **3.2x smaller, structure intact.**

---

## Install

```bash
npm install @lisa/format-converters
```

---

## Quick start

### Auto-detect and split

```ts
import { detect } from '@lisa/format-converters';

const result = detect(content);
if (result) {
  const preserved    = result.converter.extractPreserved(content);
  const compressible = result.converter.extractCompressible(content);
  const summary      = await myLlm.summarize(compressible.join('\n'));
  const output       = result.converter.reconstruct(preserved, summary);
  // output is always ≤ original length — check before using
}
```

### Pick a specific converter

```ts
import { YamlConverter } from '@lisa/format-converters';

if (YamlConverter.detect(content)) {
  const skeleton = YamlConverter.extractPreserved(content);
  const prose    = YamlConverter.extractCompressible(content);
  const output   = YamlConverter.reconstruct(skeleton, summarize(prose));
}
```

### Iterate all converters

```ts
import { converters } from '@lisa/format-converters';
// [JsonConverter, XmlConverter, HtmlConverter, YamlConverter,
//  TomlConverter, MarkdownConverter, CsvConverter, DockerfileConverter]
// First match wins — JSON and XML are checked before YAML.

for (const converter of converters) {
  if (converter.detect(content)) {
    // ...
  }
}
```

---

## What each converter does

| Format | Preserved verbatim | Compressible |
|---|---|---|
| **JSON** | All keys, numbers, booleans, short strings | String values ≥6 words and ≥100 chars |
| **XML** | Full tag skeleton, attributes, short text values | Prose text nodes and verbose XML comments |
| **HTML** | Full tag skeleton, `<script>`/`<style>` as `[code]` | Prose text nodes and verbose HTML comments |
| **YAML** | All keys, booleans, numbers, strings ≤60 chars | String values that are long prose |
| **TOML** | Section headers, all keys with atomic values | String values that are long prose |
| **Markdown** | All headings (`#`–`######`), table blocks | Paragraph prose between structural elements |
| **CSV** | Header row + row count annotation | All data rows |
| **Dockerfile** | All instruction lines, short/directive comments | Multi-line prose comment blocks |

Detection is heuristic and fast — no external parsers, no AST. Each converter is designed to fail safe: if `reconstruct()` output is not shorter than the original, discard it and keep the original.

---

## Format examples

### JSON — API response

```ts
import { JsonConverter } from '@lisa/format-converters';

// Input: {"id": "req_1", "model": "gpt-4", "message": {"content": "The deployment
//   failed because the health check endpoint returned 503 repeatedly..."}}
//
// extractPreserved → {"id": "req_1", "model": "gpt-4", "message": {"content": "[…]"}}
// extractCompressible → ["The deployment failed because the health check..."]
// reconstruct → skeleton + {"_summary": "health check 503, deployment failed"}
```

### XML — Maven POM

```ts
import { XmlConverter } from '@lisa/format-converters';

// Input: <project><description>This is a lengthy explanation of what the project
//   does and how it integrates with other systems...</description></project>
//
// extractPreserved → <project><description>[…]</description></project>
// extractCompressible → ["lengthy explanation of what the project does..."]
// reconstruct → skeleton + <!-- integrates with other systems -->
```

### Dockerfile — multi-stage build

```ts
import { DockerfileConverter } from '@lisa/format-converters';

// Input:
//   # This stage compiles the Go binary and runs all unit tests to ensure
//   # correctness before packaging into the final distroless runtime image.
//   FROM golang:1.22-alpine AS builder
//   ...
//
// extractPreserved → FROM / RUN / COPY instructions only
// extractCompressible → ["This stage compiles the Go binary and runs..."]
// reconstruct → instructions + # Go build stage, distroless runtime
```

---

## API reference

### `detect(content: string): DetectResult | undefined`

Returns the first matching converter, or `undefined` if no format matches (plain prose, shell scripts, etc.).

```ts
interface DetectResult {
  converter: FormatConverter;
  format: 'json' | 'xml' | 'html' | 'yaml' | 'toml' | 'markdown' | 'csv' | 'dockerfile';
}
```

### `FormatConverter` interface

```ts
interface FormatConverter {
  /** Unique name — appears in trace/debug output. */
  name: string;

  /** Returns true if this converter handles the given content. Called on every message — keep fast. */
  detect(content: string): boolean;

  /** Structural parts that must survive verbatim (tags, keys, headings, instructions). */
  extractPreserved(content: string): string[];

  /** Prose segments that can be summarized or compressed. */
  extractCompressible(content: string): string[];

  /**
   * Reassemble from preserved structure and a summary string.
   * Always check: if output >= original length, discard and keep original.
   */
  reconstruct(preserved: string[], summary: string): string;
}
```

### Detection criteria

| Export | `name` | Detects when… |
|---|---|---|
| `JsonConverter` | `'json'` | Valid JSON object (≥2 keys) or array (≥2 items) |
| `XmlConverter` | `'xml'` | Starts with `<?xml` or a letter-tag and has a closing tag |
| `HtmlConverter` | `'html'` | Has `<!DOCTYPE html>` or `<html` and structural closing tags |
| `YamlConverter` | `'yaml'` | ≥4 non-empty lines, >35% match `key: value` pattern |
| `TomlConverter` | `'toml'` | ≥2 `key = value` lines with section headers or density >40% |
| `MarkdownConverter` | `'markdown'` | ≥2 heading lines and content ≥200 chars |
| `CsvConverter` | `'csv'` | ≥3 lines with commas, consistent column count |
| `DockerfileConverter` | `'dockerfile'` | ≥2 Dockerfile instruction keywords (FROM, RUN, COPY, …) |

### Low-level exports

All internal helpers are exported for use in custom pipelines:

```ts
import {
  detectJson,
  detectXml, xmlSkeleton, xmlProseNodes,
  detectHtml, htmlSkeleton, htmlProseNodes,
  detectYaml, isAtomicYamlValue,
  detectToml, isAtomicTomlValue,
  detectMarkdown,
  detectCsv,
  detectDockerfile,
  looksLikeProse,   // true if text has ≥6 words and ≥100 chars
} from '@lisa/format-converters';
```

---

## Writing a custom converter

Implement `FormatConverter` and register it:

```ts
import type { FormatConverter } from '@lisa/format-converters';
import { converters, detect } from '@lisa/format-converters';

const IniConverter: FormatConverter = {
  name: 'ini',

  detect(content) {
    const lines = content.split('\n').filter(l => l.trim());
    return lines.some(l => /^\[.+\]$/.test(l)) && lines.some(l => /^\w+=/.test(l));
  },

  extractPreserved(content) {
    return content.split('\n').filter(l => {
      const t = l.trim();
      return !t || t.startsWith('[') || t.startsWith(';') || t.split('=')[1]?.trim().length <= 60;
    });
  },

  extractCompressible(content) {
    return content.split('\n').filter(l => {
      const val = l.split('=')[1]?.trim() ?? '';
      return val.length > 60;
    });
  },

  reconstruct(preserved, summary) {
    return summary ? `${preserved.join('\n')}\n; ${summary}` : preserved.join('\n');
  },
};

// Use standalone
IniConverter.detect(content);

// Or prepend to the built-in list
const myConverters = [IniConverter, ...converters];
```

---

## Integration with context-compression-engine

`FormatConverter` (this library) and `FormatAdapter` ([context-compression-engine](https://github.com/SimplyLiz/ContextCompressionEngine)) share the same four-method interface. TypeScript's structural typing lets you pass any converter directly as an adapter — no wrapper needed:

```ts
import { compress } from 'context-compression-engine';
import { converters } from '@lisa/format-converters';

compress(messages, { adapters: converters });
```

---

## Contributing

Bug reports and pull requests are welcome. Open an issue first for anything beyond small fixes so we can align on direction before you invest time.

```bash
git clone https://github.com/SimplyLiz/FormatConverter.git
cd FormatConverter
npm install
npm test
```

**Adding a new converter:**
1. Create `src/<format>.ts` — implement `FormatConverter`, export the converter and any helpers
2. Register it in `src/registry.ts` — order matters, first match wins
3. Export from `src/index.ts`
4. Add `tests/<format>.test.ts` — cover `detect`, `extractPreserved`, `extractCompressible`, `reconstruct`, and an end-to-end shorter-than-input check

---

## License

**Free** for personal projects, educational use, academic research, and organizations with annual revenue below **USD 25,000**.

**Commercial license required** for organizations with annual revenue of USD 25,000 or more. Contact [lisa@tastehub.io](mailto:lisa@tastehub.io) for pricing.

See [LICENSE](LICENSE) for the full terms.
