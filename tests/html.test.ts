import { describe, it, expect } from 'vitest';
import { HtmlConverter, detectHtml, htmlSkeleton, htmlProseNodes } from '../src/html.js';

const articleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Getting Started with Kubernetes</title>
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <header>
    <nav><a href="/">Home</a></nav>
  </header>
  <main>
    <h1>Getting Started with Kubernetes</h1>
    <p>Kubernetes is an open-source container orchestration platform that automates deploying, scaling, and managing containerized applications across clusters of hosts. It was originally designed by Google and is now maintained by the CNCF.</p>
    <h2>Installation</h2>
    <p>To install Kubernetes locally for development purposes, the recommended approach is to use minikube, which creates a single-node Kubernetes cluster on your local machine using a virtual machine or container runtime.</p>
    <script>console.log('analytics');</script>
  </main>
</body>
</html>`;

const simpleHtml = `<html><body><div><p>Hello world</p></div></body></html>`;

describe('detectHtml', () => {
  it('detects HTML with DOCTYPE', () => {
    expect(detectHtml(articleHtml)).toBe(true);
  });

  it('detects simple HTML without DOCTYPE', () => {
    expect(detectHtml(simpleHtml)).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectHtml('Just some plain text here.')).toBe(false);
  });

  it('rejects XML without html tags', () => {
    expect(detectHtml('<root><child>value</child></root>')).toBe(false);
  });

  it('rejects YAML', () => {
    expect(detectHtml('name: foo\nversion: 1.0\nport: 8080\nenabled: true\n')).toBe(false);
  });
});

describe('htmlSkeleton', () => {
  it('replaces script content with [code] marker', () => {
    const skeleton = htmlSkeleton(articleHtml);
    expect(skeleton).toContain('<script>[code]</script>');
    expect(skeleton).not.toContain("console.log('analytics')");
  });

  it('replaces style content with [code] marker', () => {
    const skeleton = htmlSkeleton(articleHtml);
    expect(skeleton).toContain('<style>[code]</style>');
    expect(skeleton).not.toContain('font-family');
  });

  it('collapses long prose text nodes to placeholder', () => {
    const skeleton = htmlSkeleton(articleHtml);
    expect(skeleton).toContain('[…]');
    expect(skeleton).not.toContain('container orchestration platform');
  });

  it('preserves short text like headings', () => {
    const skeleton = htmlSkeleton(articleHtml);
    expect(skeleton).toContain('Getting Started with Kubernetes');
  });

  it('preserves all structural tags', () => {
    const skeleton = htmlSkeleton(articleHtml);
    expect(skeleton).toContain('<header>');
    expect(skeleton).toContain('<main>');
    expect(skeleton).toContain('<h1>');
    expect(skeleton).toContain('<h2>');
  });
});

describe('htmlProseNodes', () => {
  it('extracts long prose text nodes', () => {
    const nodes = htmlProseNodes(articleHtml);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.some((n) => n.includes('container orchestration platform'))).toBe(true);
  });

  it('does not include script content', () => {
    const nodes = htmlProseNodes(articleHtml);
    expect(nodes.every((n) => !n.includes('console.log'))).toBe(true);
  });

  it('does not include style content', () => {
    const nodes = htmlProseNodes(articleHtml);
    expect(nodes.every((n) => !n.includes('font-family'))).toBe(true);
  });

  it('returns empty for structure-only HTML', () => {
    expect(htmlProseNodes(simpleHtml)).toHaveLength(0);
  });
});

describe('HtmlConverter.reconstruct', () => {
  it('appends summary as HTML comment', () => {
    const preserved = HtmlConverter.extractPreserved(articleHtml);
    const result = HtmlConverter.reconstruct(preserved, 'Kubernetes intro and installation guide');
    expect(result).toContain('<!-- Kubernetes intro and installation guide -->');
  });

  it('omits comment when summary is empty', () => {
    const result = HtmlConverter.reconstruct(['<html></html>'], '');
    expect(result).not.toContain('<!--');
  });
});

describe('HtmlConverter end-to-end', () => {
  it('produces shorter output than input for prose-heavy HTML', () => {
    const preserved = HtmlConverter.extractPreserved(articleHtml);
    const compressible = HtmlConverter.extractCompressible(articleHtml);
    const summary = compressible.join(' ').slice(0, 80);
    const output = HtmlConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(articleHtml.length);
  });
});
