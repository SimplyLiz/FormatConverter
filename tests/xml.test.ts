import { describe, it, expect } from 'vitest';
import { XmlConverter, detectXml, xmlSkeleton, xmlProseNodes } from '../src/xml.js';

const mavenPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>myapp</artifactId>
  <version>2.1.0</version>
  <description>This is a lengthy description of the application that explains in detail what the project does, why it exists, and how it integrates with the rest of the system.</description>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.0.0</version>
    </dependency>
  </dependencies>
</project>`;

const structureOnly = '<config><host>localhost</host><port>8080</port></config>';

describe('detectXml', () => {
  it('detects XML with declaration', () => {
    expect(detectXml(mavenPom)).toBe(true);
  });

  it('detects XML without declaration', () => {
    expect(detectXml('<root><child>value</child></root>')).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectXml('This is just a sentence.')).toBe(false);
  });

  it('rejects YAML', () => {
    const yaml = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: nginx\n';
    expect(detectXml(yaml)).toBe(false);
  });

  it('rejects self-closing tag without closing tag', () => {
    expect(detectXml('<br />')).toBe(false);
  });
});

describe('xmlSkeleton', () => {
  it('collapses long prose text nodes to placeholder', () => {
    const skeleton = xmlSkeleton(mavenPom);
    expect(skeleton).toContain('[…]');
    expect(skeleton).not.toContain('lengthy description');
  });

  it('preserves short values intact', () => {
    const skeleton = xmlSkeleton(mavenPom);
    expect(skeleton).toContain('2.1.0');
    expect(skeleton).toContain('myapp');
    expect(skeleton).toContain('com.example');
  });

  it('preserves all tags', () => {
    const skeleton = xmlSkeleton(mavenPom);
    expect(skeleton).toContain('<groupId>');
    expect(skeleton).toContain('<artifactId>');
    expect(skeleton).toContain('</project>');
  });
});

describe('xmlProseNodes', () => {
  it('extracts long prose text nodes', () => {
    const nodes = xmlProseNodes(mavenPom);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.some((n) => n.includes('lengthy description'))).toBe(true);
  });

  it('does not include short values', () => {
    const nodes = xmlProseNodes(mavenPom);
    expect(nodes.every((n) => !n.includes('2.1.0'))).toBe(true);
    expect(nodes.every((n) => !n.includes('com.example'))).toBe(true);
  });

  it('returns empty for structure-only XML', () => {
    expect(xmlProseNodes(structureOnly)).toHaveLength(0);
  });

  it('extracts prose from XML comments', () => {
    const withComment = `<root>
  <name>myapp</name>
  <!-- This comment explains in great detail why this configuration exists and how it should be used in production environments. -->
</root>`;
    const nodes = xmlProseNodes(withComment);
    expect(nodes.some((n) => n.includes('production environments'))).toBe(true);
  });
});

describe('XmlConverter', () => {
  it('name is xml', () => {
    expect(XmlConverter.name).toBe('xml');
  });

  it('extractPreserved returns skeleton as single entry', () => {
    const preserved = XmlConverter.extractPreserved(mavenPom);
    expect(preserved).toHaveLength(1);
    expect(preserved[0]).toContain('<groupId>');
  });

  it('reconstruct appends summary as XML comment', () => {
    const result = XmlConverter.reconstruct(['<root><child/></root>'], 'project integrating with org systems');
    expect(result).toContain('<!-- project integrating with org systems -->');
    expect(result).toContain('<root>');
  });

  it('reconstruct omits comment when summary is empty', () => {
    const result = XmlConverter.reconstruct(['<root/>'], '');
    expect(result).toBe('<root/>');
    expect(result).not.toContain('<!--');
  });

  it('produces shorter output than input for prose-heavy XML', () => {
    const preserved = XmlConverter.extractPreserved(mavenPom);
    const compressible = XmlConverter.extractCompressible(mavenPom);
    const summary = compressible.join(' ').slice(0, 60);
    const output = XmlConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(mavenPom.length);
  });
});
