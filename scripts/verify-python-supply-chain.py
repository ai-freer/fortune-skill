#!/usr/bin/env python3
"""Offline lock/advisory contract checks; installation is tested separately."""
import importlib.util
import json
from pathlib import Path
import re
import unittest
import os
import subprocess
import tempfile
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('python_audit', ROOT / 'scripts/python-audit.py')
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)


class SupplyChainTests(unittest.TestCase):
    def test_lock_matches_reviewed_artifacts(self):
        text = (ROOT / 'requirements.txt').read_text()
        self.assertIn('--require-hashes', text.splitlines())
        pins = re.findall(r'^([\w-]+)==([\d.]+) --hash=sha256:([0-9a-f]{64})$', text, re.M)
        records = json.loads((ROOT / 'references/python-artifacts.json').read_text())
        self.assertEqual(sorted(pins), sorted((r['name'], r['version'], r['sha256']) for r in records))
        self.assertEqual(len(pins), 3)
        self.assertTrue(next(r for r in records if r['name']=='lunar-python')['filename'].endswith('.tar.gz'))

    def test_interpreter_precedence_and_incomplete_venv(self):
        with tempfile.TemporaryDirectory(prefix='fortune 解释器 space ') as directory:
            root=Path(directory);(root/'scripts').mkdir()
            module=root/'scripts/python-runtime.mjs'
            shutil.copy2(ROOT/'scripts/python-runtime.mjs',module)
            env={k:v for k,v in os.environ.items() if k!='PYTHON'}
            command=[os.environ.get('NODE','node'),'--input-type=module','-e',
                     'import {pythonExecutable} from '+json.dumps(module.as_uri())+'; console.log(JSON.stringify(pythonExecutable()))']
            def selected(extra=None):
                return json.loads(subprocess.check_output(command,env=dict(env,**(extra or {})),text=True))
            self.assertEqual(selected(),'python' if os.name=='nt' else 'python3')
            (root/'.venv').mkdir()
            expected=root/'.venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
            self.assertEqual(Path(selected()).resolve(),expected.resolve())
            self.assertEqual(selected({'PYTHON':'/explicit missing python'}),'/explicit missing python')

    def test_advisory_states_distinguish_unknown_from_clear(self):
        records = [{'name':'fixture','version':'1.0'}]
        self.assertEqual(audit_module.audit(records, lambda _: {'vulnerabilities':[]})['status'], 'no_known_advisories')
        self.assertEqual(audit_module.audit(records, lambda _: {'vulnerabilities':[{'id':'TEST-1','withdrawn':None}]})['status'], 'vulnerable')
        self.assertEqual(audit_module.audit(records, lambda _: {'vulnerabilities':[{'id':'TEST-1','withdrawn':'2026-01-01'}]})['status'], 'no_known_advisories')
        def unavailable(_):
            raise TimeoutError('fixture')
        self.assertEqual(audit_module.audit(records, unavailable)['status'], 'incomplete')
        self.assertEqual(audit_module.audit(records, lambda _: {})['status'], 'incomplete')

    def test_real_cli_exit_codes_with_simulated_network_responses(self):
        script=str(ROOT/'scripts/python-audit.py')
        cases=[('clear',0,'no_known_advisories'),('vulnerable',1,'vulnerable'),('offline',2,'incomplete'),('mixed',1,'vulnerable')]
        for mode,code,status in cases:
            program=("import io,json,runpy,urllib.request\n"
                     "def response(url,**kwargs):\n"
                     f"    mode={mode!r}\n"
                     "    if mode=='offline' or (mode=='mixed' and '/colorama/' in url): raise TimeoutError('fixture')\n"
                     "    data={'vulnerabilities':[] if mode=='clear' else [{'id':'TEST-CLI'}]}\n"
                     "    return io.StringIO(json.dumps(data))\n"
                     "urllib.request.urlopen=response\n"
                     f"runpy.run_path({script!r},run_name='__main__')\n")
            result=subprocess.run([sys.executable,'-c',program],text=True,capture_output=True)
            self.assertEqual(result.returncode,code,result.stderr)
            self.assertEqual(json.loads(result.stdout)['status'],status)

    def test_partial_outage_does_not_hide_a_known_advisory(self):
        def fetch(url):
            if '/one/' in url:
                return {'vulnerabilities':[{'id':'TEST-2'}]}
            raise TimeoutError('fixture')
        result = audit_module.audit([{'name':'one','version':'1'},{'name':'two','version':'1'}], fetch)
        self.assertEqual(result['status'], 'vulnerable')
        self.assertEqual(len(result['unavailable']), 1)


if __name__ == '__main__':
    unittest.main()
