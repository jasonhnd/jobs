/**
 * providers/in-agent.ts — scoring performed by the agent session itself.
 *
 * This is how every prior Claude batch was produced (claude-opus-4-8,
 * claude-fable-5): no API key, no child process — the running model reads the
 * frozen rubric plus the occupation extract and writes the answers back.
 *
 * What this provider adds over free-hand JSONL is that in-agent scoring now
 * goes through the *same* contract validation, retry accounting, audit trail,
 * and resume logic as every other provider, and emits a byte-identical output
 * line. A hand-written score cannot bypass the formula checks.
 *
 * Two-pass flow:
 *
 *   1. Run once. Every pending occupation gets its exact prompt written to
 *      `<runDir>/prompts/<id>.txt` and is reported as pending.
 *   2. Write answers as JSON Lines into `<runDir>/answers/*.jsonl` — one object
 *      per line, same shape as the final output. Chunked files keep this to a
 *      handful of writes for a 556-occupation run.
 *   3. Re-run with `--resume`. Answers are validated and appended to the output.
 *
 * No native schema mechanism exists here, so the contract is requested in
 * prose and enforced entirely by validation — which is the safety floor for
 * every provider anyway.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AskOptions, PrepareRunContext, ProviderResponse, RunPreparation, ScoringProvider } from '../provider.js';
import type { ScoringErrorKind } from '../errors.js';

/** Marker the runner maps to the `missing_answer` kind (no retry, reported as pending). */
export const AWAITING_ANSWER_MARKER = 'AWAITING_IN_AGENT_ANSWER';

export const promptsDir = (runDir: string): string => join(runDir, 'prompts');
export const answersDir = (runDir: string): string => join(runDir, 'answers');

const pad = (id: number): string => String(id).padStart(4, '0');

/**
 * Answers for the current run, keyed by occupation id.
 *
 * Module-scoped because a provider is a singleton and each CLI invocation is a
 * fresh process; `prepareRun` clears it so a single process never mixes runs.
 */
const answerCache = new Map<number, string>();

/** Parse every `*.jsonl` under `answers/`, last definition of an id winning. */
export function loadAnswers(dir: string): Map<number, string> {
  const answers = new Map<number, string>();
  if (!existsSync(dir)) return answers;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
    const text = readFileSync(join(dir, file), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let id: unknown;
      try {
        id = (JSON.parse(trimmed) as { id?: unknown }).id;
      } catch {
        // Keep unparseable lines out of the map; the runner reports them as
        // missing so the offending id is visible rather than silently skipped.
        continue;
      }
      if (typeof id === 'number' && Number.isInteger(id)) answers.set(id, trimmed);
    }
  }
  return answers;
}

export const inAgentProvider: ScoringProvider = {
  name: 'in-agent',
  description: 'Scored by the agent session itself; answers supplied as JSONL (no API key, no child process).',
  supportsNativeSchema: false,
  // Answers are local file reads; serial keeps run logs in id order.
  maxConcurrency: 1,
  // Re-reading the same answer file yields the same answer, so a retry can
  // only produce the same failure. One attempt keeps the reported count honest.
  deterministic: true,

  preflight(): void {
    // Nothing external to probe. The operator asserts the model identity via
    // --model, and it is recorded in the run's provider-preflight.json.
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    mkdirSync(promptsDir(ctx.runDir), { recursive: true });
    mkdirSync(answersDir(ctx.runDir), { recursive: true });
    answerCache.clear();
    for (const [id, line] of loadAnswers(answersDir(ctx.runDir))) answerCache.set(id, line);
    return {
      audit: {
        scored_by: 'agent-session',
        declared_model: ctx.model,
        prompts_dir: promptsDir(ctx.runDir),
        answers_dir: answersDir(ctx.runDir),
        answers_loaded: answerCache.size,
      },
    };
  },

  async ask(prompt: string, options: AskOptions): Promise<ProviderResponse> {
    const id = options.occId;
    const runDir = options.runDir;
    if (id === undefined || runDir === undefined) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'in-agent provider requires occId and runDir from the runner',
        rawText: '',
      };
    }

    // Always (re)write the prompt so the operator answers against the exact
    // rubric + extract that this run would have sent to any other provider.
    const promptPath = join(promptsDir(runDir), `${pad(id)}.txt`);
    mkdirSync(promptsDir(runDir), { recursive: true });
    writeFileSync(promptPath, prompt);

    const answer = answerCache.get(id);
    if (answer === undefined) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `${AWAITING_ANSWER_MARKER} id=${id} — prompt written to ${promptPath}; add a line to ${answersDir(runDir)}/*.jsonl`,
        rawText: '',
      };
    }
    return { exitCode: 0, stdout: '', stderr: '', rawText: answer };
  },

  classifyError(text: string): ScoringErrorKind | null {
    return text.includes(AWAITING_ANSWER_MARKER) ? 'missing_answer' : null;
  },
};
