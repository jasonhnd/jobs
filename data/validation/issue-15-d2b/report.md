# Issue 15 D2-B cross-model validation

## Summary

Representative 40 occupations from the issue-9 deterministic pilot sample were compared on the AIOIS-10 Transformation headline score. Claude Fable 5 uses the canonical 2026-06-13 production batch; Claude Opus 4.8 and Claude Sonnet 4.6 were blind-scored in Claude Code with the same `data/prompts/2026-06-13_claude-fable-5-aiois10.ja.md` rubric.

## Results

- Inter-model Pearson r: Fable-Opus 0.970, Fable-Sonnet 0.951, Opus-Sonnet 0.924.
- Three-model spread: mean 1.02, median 1.0, max 2.3.
- Agreement bands: spread <= 1.0 for 26/40 occupations; spread <= 2.0 for 38/40 occupations (95%); spread > 2.0 for 2/40.
- Mean absolute difference vs Fable: Opus 0.57, Sonnet 0.61.
- Systematic bias vs Fable: Opus -0.47, Sonnet +0.23, placing Fable near the center of the two blind raters.

## Largest disagreements

- id=111 観光バスガイド: Fable 4.3, Opus 3.0, Sonnet 5.3; spread 2.3.
- id=424 速記者: Fable 8.3, Opus 7.0, Sonnet 9.3; spread 2.3.

## Publication boundary

This is an external-consistency validation sample, not a full 556-occupation multi-model consensus. The canonical production scores remain Claude Fable 5 at 2026-06-13, and no occupation page or ranking score should change from this archive.
