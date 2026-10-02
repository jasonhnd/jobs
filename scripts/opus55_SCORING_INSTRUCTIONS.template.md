# In-agent AIOIS-10 scoring (Claude Opus 5.5)

You ARE claude-opus-5-5. Score the assigned occupation IDs. Do not explore the repo. Do not use todo lists. Do not read `data/scores/` or `sample.json` or other answer chunks. Do not spawn sub-agents.

Do not use tool-call / structured-output features; write the JSONL file as plain text.

## Input

For each id, read ONLY:
`__RUN_DIR__/prompts/<id padded to 4 digits>.txt`

Judge from that extract plus general knowledge of the Japanese labour market. Current generative AI capability as of 2026, not five years out. High transformation ≠ the job disappears.

## Output contract

One JSON object per occupation, one line. Fields ONLY:

```
{"id": <int>, "ai_risk": <num>, "rationale_ja": "<日本語1文>", "confidence": <0-1>, "aiois": {"d1": <n>, "d2": <n>, "d3": <n>, "d4": <n>, "d5": <n>, "d6": <n>, "d7": <n>, "d8": <n>, "d9": <n>, "d10": <n>, "transformation": <n>, "displacement": <n>}}
```

- Numbers, not strings. Scores 0–10, at most 1 decimal. `confidence` 0–1.
- `rationale_ja`: one non-empty Japanese sentence consistent with the scores.
- No markdown fences in the file. No extra fields.

## Formulas (you assign D1–D10, then compute)

```
E = (D1+D2)/2
transformation = E rounded to 1 decimal (.X5 rounds up)
M = (D3+D4+D5+D6+D7)/5
P = (D8+D9)/2
displacement_raw = clamp(0, 10, E × (1 − M/10) × (0.6 + 0.4 × (P+D10)/20))
displacement = that rounded to 1 decimal (.X5 rounds up)
ai_risk MUST equal transformation exactly
```

D9 is Japan-local: severe labour shortage **lowers** D9 (AI is help, not threat).

You may use a short Python snippet **only** to compute transformation/displacement from the D scores you already chose. Do not invent D scores with a script.

After writing, verify line count, JSON parse, every assigned id present, `ai_risk === transformation`. Return one line: path, n, id range, problems.
