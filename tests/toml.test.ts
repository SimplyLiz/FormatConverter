import { describe, it, expect } from 'vitest';
import { TomlConverter, detectToml, isAtomicTomlValue } from '../src/toml.js';

const cargoToml = `[package]
name = "my-service"
version = "0.1.0"
edition = "2021"
description = "A high-performance HTTP service that handles authentication, authorization, and session management for distributed microservice architectures running in Kubernetes."

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
axum = "0.7"

[dev-dependencies]
tokio-test = "0.4"

[profile.release]
opt-level = 3
lto = true`;

const pyprojectToml = `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mypackage"
version = "1.2.0"
description = "This package provides data processing utilities for ETL pipelines, including connectors for major cloud storage providers and transformation functions optimized for large datasets."
requires-python = ">=3.11"
dependencies = [
    "requests>=2.28",
    "pandas>=2.0",
]

[tool.ruff]
line-length = 100
target-version = "py311"`;

const allAtomicToml = `[server]
host = "localhost"
port = 8080
debug = false
workers = 4`;

describe('detectToml', () => {
  it('detects Cargo.toml', () => {
    expect(detectToml(cargoToml)).toBe(true);
  });

  it('detects pyproject.toml', () => {
    expect(detectToml(pyprojectToml)).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectToml('Just a plain sentence here.')).toBe(false);
  });

  it('rejects YAML (uses : not =)', () => {
    expect(detectToml('name: myapp\nversion: 1.0.0\nport: 8080\nenabled: true\n')).toBe(false);
  });

  it('rejects too-short content', () => {
    expect(detectToml('name = "foo"')).toBe(false);
  });
});

describe('isAtomicTomlValue', () => {
  it('treats booleans as atomic', () => {
    expect(isAtomicTomlValue('true')).toBe(true);
    expect(isAtomicTomlValue('false')).toBe(true);
  });

  it('treats numbers as atomic', () => {
    expect(isAtomicTomlValue('3')).toBe(true);
    expect(isAtomicTomlValue('0.7')).toBe(true);
    expect(isAtomicTomlValue('1_000_000')).toBe(true);
  });

  it('treats short strings as atomic', () => {
    expect(isAtomicTomlValue('"my-service"')).toBe(true);
    expect(isAtomicTomlValue('"2021"')).toBe(true);
  });

  it('treats inline arrays and tables as atomic', () => {
    expect(isAtomicTomlValue('["full"]')).toBe(true);
    expect(isAtomicTomlValue('{ version = "1.0" }')).toBe(true);
  });

  it('treats long prose strings as non-atomic', () => {
    expect(
      isAtomicTomlValue(
        '"A high-performance HTTP service that handles authentication and authorization for distributed systems."',
      ),
    ).toBe(false);
  });
});

describe('TomlConverter.extractPreserved', () => {
  it('preserves section headers', () => {
    const preserved = TomlConverter.extractPreserved(cargoToml);
    const joined = preserved.join('\n');
    expect(joined).toContain('[package]');
    expect(joined).toContain('[dependencies]');
    expect(joined).toContain('[profile.release]');
  });

  it('preserves short atomic values', () => {
    const preserved = TomlConverter.extractPreserved(cargoToml);
    const joined = preserved.join('\n');
    expect(joined).toContain('name = "my-service"');
    expect(joined).toContain('version = "0.1.0"');
    expect(joined).toContain('opt-level = 3');
  });

  it('drops long prose description', () => {
    const preserved = TomlConverter.extractPreserved(cargoToml);
    const joined = preserved.join('\n');
    expect(joined).not.toContain('microservice architectures');
  });
});

describe('TomlConverter.extractCompressible', () => {
  it('extracts long prose string values', () => {
    const compressible = TomlConverter.extractCompressible(cargoToml);
    expect(compressible.length).toBeGreaterThan(0);
    expect(compressible.some((c) => c.includes('microservice architectures'))).toBe(true);
  });

  it('does not include short atomic values', () => {
    const compressible = TomlConverter.extractCompressible(cargoToml);
    expect(compressible.every((c) => !c.includes('0.1.0'))).toBe(true);
  });

  it('returns empty for all-atomic TOML', () => {
    expect(TomlConverter.extractCompressible(allAtomicToml)).toHaveLength(0);
  });
});

describe('TomlConverter.reconstruct', () => {
  it('appends summary as TOML comment', () => {
    const preserved = TomlConverter.extractPreserved(cargoToml);
    const result = TomlConverter.reconstruct(preserved, 'HTTP auth service for Kubernetes');
    expect(result).toContain('# HTTP auth service for Kubernetes');
  });

  it('omits comment when summary is empty', () => {
    const result = TomlConverter.reconstruct(['[package]', 'name = "foo"'], '');
    expect(result).not.toContain('#');
  });
});

describe('TomlConverter end-to-end', () => {
  it('produces shorter output than input', () => {
    const preserved = TomlConverter.extractPreserved(cargoToml);
    const compressible = TomlConverter.extractCompressible(cargoToml);
    const summary = compressible.join(' ').slice(0, 60);
    const output = TomlConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(cargoToml.length);
  });
});
