import { describe, it, expect } from 'vitest';
import { DockerfileConverter, detectDockerfile } from '../src/dockerfile.js';

const multiStageDockerfile = `# syntax=docker/dockerfile:1

# Build stage
# This stage compiles the Go application and runs all unit tests to ensure
# the binary is correct before packaging it into the final runtime image.
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /app/server ./cmd/server

# Runtime stage
# The final image is based on distroless to minimize attack surface and
# reduce the overall image size for faster pulls in production deployments.
FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
ENTRYPOINT ["/app/server"]`;

const simpleDockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]`;

const dockerfileWithDirective = `# syntax=docker/dockerfile:1
# escape=\`

FROM ubuntu:22.04
RUN apt-get update
EXPOSE 80`;

describe('detectDockerfile', () => {
  it('detects multi-stage Dockerfile', () => {
    expect(detectDockerfile(multiStageDockerfile)).toBe(true);
  });

  it('detects simple Dockerfile', () => {
    expect(detectDockerfile(simpleDockerfile)).toBe(true);
  });

  it('rejects plain prose', () => {
    expect(detectDockerfile('Just a plain sentence.')).toBe(false);
  });

  it('rejects YAML', () => {
    expect(detectDockerfile('name: app\nversion: 1.0\nport: 8080\nenabled: true\n')).toBe(false);
  });

  it('rejects content with only one instruction', () => {
    expect(detectDockerfile('FROM ubuntu:22.04\n# just a comment')).toBe(false);
  });
});

describe('DockerfileConverter.extractPreserved', () => {
  it('preserves all instruction lines', () => {
    const preserved = DockerfileConverter.extractPreserved(simpleDockerfile);
    const joined = preserved.join('\n');
    expect(joined).toContain('FROM node:20-alpine');
    expect(joined).toContain('WORKDIR /app');
    expect(joined).toContain('RUN npm ci --only=production');
    expect(joined).toContain('EXPOSE 3000');
    expect(joined).toContain('CMD ["node", "dist/index.js"]');
  });

  it('drops prose comment blocks', () => {
    const preserved = DockerfileConverter.extractPreserved(multiStageDockerfile);
    const joined = preserved.join('\n');
    expect(joined).not.toContain('minimize attack surface');
    expect(joined).not.toContain('compiles the Go application');
  });

  it('preserves parser directives', () => {
    const preserved = DockerfileConverter.extractPreserved(dockerfileWithDirective);
    const joined = preserved.join('\n');
    expect(joined).toContain('# syntax=docker/dockerfile:1');
    expect(joined).toContain('# escape=');
  });

  it('preserves standalone short comments (not followed by prose)', () => {
    const content = `FROM node:20-alpine\n# Install deps\nRUN npm ci\n# Start server\nCMD ["node", "index.js"]`;
    const preserved = DockerfileConverter.extractPreserved(content);
    const joined = preserved.join('\n');
    expect(joined).toContain('# Install deps');
    expect(joined).toContain('# Start server');
  });
});

describe('DockerfileConverter.extractCompressible', () => {
  it('extracts prose comment blocks', () => {
    const compressible = DockerfileConverter.extractCompressible(multiStageDockerfile);
    expect(compressible.length).toBeGreaterThan(0);
    expect(compressible.some((c) => c.includes('minimize attack surface'))).toBe(true);
  });

  it('returns empty for Dockerfile with no prose comments', () => {
    expect(DockerfileConverter.extractCompressible(simpleDockerfile)).toHaveLength(0);
  });

  it('does not include parser directives', () => {
    const compressible = DockerfileConverter.extractCompressible(dockerfileWithDirective);
    expect(compressible.every((c) => !c.includes('syntax='))).toBe(true);
  });
});

describe('DockerfileConverter.reconstruct', () => {
  it('appends summary as comment', () => {
    const preserved = DockerfileConverter.extractPreserved(multiStageDockerfile);
    const result = DockerfileConverter.reconstruct(preserved, 'Go build + distroless runtime');
    expect(result).toContain('# Go build + distroless runtime');
    expect(result).toContain('FROM golang:1.22-alpine AS builder');
  });

  it('omits comment when summary is empty', () => {
    const preserved = DockerfileConverter.extractPreserved(simpleDockerfile);
    const result = DockerfileConverter.reconstruct(preserved, '');
    // Should not add an empty comment
    const lines = result.split('\n').filter((l) => l.trim().startsWith('#'));
    expect(lines.every((l) => l.trim() !== '#')).toBe(true);
  });
});

describe('DockerfileConverter end-to-end', () => {
  it('produces shorter output than input for Dockerfile with prose comments', () => {
    const preserved = DockerfileConverter.extractPreserved(multiStageDockerfile);
    const compressible = DockerfileConverter.extractCompressible(multiStageDockerfile);
    const summary = compressible.join(' ').slice(0, 60);
    const output = DockerfileConverter.reconstruct(preserved, summary);
    expect(output.length).toBeLessThan(multiStageDockerfile.length);
  });
});
