export type { FormatConverter, DetectResult, CompressibleSegment, CompressionBudget } from './types.js';
export { looksLikeProse, splitProse, findSegments, segmentsOf } from './shared.js';

// JSON
export { JsonConverter, detectJson } from './json.js';

// XML
export { XmlConverter, detectXml, xmlSkeleton, xmlProseNodes } from './xml.js';

// HTML
export { HtmlConverter, detectHtml, htmlSkeleton, htmlProseNodes } from './html.js';

// YAML
export { YamlConverter, detectYaml, isAtomicYamlValue } from './yaml.js';

// TOML
export { TomlConverter, detectToml, isAtomicTomlValue } from './toml.js';

// Markdown
export { MarkdownConverter, detectMarkdown } from './markdown.js';

// CSV
export { CsvConverter, detectCsv } from './csv.js';

// Dockerfile
export { DockerfileConverter, detectDockerfile } from './dockerfile.js';

/**
 * All built-in converters in recommended detection order, plus auto-detect.
 * JSON and XML/HTML before YAML — all can contain colons that naive YAML detection might match.
 * TOML before Markdown — TOML files can have `#` headings in comments.
 */
export { converters, detect } from './registry.js';
