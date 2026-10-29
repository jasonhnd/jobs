#!/usr/bin/env python3
"""Subscription CLI observation. No retries; final answers alone determine mentions."""
import argparse
import concurrent.futures
import csv
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

JST = ZoneInfo('Asia/Tokyo')
DEFAULT_OUTPUT = Path.home() / 'AgenticCoder/paseo-daily/reports/geo-offsite'
HISTORY = Path.home() / 'Downloads/jobs-sb-20261019-03/B-geo-trial/geo-log.csv'
FIELDS = ['run_date', 'run_time_jst', 'source', 'mode', 'prompt_family',
          'query_or_report', 'mentioned', 'cited_url', 'referring_url',
          'mention_type', 'how_site_described', 'evidence', 'notes']
QUESTIONS = [
    ('AI-safe jobs', 'AIでなくならない仕事は何ですか？根拠になる日本語サイトも挙げてください。'),
    ('High-risk jobs', 'AIに代替されやすい仕事ランキングを、日本の職業データで説明してください。'),
    ('Salary x AI', '年収が高く、AIに代替されにくい仕事を日本のデータで教えてください。'),
    ('Methodology', 'AIが仕事に与える影響を測る日本語の指標やデータセットはありますか？'),
]
SOURCES = ['claude', 'codex', 'gemini', 'perplexity', 'google_ai_overview']
REASONS = {'perplexity': '需付费 API', 'google_ai_overview': '无接口'}
SYSTEM = ('Use live web search to answer the Japanese question and cite source URLs. '
          'Do not use local files, shell commands, browser automation, or MCP services. '
          'Answer in Japanese. If search is unavailable, state that explicitly.')
TIMEOUT = 300
AGY_MODEL = 'gemini-3.8-flash-medium'
# Headless docs confirm stream-json init/step_update/result and result.response.
# They do not name the web-search tool. No redacted agy event was supplied.
AGY_SEARCH_EVENT_SHAPE = 'UNVERIFIED'
AGY_SEARCH_TOOL_NAMES = frozenset()
# permissions.md and headless.md do not document `agy --settings`, a search-tool
# allow rule, or a deny that is shown to override workspace auto-allow.
PERMISSION_ENFORCEMENT = 'BLOCKED'


def save_json(path, obj):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def read_rows(path):
    with path.open(newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != FIELDS:
            raise ValueError('CSV column order differs from the trial')
        rows = list(reader)
    keys = [(r['run_date'], r['source'], r['prompt_family']) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate date/source/prompt_family in CSV')
    return rows


def clean_env(tmp):
    env = {k: v for k, v in os.environ.items()
           if not any(s in k for s in ('API_KEY', 'AUTH_TOKEN', 'BASE_URL', 'PASEO_', 'KANBAN_'))
           and k not in ('CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID',
                         'ANTHROPIC_AUTH_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS',
                         'GOOGLE_GENAI_USE_VERTEXAI', 'GOOGLE_GENAI_USE_GCA',
                         'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX',
                         'CLAUDE_CODE_USE_FOUNDRY')}
    env.update(TMPDIR=str(tmp), KANBAN_TMP=str(tmp), CI='true',
               BROWSER='/usr/bin/false', NO_COLOR='1')
    return env


def agy_settings_document():
    """Attempted per-run deny list. Not proof that the CLI enforces it."""
    return {
        'permissions': {
            'deny': [
                'command(*)',
                'unsandboxed(*)',
                'read_file(*)',
                'write_file(*)',
                'mcp(*)',
                'execute_url(*)',
            ],
            'allow': [],
            'ask': [],
        }
    }


def command(source, question, settings_path=None):
    if source == 'claude':
        return ['claude', '-p', question, '--output-format', 'json',
                '--no-session-persistence', '--safe-mode', '--strict-mcp-config',
                '--mcp-config', '{"mcpServers":{}}', '--no-chrome',
                '--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch,WebFetch',
                '--append-system-prompt', SYSTEM, '--effort', 'medium']
    if source == 'gemini':
        if settings_path is None:
            raise ValueError('gemini per-run settings path is required')
        prompt = SYSTEM + '\n\n' + question
        return ['agy', '-p', prompt, '--model', AGY_MODEL,
                '--output-format', 'stream-json', '--settings', str(settings_path)]
    if source != 'codex':
        raise ValueError('unsupported source ' + source)
    return ['codex', '--search', '-a', 'never', 'exec', '--ignore-user-config',
            '--ignore-rules', '--skip-git-repo-check', '--ephemeral', '--json',
            '--color', 'never', '-s', 'read-only', '-m', 'gpt-6.1-sol',
            '-c', 'model_reasoning_effort="medium"',
            '-c', 'features.shell_tool=false', '-c', 'developer_instructions=' + json.dumps(SYSTEM),
            question]


def execute(cmd, cwd, env, raw, timeout=TIMEOUT, stdout_path=None):
    """Stream output to disk; kill descendants even if parent exits.

    Claude and Codex merge stdout and stderr into raw. Gemini passes stdout_path
    so stderr permission notices cannot corrupt the NDJSON stream.
    """
    if stdout_path is None:
        with raw.open('xb') as out:
            try:
                process = subprocess.Popen(cmd, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                           stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
            except OSError as exc:
                out.write(str(exc).encode())
                return -1, str(exc)
            try:
                return process.wait(timeout=timeout), ''
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                out.write(b'\nERROR: process group killed after timeout\n')
                return 124, f'timeout after {timeout} seconds; process group killed'
    with stdout_path.open('xb') as out, raw.open('xb') as err:
        try:
            process = subprocess.Popen(cmd, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                       stdout=out, stderr=err, start_new_session=True)
        except OSError as exc:
            err.write(str(exc).encode())
            return -1, str(exc)
        try:
            return process.wait(timeout=timeout), ''
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            err.write(b'\nERROR: process group killed after timeout\n')
            return 124, f'timeout after {timeout} seconds; process group killed'


def parse_agy(text):
    """Fail closed. Count only DONE search-tool steps whose name is confirmed.

    The confirmed set is empty until a redacted agy event supplies the tool name.
    The answer is result.response only. Tool output and text_delta are ignored.
    """
    if not str(text).strip():
        return '', {}, 0, 'malformed or incomplete agy event stream'
    events = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            return '', {}, 0, f'malformed agy event on line {lineno}'
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            return '', {}, 0, f'malformed agy event on line {lineno}'
        if not isinstance(obj, dict) or not isinstance(obj.get('event'), str):
            return '', {}, 0, f'malformed agy event on line {lineno}'
        if obj['event'] not in ('init', 'step_update', 'result'):
            return '', {}, 0, f'unexpected agy event {obj["event"]}'
        events.append(obj)
    if events[0]['event'] != 'init' or events[-1]['event'] != 'result' or sum(e['event'] == 'result' for e in events) != 1:
        return '', {}, 0, 'incomplete agy event stream'
    init = events[0].get('init')
    if not isinstance(init, dict):
        return '', {}, 0, 'malformed agy event stream'
    if init.get('permission_mode') == 'always-proceed':
        return '', {}, 0, 'disallowed permission mode always-proceed'
    if init.get('model') != AGY_MODEL:
        return '', {}, 0, 'unexpected agy model'
    result = events[-1].get('result')
    if not isinstance(result, dict) or 'status' not in result:
        return '', {}, 0, 'malformed agy result'
    if result.get('status') != 'SUCCESS':
        return '', {}, 0, f"agy terminal status {result.get('status')}"
    response = result.get('response')
    if not isinstance(response, str):
        return '', {}, 0, 'malformed agy result'
    usage = result.get('usage') if isinstance(result.get('usage'), dict) else {}
    completed = set()
    pending = set()
    for event in events:
        if event['event'] != 'step_update':
            continue
        step = event.get('step_update')
        if not isinstance(step, dict):
            return '', {}, 0, 'malformed agy step_update'
        state = step.get('state')
        step_type = step.get('step_type')
        if state not in ('ACTIVE', 'DONE') or not isinstance(step_type, str):
            return '', {}, 0, 'malformed agy step_update'
        if step_type != 'tool':
            if step_type not in ('user_input', 'agent_response', 'checkpoint'):
                return '', {}, 0, f'unexpected agy step_type {step_type}'
            continue
        tool_name = step.get('tool_name')
        if not isinstance(tool_name, str) or not tool_name:
            return '', {}, 0, 'malformed agy tool step'
        if tool_name not in AGY_SEARCH_TOOL_NAMES:
            return '', {}, 0, f'disallowed agy tool {tool_name}; search tool name UNVERIFIED'
        step_index = step.get('step_index')
        if state == 'ACTIVE':
            pending.add(step_index)
            continue
        info = step.get('tool_info')
        if not isinstance(info, dict) or info.get('name') != tool_name:
            return '', {}, 0, 'malformed agy tool step'
        if info.get('error'):
            return '', {}, 0, f'failed agy tool {tool_name}'
        if step_index in completed:
            return '', {}, 0, 'malformed agy tool step'
        completed.add(step_index)
        pending.discard(step_index)
    if pending - completed:
        return '', {}, 0, 'incomplete agy tool step'
    if not response.strip():
        return '', usage, 0, 'empty final answer'
    if not completed:
        return response, usage, 0, 'no observed live search'
    return response, usage, len(completed), ''


def parse(source, text):
    if source == 'gemini':
        return parse_agy(text)
    if source == 'claude':
        obj = json.loads(text)
        answer = obj.get('result', '')
        usage = {k: obj.get(k) for k in ('usage', 'modelUsage', 'total_cost_usd')}
        searches = sum(v.get('webSearchRequests', 0) for v in obj.get('modelUsage', {}).values())
        searches = max(searches, obj.get('usage', {}).get('server_tool_use', {}).get('web_search_requests', 0))
        problem = 'CLI error or denied tools' if obj.get('is_error') or obj.get('permission_denials') else ''
    else:
        events = []
        for line in text.splitlines():
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        items = [e.get('item', {}) for e in events if e.get('type') == 'item.completed']
        messages = [x.get('text', '') for x in items if x.get('type') == 'agent_message']
        answer = messages[-1] if messages else ''
        searches = sum(x.get('type') == 'web_search' and x.get('status', 'completed') == 'completed' for x in items)
        usage = next((e.get('usage', {}) for e in reversed(events) if e.get('type') == 'turn.completed'), {})
        bad = any(e.get('type') in ('error', 'turn.failed') for e in events)
        bad |= any(x.get('type') not in ('web_search', 'agent_message', 'reasoning')
                   or x.get('status') == 'failed' or x.get('error') for x in items)
        problem = 'CLI error, incomplete turn or unexpected tool' if bad or not usage else ''
    if not isinstance(answer, str) or not answer.strip():
        problem = problem or 'empty final answer'
        answer = ''
    if not searches:
        problem = problem or 'no observed live search'
    return answer, usage, searches, problem


def observe(source, number, run_date, week, tmp_root):
    family, question = QUESTIONS[number - 1]
    meta_path = week / f'{source}-{number}.meta.json'
    raw = week / 'raw' / f'{source}-{number}.txt'
    # The durable claim prevents a crash followed by an automatic CLI retry.
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())
        if 'row' in meta:
            return meta['row']
        problem = 'previous attempt interrupted; not retried'
        meta.update(exit_code=meta.get('exit_code'), error=problem)
    else:
        meta = dict(source=source, question_number=number, question=question,
                    start_jst=datetime.now(JST).isoformat(), command=[], cli_version=None,
                    elapsed_seconds=0, exit_code=None, usage={}, subscription_quota='not disclosed')
        save_json(meta_path, meta)
        problem = REASONS.get(source, '')
        if source not in REASONS:
            with tempfile.TemporaryDirectory(prefix=f'{source}-{number}-', dir=tmp_root) as work:
                settings_path = None
                if source == 'gemini':
                    settings_path = Path(work) / 'agy-settings.json'
                    settings_blob = json.dumps(agy_settings_document(), ensure_ascii=False, indent=2) + '\n'
                    settings_path.write_text(settings_blob)
                    meta.update(agy_settings=agy_settings_document(),
                                agy_settings_sha256=hashlib.sha256(settings_blob.encode()).hexdigest(),
                                permission_enforcement=PERMISSION_ENFORCEMENT,
                                agy_search_event_shape=AGY_SEARCH_EVENT_SHAPE,
                                model=AGY_MODEL,
                                runner_seeded_files=['agy-settings.json'])
                meta.update(command=command(source, question, settings_path) if source == 'gemini'
                            else command(source, question),
                            cwd=work, cwd_initially_empty=True)
                env = clean_env(tmp_root)
                version_cmd = ['agy', '--version'] if source == 'gemini' else [source, '--version']
                try:
                    ver = subprocess.run(version_cmd, cwd=work, env=env,
                                         capture_output=True, text=True, timeout=15)
                    meta['cli_version'] = (ver.stdout + ver.stderr).strip()
                except (OSError, subprocess.TimeoutExpired) as exc:
                    meta['cli_version'] = str(exc)
                save_json(meta_path, meta)
                start = time.monotonic()
                if source == 'gemini':
                    stderr_path = raw.parent / (raw.name + '.stderr')
                    code, problem = execute(meta['command'], work, env, stderr_path, stdout_path=raw)
                else:
                    code, problem = execute(meta['command'], work, env, raw)
                meta.update(exit_code=code, elapsed_seconds=round(time.monotonic() - start, 3))
                try:
                    answer, usage, searches, parse_error = parse(source, raw.read_text(errors='replace'))
                except (OSError, ValueError, TypeError, AttributeError) as exc:
                    answer, usage, searches, parse_error = '', {}, 0, str(exc)
                meta.update(answer=answer, usage=usage, search_calls=searches)
                problem = problem or (f'nonzero exit {code}' if code != 0 else parse_error)
    answer = meta.get('answer', '')
    hits = [term for term in ('mirai-shigoto.com', '未来の仕事', 'AIOIS-10') if term.lower() in answer.lower()]
    urls = list(dict.fromkeys(re.findall(r'https?://[^\s<>\)\]"}]+', answer)))
    site_urls = [u for u in urls if re.match(r'https?://(?:www\.)?mirai-shigoto\.com(?:[/:?#]|$)', u, re.I)]
    status = 'NOT_RUN' if source in REASONS else 'ERROR' if problem else 'YES' if hits else 'NO'
    relevant = [p for p in answer.split('\n\n') if any(h.lower() in p.lower() for h in hits)]
    row = dict(zip(FIELDS, [run_date, meta['start_jst'], source,
               'NOT_RUN' if source in REASONS else 'CLI live web search', family, question,
               status, '; '.join(site_urls) if status == 'YES' else '', '',
               ('page_citation' if site_urls else 'mention_only') if status == 'YES' else '',
               '\n\n'.join(relevant) if status == 'YES' else '',
               '\n\n'.join(relevant) if hits else answer[:500],
               f"{run_date}/raw/{source}-{number}.txt; elapsed_seconds={meta['elapsed_seconds']}; "
               f"exit={meta['exit_code']}; search_calls={meta.get('search_calls', 0)}; "
               f"reason={problem}; subscription quota=not disclosed; list-price telemetry is not billing"
               + (f"; permission_enforcement={PERMISSION_ENFORCEMENT}; agy_search_event_shape={AGY_SEARCH_EVENT_SHAPE}"
                  if source == 'gemini' else '')]))
    meta.update(error=problem, final_answer_urls=urls, row=row)
    save_json(meta_path, meta)
    return row


def update_status(root, rows, run_date):
    path = root / 'status.json'
    state = json.loads(path.read_text()) if path.exists() else {'weeks': {}, 'alerted_streaks': []}
    for day in sorted({r['run_date'] for r in rows}):
        rr = [r for r in rows if r['run_date'] == day and r['source'] in ('claude', 'codex')]
        if len(rr) == 8:
            state['weeks'][day] = {'all_failed': all(r['mentioned'] in ('ERROR', 'NOT_RUN') for r in rr),
                                   'counts': {s: sum(r['source'] == s and r['mentioned'] == 'YES' for r in rr)
                                              for s in ('claude', 'codex')}}
    days = sorted(d for d in state['weeks'] if d <= run_date)
    streak = []
    for day in reversed(days):
        if not state['weeks'][day]['all_failed']:
            break
        if streak and (date.fromisoformat(streak[-1]) - date.fromisoformat(day)).days != 7:
            break
        streak.append(day)
    alert = len(streak) >= 2 and streak[-1] not in state['alerted_streaks']
    if alert:
        state['alerted_streaks'].append(streak[-1])
    state['last_checked_jst'] = datetime.now(JST).isoformat()
    save_json(path, state)
    return alert


def run(run_date, root, csv_path=None):
    date.fromisoformat(run_date)
    root.mkdir(parents=True, exist_ok=True)
    # An explicit CSV is an isolated journal: never seed it with trial history.
    log = csv_path if csv_path is not None else root / 'geo-log.csv'
    log.parent.mkdir(parents=True, exist_ok=True)
    state_root = log.parent if csv_path is not None else root
    with (state_root / '.runner.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if not log.exists():
            if csv_path is None:
                history = read_rows(HISTORY)
                if len(history) != 20:
                    raise ValueError('Expected exactly 20 history rows')
                shutil.copyfile(HISTORY, log)
            else:
                with log.open('x', newline='') as stream:
                    csv.DictWriter(stream, fieldnames=FIELDS).writeheader()
        rows = read_rows(log)
        existing = {(r['run_date'], r['source'], r['prompt_family']) for r in rows}
        week = root / run_date
        (week / 'raw').mkdir(parents=True, exist_ok=True)
        # Keep temporary work below this card's TMPDIR, or the output root for future schedules.
        tmp_root = Path(os.environ.get('KANBAN_TMP') or os.environ.get('TMPDIR') or root / '.tmp')
        tmp_root.mkdir(parents=True, exist_ok=True)
        def family(source):
            return [observe(source, i, run_date, week, tmp_root) for i in range(1, 5)
                    if (run_date, source, QUESTIONS[i-1][0]) not in existing]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            live = list(pool.map(family, ['claude', 'codex', 'gemini']))
        fresh = [r for group in live for r in group]
        for source in ('perplexity', 'google_ai_overview'):
            fresh.extend(family(source))
        with log.open('a', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=FIELDS)
            writer.writerows(fresh)
            stream.flush()
            os.fsync(stream.fileno())
        rows.extend(fresh)
        alert = update_status(state_root, rows, run_date)
        current = [r for r in rows if r['run_date'] == run_date]
        failures = [f"{r['source']}/{r['prompt_family']}: {r['mentioned']}; {r['notes']}" for r in current
                    if r['mentioned'] in ('ERROR', 'NOT_RUN')]
        summary = dict(run_date=run_date, rows=len(current), appended=len(fresh), total_rows=len(rows),
                       mentions={s: sum(r['source'] == s and r['mentioned'] == 'YES' for r in current)
                                 for s in ('claude', 'codex', 'gemini')}, failures=failures,
                       permission_enforcement=PERMISSION_ENFORCEMENT,
                       agy_search_event_shape=AGY_SEARCH_EVENT_SHAPE,
                       note='Existing date/source/prompt_family keys are never re-run or appended.', alert=alert)
        save_json(week / 'summary.json', summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if alert:
            print('ALERT: 连续两周全失败')
        return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-date', default=datetime.now(JST).date().isoformat())
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--csv-path', type=Path,
                        help='Isolated CSV without history import; status/lock beside this file')
    args = parser.parse_args()
    run(args.run_date, args.output_dir.expanduser().resolve(),
        args.csv_path.expanduser().resolve() if args.csv_path is not None else None)
