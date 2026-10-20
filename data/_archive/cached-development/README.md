# Historical development source artifacts

Source: cached mms-11/mms-12 development files from September 2026, preserved for Issue #924; original files were read without modification.

| File | Source relative to the original cache | Purpose |
| --- | --- | --- |
| `prompt_claude-opus-5-5.template.ja.md` | `handoff/2026-09-23-mms-11-12/prompt_claude-opus-5-5.template.ja.md` | Parameterized source of the frozen Claude Opus 5.5 scoring prompt. |
| `prompt_gpt-6-sol.template.ja.md` | `handoff/2026-09-23-mms-11-12/prompt_gpt-6-sol.template.ja.md` | Parameterized source of the frozen GPT 6 SOL scoring prompt. |
| `mms-11-issue-numbers.tsv` | `mms-11-issues/numbers.tsv` | Original mms-11 step, Issue number and title mapping. |

These are historical source artifacts, not current task instructions or new scoring runs. The templates retain `__ISSUE__`; substituting `607` and `615`, respectively, reproduces the frozen prompts in `data/prompts/`. The site and ETL do not read this directory. Source content passed the sensitive-pattern scan without requiring substitutions.
