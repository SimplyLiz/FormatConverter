import { JsonConverter } from './json.js';
import { XmlConverter } from './xml.js';
import { HtmlConverter } from './html.js';
import { YamlConverter } from './yaml.js';
import { TomlConverter } from './toml.js';
import { MarkdownConverter } from './markdown.js';
import { CsvConverter } from './csv.js';
import { DockerfileConverter } from './dockerfile.js';
import type { FormatConverter, DetectResult } from './types.js';

/**
 * All built-in converters in recommended detection order.
 * - JSON/XML/HTML before YAML — all can contain colons that naive YAML detection might match.
 * - TOML before Markdown — TOML files can have `#` headings in comments.
 * Import and spread into your own list to extend or reorder.
 */
export const converters: FormatConverter[] = [
  JsonConverter,
  XmlConverter,
  HtmlConverter,
  YamlConverter,
  TomlConverter,
  MarkdownConverter,
  CsvConverter,
  DockerfileConverter,
];

/**
 * Detect the format of a string, returning the first matching converter.
 * Returns undefined if no converter matches.
 */
export function detect(content: string): DetectResult | undefined {
  for (const converter of converters) {
    if (converter.detect(content)) {
      return { converter, format: converter.name };
    }
  }
  return undefined;
}
