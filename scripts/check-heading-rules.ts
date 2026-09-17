#!/usr/bin/env bun
/**
 * check-heading-rules.ts — Design.md §19.1 gate for §4.9.
 *
 * Page CSS may not set a heading's size, typeface or weight. The heading
 * branch lives in canonical-css.ts; that is what keeps page titles at two
 * values site-wide (§4.8) and what made dropping the `!important` safe
 * (design-1.9).
 *
 * The rule was enforced by hand-greps during the migration and by nothing
 * afterwards, so it drifted back: 48 rules existed when this gate was written.
 */
import { findHeadingRuleViolations } from '../src/lib/design-gates/heading-rules.js';

const v = findHeadingRuleViolations();
const fail = v.filter((x) => x.state === 'conformant');
const warn = v.filter((x) => x.state === 'migrating');

for (const x of warn) {
  console.warn(
    `[check-heading-rules] warn ${x.file}:${x.line} ${x.selector} { ${x.declarations.join('; ')} }`,
  );
}
if (fail.length > 0) {
  console.error('[check-heading-rules] FAIL — page CSS sets heading type (Design.md §4.9):');
  for (const x of fail) {
    console.error(`  ${x.file}:${x.line}  ${x.selector} { ${x.declarations.join('; ')} }`);
  }
  console.error('\n  Delete the rule. canonical-css.ts owns h1–h4; a page that genuinely');
  console.error('  needs a different title size uses the Feature class (§4.8), not its own CSS.');
  process.exit(1);
}
console.log(
  `[check-heading-rules] OK — no conformant surface sets heading type (${warn.length} warning(s))`,
);
