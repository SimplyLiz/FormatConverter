/**
 * Dockerfile format converter.
 *
 * Preserves all instruction lines (FROM, RUN, COPY, ADD, ENV, EXPOSE, CMD,
 * ENTRYPOINT, WORKDIR, ARG, LABEL, USER, VOLUME, HEALTHCHECK, SHELL).
 * Compresses multi-line prose comment blocks.
 *
 * Handles: single-stage builds, multi-stage builds, Docker Compose-adjacent
 * Dockerfiles, CI/CD build definitions.
 */

import { looksLikeProse } from './shared.js';
import type { FormatConverter } from './types.js';

const DOCKERFILE_INSTRUCTION_RE =
  /^(FROM|RUN|COPY|ADD|ENV|EXPOSE|CMD|ENTRYPOINT|WORKDIR|ARG|LABEL|USER|VOLUME|HEALTHCHECK|ONBUILD|STOPSIGNAL|SHELL)\b/i;

/** Returns true if the content looks like a Dockerfile. */
export function detectDockerfile(content: string): boolean {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 3) return false;
  const instructionLines = lines.filter((l) => DOCKERFILE_INSTRUCTION_RE.test(l.trim()));
  return instructionLines.length >= 2;
}

/** Collect consecutive comment lines and return prose blocks. */
function collectCommentBlocks(content: string): string[] {
  const out: string[] = [];
  let block: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      // Skip parser directives (# syntax=, # escape=)
      const text = trimmed.slice(1).trim();
      if (!/^(?:syntax|escape|check)\s*=/i.test(text)) {
        block.push(text);
      }
    } else {
      if (block.length > 0) {
        const joined = block.join(' ');
        if (looksLikeProse(joined)) out.push(joined);
        block = [];
      }
    }
  }
  if (block.length > 0) {
    const joined = block.join(' ');
    if (looksLikeProse(joined)) out.push(joined);
  }
  return out;
}

/** Split content into segments: each segment is either a comment block or an instruction line. */
function parseSegments(content: string): Array<{ type: 'comment_block'; lines: string[]; text: string } | { type: 'other'; line: string }> {
  const segments: Array<{ type: 'comment_block'; lines: string[]; text: string } | { type: 'other'; line: string }> = [];
  let commentBlock: string[] = [];

  const flushBlock = () => {
    if (commentBlock.length > 0) {
      const text = commentBlock
        .map((l) => l.trim().slice(1).trim())
        .filter((t) => !/^(?:syntax|escape|check)\s*=/i.test(t))
        .join(' ');
      segments.push({ type: 'comment_block', lines: [...commentBlock], text });
      commentBlock = [];
    }
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      commentBlock.push(line);
    } else {
      flushBlock();
      segments.push({ type: 'other', line });
    }
  }
  flushBlock();
  return segments;
}

/**
 * Dockerfile FormatConverter — preserves all instruction lines, compresses
 * prose comment blocks.
 */
export const DockerfileConverter: FormatConverter = {
  name: 'dockerfile',

  detect: detectDockerfile,

  extractPreserved(content: string): string[] {
    const out: string[] = [];
    for (const seg of parseSegments(content)) {
      if (seg.type === 'comment_block') {
        // Keep parser directives and non-prose comment blocks
        const isDirective = seg.lines.some((l) =>
          /^(?:syntax|escape|check)\s*=/i.test(l.trim().slice(1).trim()),
        );
        if (isDirective || !looksLikeProse(seg.text)) {
          out.push(...seg.lines);
        }
      } else {
        out.push(seg.line);
      }
    }
    return out;
  },

  extractCompressible: collectCommentBlocks,

  reconstruct(preserved: string[], summary: string): string {
    const parts = [...preserved];
    if (summary) parts.push(`# ${summary}`);
    return parts.join('\n');
  },
};
