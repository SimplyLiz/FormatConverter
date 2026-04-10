import { JsonConverter } from './json.js';
import { XmlConverter } from './xml.js';
import { YamlConverter } from './yaml.js';
import { MarkdownConverter } from './markdown.js';
import type { FormatConverter, DetectResult } from './types.js';

/**
 * All built-in converters in recommended detection order.
 * JSON and XML before YAML — both can contain colons that naive YAML detection might match.
 * Import and spread into your own list to extend or reorder.
 */
export const converters: FormatConverter[] = [JsonConverter, XmlConverter, YamlConverter, MarkdownConverter];

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
