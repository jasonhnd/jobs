#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, posix } = require('node:path');

function maskHtmlComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

// Lines with code masked out, plus the line of a fence that never closes.
// CommonMark lets an unclosed fence run to the end of the document, which
// silently exempted every later link from this gate; the caller reports it.
function scanMarkdown(markdown) {
  const lines = maskHtmlComments(markdown).split(/\r?\n/);
  let fence = null;

  const scanned = lines.map((line, index) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      // A closing fence carries no info string (CommonMark §4.5).
      if (
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.length &&
        marker[2].trim() === ''
      ) {
        fence = null;
      }
      return '';
    }
    if (marker) {
      fence = { char: marker[1][0], length: marker[1].length, line: index + 1 };
      return '';
    }
    return line.replace(/(`+)(.*?)\1/g, (inline) => ' '.repeat(inline.length));
  });

  return { lines: scanned, unclosedFenceLine: fence ? fence.line : null };
}

function extractMarkdownTargets(markdown) {
  const targets = [];
  const { lines } = scanMarkdown(markdown);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inlinePattern = /\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g;
    const definitionPattern = /^\s{0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))/;
    const htmlAttributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
    let match;

    while ((match = inlinePattern.exec(line)) !== null) {
      targets.push({ target: match[1] || match[2], line: index + 1, column: match.index + 1 });
    }
    const definition = line.match(definitionPattern);
    if (definition) {
      targets.push({ target: definition[1] || definition[2], line: index + 1, column: definition.index + 1 });
    }
    while ((match = htmlAttributePattern.exec(line)) !== null) {
      targets.push({ target: match[1], line: index + 1, column: match.index + 1 });
    }
  }

  return targets;
}

// `rootEntries` holds the tracked top-level names (`docs`, `README.md`, …).
// GitHub resolves `/docs/x.md` against the repository root, so a `/` link
// whose first segment is one of them is a repository path; any other `/…`
// link (`/standard`, `/data.treemap.json`) is a site route and is skipped.
function localTargetPath(sourcePath, rawTarget, rootEntries = new Set()) {
  const target = rawTarget.trim();
  if (
    target.length === 0 ||
    target.startsWith('#') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return null;
  }
  const isRootLink = target.startsWith('/');
  if (isRootLink) {
    const firstSegment = target.slice(1).split(/[/?#]/, 1)[0];
    let decodedSegment = firstSegment;
    try {
      decodedSegment = decodeURIComponent(firstSegment);
    } catch {
      // fall through: an undecodable segment cannot name a tracked entry
    }
    if (!rootEntries.has(decodedSegment)) return null;
  }

  const withoutFragment = target.split(/[?#]/, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(withoutFragment).replace(/\\([\\ ()])/g, '$1');
  } catch {
    return { error: `invalid URL encoding in ${JSON.stringify(rawTarget)}` };
  }

  const resolved = isRootLink
    ? posix.normalize(decoded.slice(1))
    : posix.normalize(posix.join(posix.dirname(sourcePath), decoded));
  if (resolved === '..' || resolved.startsWith('../') || posix.isAbsolute(resolved)) {
    return { error: `target escapes the repository: ${JSON.stringify(rawTarget)}` };
  }
  return { path: resolved.replace(/^\.\//, '').replace(/\/+$/, '') || '.' };
}

function trackedDirectories(trackedPaths) {
  const directories = new Set(['.']);
  for (const file of trackedPaths) {
    let directory = posix.dirname(file);
    while (directory !== '.') {
      directories.add(directory);
      directory = posix.dirname(directory);
    }
  }
  return directories;
}

function checkDocuments(documents, trackedPaths) {
  const tracked = new Set(trackedPaths.map((file) => posix.normalize(file)));
  const directories = trackedDirectories(tracked);
  const rootEntries = new Set([...tracked].map((file) => file.split('/', 1)[0]));
  const problems = [];
  let localTargetCount = 0;

  for (const [sourcePath, markdown] of [...documents.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const { unclosedFenceLine } = scanMarkdown(markdown);
    if (unclosedFenceLine !== null) {
      problems.push(
        `${sourcePath}:${unclosedFenceLine}:1: unclosed code fence — every link after it would go unchecked`,
      );
    }
    for (const reference of extractMarkdownTargets(markdown)) {
      const local = localTargetPath(sourcePath, reference.target, rootEntries);
      if (local === null) continue;
      localTargetCount += 1;
      if (local.error) {
        problems.push(`${sourcePath}:${reference.line}:${reference.column}: ${local.error}`);
        continue;
      }
      if (!tracked.has(local.path) && !directories.has(local.path)) {
        problems.push(
          `${sourcePath}:${reference.line}:${reference.column}: missing tracked local target ` +
          `${JSON.stringify(reference.target)} (resolved to ${local.path})`,
        );
      }
    }
  }

  return { problems, localTargetCount };
}

function trackedFiles(repoRoot) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((file) => file.replace(/\\/g, '/'));
}

function run(repoRoot = process.cwd()) {
  const files = trackedFiles(repoRoot);
  const markdownPaths = files.filter((file) => file.toLowerCase().endsWith('.md'));
  const documents = new Map(
    markdownPaths.map((file) => [file, readFileSync(join(repoRoot, file), 'utf8')]),
  );
  const result = checkDocuments(documents, files);

  if (result.problems.length > 0) {
    console.error(`[check-doc-links] FAIL — ${result.problems.length} broken local Markdown target(s)`);
    for (const problem of result.problems) console.error(`  ${problem}`);
    return 1;
  }

  console.log(
    `[check-doc-links] OK — ${markdownPaths.length} tracked Markdown files, ` +
    `${result.localTargetCount} local link/image target(s)`,
  );
  return 0;
}

if (require.main === module) process.exitCode = run();

module.exports = {
  checkDocuments,
  extractMarkdownTargets,
  localTargetPath,
  run,
};
