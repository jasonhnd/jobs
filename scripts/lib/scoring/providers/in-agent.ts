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

/**
 * Read `agent-<id>.jsonl` transcripts and report the model(s) each one used.
 *
 * Deliberately per-agent rather than a single flat set: a session directory
 * normally contains unrelated agents that ran on other models, so a
 * directory-wide check would fail on work that has nothing to do with scoring.
 */
export function collectSubagentModels(dir: string, agentIds?: readonly string[]): Map<string, Set<string>> {
  const byAgent = new Map<string, Set<string>>();
  if (!existsSync(dir)) return byAgent;
  const wanted = agentIds ? new Set(agentIds) : null;
  for (const file of readdirSync(dir).filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl')).sort()) {
    const agentId = file.slice('agent-'.length, -'.jsonl'.length);
    if (wanted && !wanted.has(agentId)) continue;
    const models = new Set<string>();
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const model = (JSON.parse(line) as { message?: { model?: unknown } }).message?.model;
        if (typeof model === 'string' && model && model !== '<synthetic>') models.add(model);
      } catch {
        // Transcript lines we cannot parse carry no model claim; skip them.
      }
    }
    if (models.size) byAgent.set(agentId, models);
  }
  return byAgent;
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

  /**
   * The one thing this provider genuinely cannot observe is WHICH model wrote
   * the answers — there is no subprocess to probe, unlike codex's
   * `--model` capability check. Leaving that unchecked would let a batch be
   * labelled `claude-opus-5` while something else actually scored it: exactly
   * the silent-substitution failure the runbook forbids.
   *
   * So the gap is made explicit and auditable instead of silent:
   *   --attest-model <id>            required; must equal --model
   *   --verify-subagents <dir>       optional; mechanically checks transcripts
   *   --verify-agent-ids <csv>       narrows the check to specific agents
   *
   * A session's transcript directory usually also holds unrelated agents that
   * legitimately ran on other models, so prefer the id-scoped form when
   * verifying a specific scoring wave.
   */
  preflight(ctx: PrepareRunContext): void {
    const attested = ctx.options['attest-model'];
    if (!attested || attested === 'true') {
      throw new Error(
        'in-agent provider cannot detect which model produced the answers. ' +
          `Pass --attest-model ${ctx.model} to record that you verified the scorer, ` +
          'and optionally --verify-subagents <dir> [--verify-agent-ids a,b,c] to check it mechanically.',
      );
    }
    if (attested !== ctx.model) {
      throw new Error(`--attest-model "${attested}" does not match --model "${ctx.model}"`);
    }

    const dir = ctx.options['verify-subagents'];
    if (!dir || dir === 'true') return;
    const ids = ctx.options['verify-agent-ids']
      ? ctx.options['verify-agent-ids'].split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const byAgent = collectSubagentModels(dir, ids);
    if (byAgent.size === 0) {
      throw new Error(`--verify-subagents ${dir}: no agent transcripts found${ids ? ` for ids ${ids.join(', ')}` : ''}`);
    }
    const offenders: string[] = [];
    for (const [agentId, models] of byAgent) {
      const foreign = [...models].filter((m) => m !== ctx.model);
      if (foreign.length) offenders.push(`${agentId} → ${foreign.join(', ')}`);
    }
    if (offenders.length) {
      throw new Error(
        `--verify-subagents: ${offenders.length} agent transcript(s) name a model other than "${ctx.model}": ` +
          `${offenders.slice(0, 5).join('; ')}${offenders.length > 5 ? ' …' : ''}`,
      );
    }
  },

  prepareRun(ctx: PrepareRunContext): RunPreparation {
    mkdirSync(promptsDir(ctx.runDir), { recursive: true });
    mkdirSync(answersDir(ctx.runDir), { recursive: true });
    answerCache.clear();
    for (const [id, line] of loadAnswers(answersDir(ctx.runDir))) answerCache.set(id, line);
    const verifyDir = ctx.options['verify-subagents'];
    const verifyIds = ctx.options['verify-agent-ids'];
    return {
      audit: {
        scored_by: 'agent-session',
        declared_model: ctx.model,
        // Provenance for the one property this provider cannot self-verify.
        attested_model: ctx.options['attest-model'] ?? null,
        subagent_verification:
          verifyDir && verifyDir !== 'true'
            ? {
                transcript_dir: verifyDir,
                agent_ids: verifyIds ? verifyIds.split(',').map((s) => s.trim()).filter(Boolean) : 'all',
                verified_agents: [...collectSubagentModels(verifyDir, verifyIds ? verifyIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined).keys()],
              }
            : null,
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
