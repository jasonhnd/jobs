#!/usr/bin/env node
'use strict';
/**
 * walk-files.cjs — one directory walker for the build-gate scanners.
 *
 * check-nested-html-comments, check-rendered-leaks, and compute-csp-hashes
 * used to each carry a copy. A stat failure in those copies was swallowed,
 * so a missing entry disappeared from the scan. This helper throws instead.
 *
 * statSync (not Dirent.isDirectory) because this working tree can present
 * directory entries as symlinks. statSync follows the link.
 *
 * Options:
 *   ext         RegExp tested against the entry basename (not the full path).
 *               Must not rely on lastIndex; the helper resets it.
 *   skip        Set of basenames to ignore before stat, at every level.
 *   skipHidden  When true, basenames starting with "." are ignored before
 *               stat. Only the nested-comment scan uses this.
 *
 * Returns absolute paths, depth-first, in readdir order.
 */
const fs = require('node:fs');
const path = require('node:path');

function walkError(action, target, err) {
  const code = err && err.code ? ` (${err.code})` : '';
  const detail = err && err.message ? `: ${err.message}` : '';
  const wrapped = new Error(`walk-files: ${action} ${target}${code}${detail}`);
  if (err && err.code) wrapped.code = err.code;
  wrapped.cause = err;
  return wrapped;
}

function walkFiles(dir, options = {}) {
  const { ext, skip = null, skipHidden = false } = options;
  if (!(ext instanceof RegExp)) {
    throw new Error('walk-files: ext must be a RegExp tested against each entry name');
  }

  const out = [];
  visit(dir);
  return out;

  function visit(current) {
    let names;
    try {
      names = fs.readdirSync(current);
    } catch (err) {
      throw walkError('cannot read directory', current, err);
    }
    for (const name of names) {
      if (skipHidden && name.startsWith('.')) continue;
      if (skip && skip.has(name)) continue;
      const full = path.join(current, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch (err) {
        throw walkError('cannot stat', full, err);
      }
      if (stat.isDirectory()) {
        visit(full);
      } else if (stat.isFile()) {
        ext.lastIndex = 0;
        if (ext.test(name)) out.push(full);
      }
    }
  }
}

module.exports = { walkFiles };
