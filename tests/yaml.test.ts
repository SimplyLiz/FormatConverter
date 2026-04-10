import { describe, it, expect } from 'vitest';
import { YamlConverter, detectYaml, isAtomicYamlValue } from '../src/yaml.js';

const k8sDeployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  namespace: production
  labels:
    app: nginx
    version: "1.25"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        description: This container runs the nginx web server and handles all incoming HTTP traffic for the production environment serving thousands of users daily
        ports:
        - containerPort: 80`;

const githubActionsYaml = `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: go test ./...`;

const allAtomicYaml = 'name: myapp\nversion: 1.0.0\nenabled: true\nreplicas: 3\nport: 8080\n';

describe('detectYaml', () => {
  it('detects Kubernetes deployment', () => {
    expect(detectYaml(k8sDeployment)).toBe(true);
  });

  it('detects GitHub Actions workflow', () => {
    expect(detectYaml(githubActionsYaml)).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectYaml('Just a sentence here.')).toBe(false);
  });

  it('rejects very short YAML', () => {
    expect(detectYaml('name: foo\nversion: 1')).toBe(false);
  });
});

describe('isAtomicYamlValue', () => {
  it('treats empty as atomic (nested object follows)', () => {
    expect(isAtomicYamlValue('')).toBe(true);
  });

  it('treats booleans as atomic', () => {
    expect(isAtomicYamlValue('true')).toBe(true);
    expect(isAtomicYamlValue('false')).toBe(true);
  });

  it('treats null as atomic', () => {
    expect(isAtomicYamlValue('null')).toBe(true);
    expect(isAtomicYamlValue('~')).toBe(true);
  });

  it('treats numbers as atomic', () => {
    expect(isAtomicYamlValue('3')).toBe(true);
    expect(isAtomicYamlValue('1.25')).toBe(true);
  });

  it('treats short strings as atomic', () => {
    expect(isAtomicYamlValue('nginx:1.25')).toBe(true);
    expect(isAtomicYamlValue('apps/v1')).toBe(true);
  });

  it('treats block indicators as atomic', () => {
    expect(isAtomicYamlValue('|')).toBe(true);
    expect(isAtomicYamlValue('>')).toBe(true);
  });

  it('treats long prose as non-atomic', () => {
    expect(
      isAtomicYamlValue(
        'This container handles all incoming traffic for the production environment serving thousands of users',
      ),
    ).toBe(false);
  });
});

describe('YamlConverter', () => {
  it('name is yaml', () => {
    expect(YamlConverter.name).toBe('yaml');
  });

  it('extractPreserved keeps apiVersion, kind, replicas', () => {
    const preserved = YamlConverter.extractPreserved(k8sDeployment);
    const joined = preserved.join('\n');
    expect(joined).toContain('apiVersion: apps/v1');
    expect(joined).toContain('kind: Deployment');
    expect(joined).toContain('replicas: 3');
  });

  it('extractPreserved drops long prose values', () => {
    const preserved = YamlConverter.extractPreserved(k8sDeployment);
    expect(preserved.join('\n')).not.toContain('thousands of users');
  });

  it('extractCompressible returns long prose values', () => {
    const compressible = YamlConverter.extractCompressible(k8sDeployment);
    expect(compressible.length).toBeGreaterThan(0);
    expect(compressible.some((c) => c.includes('thousands of users'))).toBe(true);
  });

  it('extractCompressible returns empty for all-atomic YAML', () => {
    expect(YamlConverter.extractCompressible(allAtomicYaml)).toHaveLength(0);
  });

  it('reconstruct appends summary as YAML comment', () => {
    const result = YamlConverter.reconstruct(['name: myapp', 'version: 1.0.0'], 'routes traffic to backends');
    expect(result).toContain('# routes traffic to backends');
    expect(result).toContain('name: myapp');
  });

  it('reconstruct omits comment when summary is empty', () => {
    const result = YamlConverter.reconstruct(['name: myapp'], '');
    expect(result).not.toContain('#');
  });

  it('produces shorter output than input for YAML with prose values', () => {
    const preserved = YamlConverter.extractPreserved(k8sDeployment);
    const compressible = YamlConverter.extractCompressible(k8sDeployment);
    const summary = compressible.join(' ').slice(0, 60);
    const output = YamlConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(k8sDeployment.length);
  });
});
