export type { FormatConverter, DetectResult } from './types.js';
export { looksLikeProse } from './shared.js';

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
 * XML before YAML — XML can contain colons that naive YAML detection might match.
 */
export { converters, detect } from './registry.js';
