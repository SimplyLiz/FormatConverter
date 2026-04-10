export type { FormatConverter, DetectResult } from './types.js';
export { looksLikeProse } from './shared.js';

// XML
export { XmlConverter, detectXml, xmlSkeleton, xmlProseNodes } from './xml.js';

// YAML
export { YamlConverter, detectYaml, isAtomicYamlValue } from './yaml.js';

// Markdown
export { MarkdownConverter, detectMarkdown } from './markdown.js';

/**
 * All built-in converters in recommended detection order, plus auto-detect.
 * XML before YAML — XML can contain colons that naive YAML detection might match.
 */
export { converters, detect } from './registry.js';
