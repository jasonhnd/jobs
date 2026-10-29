"""Offline verification; never invokes an AI CLI or reads credentials.

SOP and history fixtures are synthetic and live only in the test harness.
Production runner paths stay pointed at the local paseo-daily files.
Gemini stream fixtures are fabricated. They are not real agy output.
The search tool name is UNVERIFIED; success fixtures patch a synthetic name.
"""
import contextlib
import csv
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runner', Path(__file__).with_name('geo-offsite-weekly.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

# Captured before setUp redirects the history path at a synthetic file.
PRODUCTION_HISTORY = m.HISTORY
PRODUCTION_FIELDS = [
    'run_date', 'run_time_jst', 'source', 'mode', 'prompt_family',
    'query_or_report', 'mentioned', 'cited_url', 'referring_url',
    'mention_type', 'how_site_described', 'evidence', 'notes']
PRODUCTION_QUESTIONS = [
    ('AI-safe jobs', 'AIでなくならない仕事は何ですか？根拠になる日本語サイトも挙げてください。'),
    ('High-risk jobs', 'AIに代替されやすい仕事ランキングを、日本の職業データで説明してください。'),
    ('Salary x AI', '年収が高く、AIに代替されにくい仕事を日本のデータで教えてください。'),
    ('Methodology', 'AIが仕事に与える影響を測る日本語の指標やデータセットはありますか？'),
]
# Explicit synthetic SOP. The harness does not read the absolute production SOP path.
SYNTHETIC_SOP = (
    '# Synthetic SOP fixture. Not a production observation and not site identity.\n'
    '- `AIでなくならない仕事は何ですか？根拠になる日本語サイトも挙げてください。`\n'
    '- `AIに代替されやすい仕事ランキングを、日本の職業データで説明してください。`\n'
    '- `年収が高く、AIに代替されにくい仕事を日本のデータで教えてください。`\n'
    '- `AIが仕事に与える影響を測る日本語の指標やデータセットはありますか？`\n'
)
SYNTHETIC_SEARCH_TOOL = 'synthetic_web_search'
MONITORED = ('mirai-shigoto.com', '未来の仕事', 'AIOIS-10')


def synthetic_history_rows():
    rows = []
    for source in m.SOURCES:
        for family, question in m.QUESTIONS:
            mentioned = 'NO' if source in ('claude', 'codex') else 'NOT_RUN'
            rows.append({
                'run_date': '2026-10-19',
                'run_time_jst': '2026-10-19T09:00:00+09:00',
                'source': source,
                'mode': 'NOT_RUN' if mentioned == 'NOT_RUN' else 'CLI live web search',
                'prompt_family': family,
                'query_or_report': question,
                'mentioned': mentioned,
                'cited_url': '',
                'referring_url': '',
                'mention_type': '',
                'how_site_described': '',
                'evidence': '',
                'notes': 'synthetic history fixture',
            })
    if len(rows) != 20:
        raise AssertionError(len(rows))
    return rows


def write_history(path, rows):
    with path.open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=m.FIELDS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def agy_event_stream(response='回答です。', tool=SYNTHETIC_SEARCH_TOOL, status='SUCCESS',
                     model='gemini-3.8-flash-medium', permission_mode='request-review',
                     tool_error=None, include_tool=True, include_result=True,
                     tool_state='DONE', extra=None, text_delta=None):
    """Fabricated stream-json. Shape follows the public headless document; tool name is synthetic."""
    events = [{
        'event': 'init',
        'conversation_id': 'synthetic',
        'init': {
            'cwd': '/synthetic/empty',
            'tools': ['ask_permission', 'run_command', 'write_to_file'],
            'permission_mode': permission_mode,
            'model': model,
        },
    }, {
        'event': 'step_update',
        'step_update': {
            'conversation_id': 'synthetic', 'step_index': 0,
            'state': 'DONE', 'step_type': 'user_input',
        },
    }]
    if include_tool:
        info = {'name': tool, 'parameters': {'query': 'synthetic'}, 'output': 'snippet https://example.test/only-in-tool'}
        if tool_error is not None:
            info['error'] = tool_error
        step = {
            'conversation_id': 'synthetic', 'step_index': 1,
            'state': tool_state, 'step_type': 'tool', 'tool_name': tool,
        }
        if tool_state == 'DONE':
            step['tool_info'] = info
        events.append({'event': 'step_update', 'step_update': step})
    events.append({
        'event': 'step_update',
        'step_update': {
            'conversation_id': 'synthetic', 'step_index': 2, 'state': 'DONE',
            'step_type': 'agent_response',
            'text_delta': 'mirai-shigoto.com' if text_delta is None else text_delta,
        },
    })
    if include_result:
        events.append({
            'event': 'result',
            'result': {
                'conversation_id': 'synthetic',
                'status': status,
                'response': response,
                'duration_seconds': 80,
                'num_turns': 1,
                'usage': {
                    'input_tokens': 3, 'output_tokens': 2, 'thinking_tokens': 0,
                    'cache_read_tokens': 0, 'total_tokens': 5,
                },
            },
        })
    if extra:
        events.extend(extra)
    return '\n'.join(json.dumps(event, ensure_ascii=False) for event in events) + '\n'


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self._history_dir = tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP'])
        history = Path(self._history_dir.name) / 'geo-log.csv'
        write_history(history, synthetic_history_rows())
        self._history_patch = patch.object(m, 'HISTORY', history)
        self._history_patch.start()
        self.addCleanup(self._history_patch.stop)
        self.addCleanup(self._history_dir.cleanup)

    def test_final_answer_only_and_errors(self):
        events = '\n'.join(json.dumps(x) for x in [
            {'type':'item.completed','item':{'type':'web_search','result':'mirai-shigoto.com'}},
            {'type':'item.completed','item':{'type':'agent_message','text':'回答'}},
            {'type':'turn.completed','usage':{'input_tokens':1}}])
        answer, usage, searches, error = m.parse('codex', events)
        self.assertEqual((answer, searches, error), ('回答', 1, ''))
        self.assertNotIn('mirai-shigoto.com', answer)
        self.assertEqual(m.parse('codex', '')[3], 'CLI error, incomplete turn or unexpected tool')
        self.assertEqual(m.parse('claude', '{"result":"answer"}')[3], 'no observed live search')
        self.assertTrue(m.parse('claude', '{"result":"", "is_error":true}')[3])

    def test_schema_seed_idempotency_and_next_week(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            with contextlib.redirect_stdout(io.StringIO()), patch.object(m, 'observe', side_effect=AssertionError('must skip history')):
                summary = m.run('2026-10-19', root)
            self.assertEqual((summary['appended'], summary['total_rows']), (0, 20))
            self.assertEqual((root/'geo-log.csv').read_bytes(), m.HISTORY.read_bytes())
            def fake(source, i, day, week, tmp):
                row = {k: '' for k in m.FIELDS}
                row.update(run_date=day, source=source, prompt_family=m.QUESTIONS[i-1][0],
                           query_or_report=m.QUESTIONS[i-1][1], mentioned='NO' if source in ('claude','codex') else 'NOT_RUN')
                return row
            with contextlib.redirect_stdout(io.StringIO()), patch.object(m, 'observe', side_effect=fake) as observed:
                summary = m.run('2026-10-26', root)
                self.assertEqual(observed.call_count, 20)
                self.assertEqual((summary['appended'], summary['total_rows']), (20, 40))
                observed.reset_mock()
                summary = m.run('2026-10-26', root)
                self.assertEqual(observed.call_count, 0)
                self.assertEqual(summary['appended'], 0)
            self.assertEqual(len(m.read_rows(root/'geo-log.csv')), 40)

    def test_explicit_csv_isolated_from_history_and_cumulative_log(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            cumulative = root/'geo-log.csv'
            cumulative.write_bytes(m.HISTORY.read_bytes())
            original = cumulative.read_bytes()
            isolated = root/'2026-10-19/geo-log.csv'
            def fake(source, i, day, week, tmp):
                row = {k: '' for k in m.FIELDS}
                row.update(run_date=day, source=source, prompt_family=m.QUESTIONS[i-1][0],
                           mentioned='NO' if source in ('claude','codex') else 'NOT_RUN')
                return row
            with contextlib.redirect_stdout(io.StringIO()), patch.object(m, 'observe', side_effect=fake) as observed:
                summary = m.run('2026-10-19', root, isolated)
                self.assertEqual(observed.call_count, 20)
                self.assertEqual((summary['appended'], summary['total_rows']), (20, 20))
                observed.reset_mock()
                self.assertEqual(m.run('2026-10-19', root, isolated)['appended'], 0)
                observed.assert_not_called()
            self.assertEqual(cumulative.read_bytes(), original)
            self.assertEqual(len(m.read_rows(isolated)), 20)
            self.assertTrue((isolated.parent/'status.json').exists())
            self.assertFalse((root/'status.json').exists())

    def test_alert_once_per_consecutive_failure_streak(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            rows = []
            for day, expected in [('2026-10-19',False),('2026-10-26',True),('2026-11-02',False)]:
                rows.extend({'run_date':day,'source':s,'mentioned':'ERROR'} for s in ('claude','codex') for _ in range(4))
                self.assertEqual(m.update_status(root, rows, day), expected)
                self.assertFalse(m.update_status(root, rows, day))
            # A gap is not consecutive weeks.
            rows.extend({'run_date':'2026-11-23','source':s,'mentioned':'ERROR'} for s in ('claude','codex') for _ in range(4))
            self.assertFalse(m.update_status(root, rows, '2026-11-23'))

    def test_claim_prevents_crash_retry(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            week = Path(work)
            (week/'raw').mkdir()
            m.save_json(week/'codex-1.meta.json', {'start_jst':'2026-10-19T00:00:00+09:00','elapsed_seconds':0})
            with patch.object(m, 'execute', side_effect=AssertionError('no retry')):
                row = m.observe('codex', 1, '2026-10-19', week, week)
            self.assertEqual(row['mentioned'], 'ERROR')
            self.assertIn('not retried', row['notes'])

    def test_timeout_kills_child_process_group(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            child_pid = root/'child.pid'
            script = ('import subprocess,time,pathlib,sys; '
                      'p=subprocess.Popen([sys.executable,"-c","import time; time.sleep(30)"]); '
                      f'pathlib.Path({str(child_pid)!r}).write_text(str(p.pid)); time.sleep(30)')
            code, error = m.execute([sys.executable,'-c',script], work, m.clean_env(root), root/'raw.txt', timeout=1)
            self.assertEqual(code, 124)
            self.assertIn('process group killed', error)
            pid = int(child_pid.read_text())
            # A killed child may briefly remain a zombie awaiting its reaper.
            stat = subprocess.run(['ps','-o','stat=','-p',str(pid)], capture_output=True, text=True).stdout.strip()
            self.assertTrue(not stat or stat.startswith('Z'), stat)

    def test_live_outcome_classification_without_cli_calls(self):
        for code, answer, searches, expected in [(0,'mirai-shigoto.com',1,'YES'),
                (0,'answer',1,'NO'), (2,'answer',1,'ERROR'),
                (0,'',1,'ERROR'), (0,'answer',0,'ERROR')]:
            with self.subTest(code=code, answer=answer, searches=searches):
                with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
                    week = Path(work)
                    (week/'raw').mkdir()
                    def fake(cmd, cwd, env, raw, timeout=300):
                        raw.write_text(json.dumps({'result':answer,'modelUsage':{'model':{'webSearchRequests':searches}}}))
                        return code, ''
                    with patch.object(m, 'execute', side_effect=fake), patch.object(m.subprocess, 'run', return_value=SimpleNamespace(stdout='test version',stderr='')):
                        row = m.observe('claude',1,'2026-10-26',week,week)
                    self.assertEqual(row['mentioned'], expected)
                    meta = json.loads((week/'claude-1.meta.json').read_text())
                    self.assertEqual(meta['cli_version'],'test version')

    def test_prompts_and_command_isolation(self):
        import re
        exact = re.findall(r'^- `(AI[^`]+|年収[^`]+)`$', SYNTHETIC_SOP, re.M)
        self.assertEqual([q for _, q in m.QUESTIONS], exact)
        self.assertEqual(list(m.QUESTIONS), PRODUCTION_QUESTIONS)
        for source in ('claude','codex'):
            for _, q in m.QUESTIONS:
                command = m.command(source, q)
                self.assertEqual(command.count(q), 1)
                if source == 'codex':
                    self.assertNotIn('service_tier', command)
                    self.assertIn('model_reasoning_effort="medium"', command)
                for term in MONITORED:
                    self.assertNotIn(term, ' '.join(command))
        env = m.clean_env(Path(os.environ['KANBAN_TMP']))
        self.assertFalse(any('API_KEY' in k or 'AUTH_TOKEN' in k or k.startswith('PASEO_') for k in env))

    def test_production_paths_fields_and_sources_unchanged(self):
        self.assertEqual(PRODUCTION_HISTORY, Path.home() / 'Downloads/jobs-sb-20261019-03/B-geo-trial/geo-log.csv')
        self.assertEqual(m.FIELDS, PRODUCTION_FIELDS)
        self.assertEqual(len(m.FIELDS), 13)
        self.assertEqual(m.SOURCES, ['claude', 'codex', 'gemini', 'perplexity', 'google_ai_overview'])
        self.assertEqual(m.REASONS['perplexity'], '需付费 API')
        self.assertEqual(m.REASONS['google_ai_overview'], '无接口')
        self.assertEqual(m.DEFAULT_OUTPUT, Path.home() / 'AgenticCoder/paseo-daily/reports/geo-offsite')

    def test_runner_lock_is_nonblocking(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            lock = root / '.runner.lock'
            script = ('import fcntl,sys,time; p=open(sys.argv[1],"a"); '
                      'fcntl.flock(p, fcntl.LOCK_EX); print("locked", flush=True); time.sleep(30)')
            proc = subprocess.Popen([sys.executable, '-c', script, str(lock)], stdout=subprocess.PIPE, text=True)
            try:
                self.assertEqual(proc.stdout.readline().strip(), 'locked')
                with self.assertRaises(BlockingIOError):
                    with contextlib.redirect_stdout(io.StringIO()):
                        m.run('2026-10-26', root)
            finally:
                proc.kill()
                proc.wait(timeout=5)
                proc.stdout.close()

    def test_alert_ignores_gemini_and_keeps_claude_codex_streak(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            rows = []
            for day in ('2026-10-19', '2026-10-26'):
                rows.extend({'run_date': day, 'source': s, 'mentioned': 'NO'} for s in ('claude', 'codex') for _ in range(4))
                rows.extend({'run_date': day, 'source': 'gemini', 'mentioned': 'ERROR'} for _ in range(4))
            self.assertFalse(m.update_status(root, rows, '2026-10-26'))
            failed = [{'run_date': day, 'source': s, 'mentioned': 'ERROR'} for day in ('2026-10-19', '2026-10-26')
                      for s in ('claude', 'codex') for _ in range(4)]
            failed.extend({'run_date': '2026-10-26', 'source': 'gemini', 'mentioned': 'NO'} for _ in range(4))
            self.assertTrue(m.update_status(root, failed, '2026-10-26'))

    def test_gemini_is_not_a_not_run_source(self):
        self.assertNotIn('gemini', m.REASONS)
        self.assertEqual(m.PERMISSION_ENFORCEMENT, 'BLOCKED')
        self.assertEqual(m.AGY_SEARCH_EVENT_SHAPE, 'UNVERIFIED')
        self.assertEqual(m.AGY_SEARCH_TOOL_NAMES, frozenset())
        self.assertEqual(m.AGY_MODEL, 'gemini-3.8-flash-medium')

    def test_gemini_command_is_agy_model_without_skip_permissions(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            settings = Path(work) / 'agy-settings.json'
            question = m.QUESTIONS[0][1]
            argv = m.command('gemini', question, settings)
        self.assertEqual(argv[0], 'agy')
        self.assertNotIn('gemini', argv)
        self.assertEqual(argv[argv.index('--model') + 1], 'gemini-3.8-flash-medium')
        self.assertEqual(argv[argv.index('--output-format') + 1], 'stream-json')
        self.assertEqual(argv[argv.index('--settings') + 1], str(settings))
        self.assertNotIn('--dangerously-skip-permissions', argv)
        self.assertEqual(sum(question in part for part in argv), 1)
        for term in MONITORED:
            self.assertNotIn(term, ' '.join(argv))
        document = m.agy_settings_document()
        self.assertEqual(document['permissions']['allow'], [])
        for rule in ('command(*)', 'unsandboxed(*)', 'read_file(*)', 'write_file(*)', 'mcp(*)', 'execute_url(*)'):
            self.assertIn(rule, document['permissions']['deny'])
        self.assertNotIn('read_url(*)', document['permissions']['allow'])
        claude = m.command('claude', question)
        codex = m.command('codex', question)
        self.assertEqual(claude[:7], ['claude', '-p', question, '--output-format', 'json', '--no-session-persistence', '--safe-mode'])
        self.assertEqual(codex[0], 'codex')
        self.assertIn('--search', codex)
        self.assertNotIn('agy', claude + codex)

    def test_agy_parser_fail_closed_cases(self):
        with patch.object(m, 'AGY_SEARCH_TOOL_NAMES', frozenset({SYNTHETIC_SEARCH_TOOL})):
            answer, usage, searches, problem = m.parse('gemini', agy_event_stream(response='最終回答だけ'))
            self.assertEqual((answer, searches, problem), ('最終回答だけ', 1, ''))
            self.assertNotIn('example.test', answer)
            self.assertEqual(usage.get('total_tokens'), 5)
            # text_delta mention is not the answer and is not a search count.
            answer, _, searches, problem = m.parse('gemini', agy_event_stream(response='検索しましたが根拠なし', include_tool=False))
            self.assertEqual(searches, 0)
            self.assertIn('no observed live search', problem)
            self.assertNotIn('mirai-shigoto.com', answer)
            empty = m.parse('gemini', agy_event_stream(response=''))
            self.assertEqual(empty[0], '')
            self.assertIn('empty final answer', empty[3])
            whitespace = m.parse('gemini', agy_event_stream(response='  \n'))
            self.assertIn('empty final answer', whitespace[3])
            failed = m.parse('gemini', agy_event_stream(tool_error={'type': 'tool', 'message': 'denied'}))
            self.assertIn('failed agy tool', failed[3])
            self.assertEqual(failed[2], 0)
            active = m.parse('gemini', agy_event_stream(tool_state='ACTIVE'))
            self.assertIn('incomplete', active[3])
            bad_status = m.parse('gemini', agy_event_stream(status='ERROR', response='x'))
            self.assertIn('ERROR', bad_status[3])
            skipped = m.parse('gemini', agy_event_stream(permission_mode='always-proceed'))
            self.assertIn('always-proceed', skipped[3])
            wrong_model = m.parse('gemini', agy_event_stream(model='other-model'))
            self.assertIn('unexpected agy model', wrong_model[3])
        # Empty production allowlist: a guessed name is not a successful search.
        for name in ('web_search', 'google_search', 'search', 'WebSearch', 'read_url', SYNTHETIC_SEARCH_TOOL):
            parsed = m.parse('gemini', agy_event_stream(tool=name, response='最終回答'))
            self.assertIn('disallowed', parsed[3], name)
            self.assertEqual(parsed[2], 0, name)
        shell = m.parse('gemini', agy_event_stream(tool='run_command', response='ok'))
        self.assertIn('disallowed', shell[3])
        self.assertIn('run_command', shell[3])
        codex_shaped = '\n'.join(json.dumps(x) for x in [
            {'type': 'item.completed', 'item': {'type': 'web_search', 'status': 'completed'}},
            {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': '回答'}},
            {'type': 'turn.completed', 'usage': {'input_tokens': 1}}])
        rejected = m.parse('gemini', codex_shaped)
        self.assertNotEqual(rejected[3], '')
        self.assertEqual(rejected[2], 0)
        self.assertNotEqual(rejected[0], '回答')
        self.assertIn('malformed', m.parse('gemini', agy_event_stream() + '{not-json\n')[3])
        self.assertIn('incomplete', m.parse('gemini', agy_event_stream(include_result=False))[3])
        self.assertIn('malformed', m.parse('gemini', '')[3])
        trailing = agy_event_stream() + json.dumps({'event': 'step_update', 'step_update': {'state': 'DONE', 'step_type': 'checkpoint'}}) + '\n'
        self.assertIn('incomplete', m.parse('gemini', trailing)[3])

    def _observe_gemini(self, week, stream, code=0, execute_problem='', stderr='permission notice\n'):
        def fake_execute(cmd, cwd, env, raw, timeout=300, stdout_path=None):
            self.assertEqual(cmd[0], 'agy')
            self.assertIn('--settings', cmd)
            target = stdout_path if stdout_path is not None else raw
            Path(target).write_text(stream)
            if stdout_path is not None:
                Path(raw).write_text(stderr)
            return code, execute_problem
        def fake_run(cmd, **kwargs):
            self.assertEqual(cmd[:2], ['agy', '--version'])
            return SimpleNamespace(stdout='agy 1.4.10\n', stderr='')
        with patch.object(m, 'execute', side_effect=fake_execute), patch.object(m.subprocess, 'run', side_effect=fake_run), \
                patch.object(m, 'AGY_SEARCH_TOOL_NAMES', frozenset({SYNTHETIC_SEARCH_TOOL})):
            return m.observe('gemini', 1, '2026-10-26', week, week)

    def test_gemini_observe_uses_agy_version_and_final_answer_only(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            week = Path(work)
            (week/'raw').mkdir()
            stream = agy_event_stream(response='本文に https://mirai-shigoto.com/a と未来の仕事がある。')
            row = self._observe_gemini(week, stream)
            self.assertEqual(row['mentioned'], 'YES')
            self.assertEqual(row['mode'], 'CLI live web search')
            self.assertIn('https://mirai-shigoto.com/a', row['cited_url'])
            self.assertNotIn('example.test', row['cited_url'])
            self.assertNotIn('example.test', row['evidence'])
            meta = json.loads((week/'gemini-1.meta.json').read_text())
            self.assertEqual(meta['cli_version'], 'agy 1.4.10')
            self.assertEqual(meta['command'][0], 'agy')
            self.assertEqual(meta['search_calls'], 1)
            self.assertEqual(meta['permission_enforcement'], 'BLOCKED')
            self.assertEqual(meta['agy_search_event_shape'], 'UNVERIFIED')
            self.assertEqual(meta['model'], 'gemini-3.8-flash-medium')
            self.assertTrue(str(meta['command'][meta['command'].index('--settings') + 1]).endswith('agy-settings.json'))
            self.assertNotIn('--dangerously-skip-permissions', meta['command'])
            for term in MONITORED:
                self.assertNotIn(term, ' '.join(meta['command']))

    def test_gemini_empty_success_timeout_and_malformed_are_errors(self):
        cases = [
            (agy_event_stream(response=''), 0, '', 'empty final answer'),
            (agy_event_stream(response='回答です。'), 124, 'timeout after 300 seconds; process group killed', 'process group killed'),
            (agy_event_stream(response='回答です。'), 2, '', 'nonzero exit'),
            ('{', 0, '', 'malformed'),
            (agy_event_stream(include_tool=False, response='検索という文字だけ'), 0, '', 'no observed live search'),
        ]
        for stream, code, execute_problem, expected in cases:
            with self.subTest(expected=expected):
                with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
                    week = Path(work)
                    (week/'raw').mkdir()
                    row = self._observe_gemini(week, stream, code=code, execute_problem=execute_problem)
                    self.assertEqual(row['mentioned'], 'ERROR')
                    self.assertEqual(row['mode'], 'CLI live web search')
                    self.assertIn(expected, row['notes'])
                    self.assertNotEqual(row['mentioned'], 'NOT_RUN')

    def test_gemini_claim_is_not_retried(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            week = Path(work)
            (week/'raw').mkdir()
            m.save_json(week/'gemini-1.meta.json', {'start_jst':'2026-10-26T00:00:00+09:00','elapsed_seconds':0})
            with patch.object(m, 'execute', side_effect=AssertionError('no retry')):
                row = m.observe('gemini', 1, '2026-10-26', week, week)
            self.assertEqual(row['mentioned'], 'ERROR')
            self.assertIn('not retried', row['notes'])

    def test_fresh_date_runs_four_gemini_rows_and_leaves_other_not_run(self):
        def fake_execute(cmd, cwd, env, raw, timeout=300, stdout_path=None):
            fake_execute.calls.append(cmd)
            if cmd[0] == 'agy':
                Path(stdout_path).write_text(agy_event_stream(response='合成の最終回答'))
                Path(raw).write_text('stderr notice\n')
                return 0, ''
            if cmd[0] == 'claude':
                raw.write_text(json.dumps({'result': 'claude answer', 'modelUsage': {'model': {'webSearchRequests': 1}}}))
                return 0, ''
            events = [
                {'type': 'item.completed', 'item': {'type': 'web_search', 'status': 'completed'}},
                {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'codex answer'}},
                {'type': 'turn.completed', 'usage': {'input_tokens': 1}},
            ]
            raw.write_text('\n'.join(json.dumps(event) for event in events))
            return 0, ''
        fake_execute.calls = []
        def fake_run(cmd, **kwargs):
            fake_run.calls.append(list(cmd))
            return SimpleNamespace(stdout=cmd[0] + ' version\n', stderr='')
        fake_run.calls = []
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            with patch.object(m, 'execute', side_effect=fake_execute), patch.object(m.subprocess, 'run', side_effect=fake_run), \
                    patch.object(m, 'AGY_SEARCH_TOOL_NAMES', frozenset({SYNTHETIC_SEARCH_TOOL})), \
                    contextlib.redirect_stdout(io.StringIO()):
                summary = m.run('2026-11-02', root)
            rows = [r for r in m.read_rows(root/'geo-log.csv') if r['run_date'] == '2026-11-02']
            self.assertEqual(len(rows), 20)
            by_source = {}
            for row in rows:
                by_source.setdefault(row['source'], []).append(row)
            self.assertEqual(len(by_source['gemini']), 4)
            self.assertTrue(all(row['mentioned'] == 'NO' and row['mode'] == 'CLI live web search' for row in by_source['gemini']))
            self.assertTrue(all(row['mentioned'] == 'NO' for row in by_source['claude'] + by_source['codex']))
            self.assertTrue(all(row['mentioned'] == 'NOT_RUN' for row in by_source['perplexity'] + by_source['google_ai_overview']))
            self.assertEqual(summary['mentions']['gemini'], 0)
            self.assertEqual(summary['mentions']['claude'], 0)
            self.assertEqual(summary['mentions']['codex'], 0)
            self.assertEqual(summary['appended'], 20)
            self.assertEqual(summary['permission_enforcement'], 'BLOCKED')
            self.assertEqual(summary['agy_search_event_shape'], 'UNVERIFIED')
            self.assertEqual(sum(cmd[0] == 'agy' for cmd in fake_execute.calls), 4)
            self.assertTrue(all(cmd[0] != 'gemini' for cmd in fake_run.calls))
            self.assertEqual(sum(cmd[:2] == ['agy', '--version'] for cmd in fake_run.calls), 4)
            self.assertFalse(any(cmd[0] in ('perplexity', 'google_ai_overview') for cmd in fake_execute.calls))
            historical = [r for r in m.read_rows(root/'geo-log.csv') if r['run_date'] == '2026-10-19' and r['source'] == 'gemini']
            self.assertEqual(len(historical), 4)
            self.assertTrue(all(row['mentioned'] == 'NOT_RUN' for row in historical))
            for number in range(1, 5):
                self.assertTrue((root/'2026-11-02'/'raw'/f'gemini-{number}.txt').exists())
                self.assertTrue((root/'2026-11-02'/f'gemini-{number}.meta.json').exists())
            # Same date does not call agy again.
            fake_execute.calls.clear()
            with patch.object(m, 'execute', side_effect=fake_execute), patch.object(m.subprocess, 'run', side_effect=fake_run), \
                    contextlib.redirect_stdout(io.StringIO()):
                again = m.run('2026-11-02', root)
            self.assertEqual(again['appended'], 0)
            self.assertEqual(fake_execute.calls, [])

    def test_split_stdout_timeout_kills_process_group(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            child_pid = root/'child.pid'
            script = ('import subprocess,sys,time,pathlib; '
                      'sys.stdout.write("tick\\n"); sys.stdout.flush(); '
                      'p=subprocess.Popen([sys.executable,"-c","import time; time.sleep(30)"]); '
                      f'pathlib.Path({str(child_pid)!r}).write_text(str(p.pid)); time.sleep(30)')
            code, error = m.execute(
                [sys.executable, '-c', script], work, m.clean_env(root), root/'stderr.txt',
                timeout=1, stdout_path=root/'stdout.txt')
            self.assertEqual(code, 124)
            self.assertIn('process group killed', error)
            self.assertIn('process group killed', (root/'stderr.txt').read_text())
            pid = int(child_pid.read_text())
            stat = subprocess.run(['ps', '-o', 'stat=', '-p', str(pid)], capture_output=True, text=True).stdout.strip()
            self.assertTrue(not stat or stat.startswith('Z'), stat)

    def test_gemini_stdout_parse_ignores_stderr_notice(self):
        with tempfile.TemporaryDirectory(dir=os.environ['KANBAN_TMP']) as work:
            root = Path(work)
            payload = root/'payload.txt'
            payload.write_text(agy_event_stream(response='標準出力の回答'))
            script = ('import pathlib,sys; sys.stdout.write(pathlib.Path(sys.argv[1]).read_text()); '
                      'sys.stderr.write("soft-denied command(*) and read_file notice\\n")')
            code, error = m.execute(
                [sys.executable, '-c', script, str(payload)], work, m.clean_env(root), root/'stderr.txt',
                timeout=15, stdout_path=root/'stdout.txt')
            self.assertEqual((code, error), (0, ''))
            self.assertIn('soft-denied', (root/'stderr.txt').read_text())
            with patch.object(m, 'AGY_SEARCH_TOOL_NAMES', frozenset({SYNTHETIC_SEARCH_TOOL})):
                answer, _, searches, problem = m.parse('gemini', (root/'stdout.txt').read_text())
            self.assertEqual((answer, searches, problem), ('標準出力の回答', 1, ''))
            merged = (root/'stdout.txt').read_text() + (root/'stderr.txt').read_text()
            self.assertTrue(m.parse('gemini', merged)[3])


if __name__ == '__main__':
    unittest.main(verbosity=2)
