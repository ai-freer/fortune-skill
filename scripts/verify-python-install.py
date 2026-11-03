#!/usr/bin/env python3
"""Real local install/runtime smoke; run after install-python.py."""
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import shutil
import venv

ROOT = Path(__file__).resolve().parent.parent
ENV = {k: v for k, v in os.environ.items() if k not in ('PYTHON', 'FORTUNE_PYTHON_REEXEC')}
ENV['PYTHONHASHSEED'] = '0'  # Compare data under the same Python set-order seed.
NODE = os.environ.get('NODE', 'node')
PYTHON = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
BIRTH = ['--solar', '1990-05-15', '--hour', '15', '--gender', 'male', '--birthplace', '上海']


def run(command, code=0, env=None):
    result = subprocess.run(command, cwd=ROOT, env=env or ENV, text=True, capture_output=True, timeout=120)
    if result.returncode != code:
        raise AssertionError(f'{command[0]} returned {result.returncode}: {result.stderr[-1500:]} {result.stdout[-1500:]}')
    return result


def main():
    selected = run([NODE, '--input-type=module', '-e',
                    'import {pythonExecutable} from "./scripts/python-runtime.mjs"; console.log(JSON.stringify(pythonExecutable()))'])
    assert Path(json.loads(selected.stdout)) == PYTHON
    # -S removes host site-packages; success requires the bootstrap to re-exec.
    direct = json.loads(run([sys.executable, '-S', 'scripts/bazi-classic.py', *BIRTH]).stdout)
    project = json.loads(run([str(PYTHON), 'scripts/bazi-classic.py', *BIRTH]).stdout)
    assert direct == project and not direct.get('error')
    aggregate = json.loads(run([NODE, 'scripts/fortune-report-data.mjs', *BIRTH, '--from', '2026', '--to', '2026', '--ziwei-years', '2026']).stdout)
    assert not aggregate.get('error')
    shared_env = dict(ENV, PYTHON=sys.executable)
    shared = json.loads(run([sys.executable, 'scripts/bazi-classic.py', *BIRTH], env=shared_env).stdout)
    assert shared == project
    shared_aggregate = json.loads(run([NODE, 'scripts/fortune-report-data.mjs', *BIRTH, '--from', '2026', '--to', '2026', '--ziwei-years', '2026'], env=shared_env).stdout)
    assert not shared_aggregate.get('error')
    with tempfile.TemporaryDirectory(prefix='fortune 缺依赖 space ') as temp:
        empty = Path(temp) / 'empty'
        venv.EnvBuilder(with_pip=False).create(empty)
        executable = empty / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        # Explicit empty override must fail; it must not borrow the project venv.
        failed = run([sys.executable, 'scripts/bazi-classic.py', *BIRTH], 1, dict(ENV, PYTHON=str(executable)))
        assert 'lunar_python' in failed.stderr
        timezone = json.loads(run([NODE, 'scripts/time-normalize.mjs', '--solar','2026-07-05','--hour','12','--birthplace','北京'], env=dict(ENV,PYTHON=str(executable))).stdout)
        assert timezone['instant']['utc']  # stdlib-only chain still works
    with tempfile.TemporaryDirectory(prefix='fortune 哈希 space ') as temp:
        temp = Path(temp)
        records=json.loads((ROOT/'references/python-artifacts.json').read_text())
        colorama=next(r for r in records if r['name']=='colorama')
        bad=temp/'bad requirements.txt'
        bad.write_text(colorama['url']+' --hash=sha256:'+'0'*64+'\n')
        failed=run([str(PYTHON),'-m','pip','install','--require-hashes','--force-reinstall','--no-deps','--no-cache-dir','-r',str(bad)],1)
        assert 'HASHES' in failed.stderr.upper()
        run([str(PYTHON),'-c','import colorama'])
        broken=temp/'broken project';(broken/'scripts').mkdir(parents=True)
        shutil.copy2(ROOT/'scripts/install-python.py',broken/'scripts/install-python.py')
        (broken/'.venv').mkdir()
        failed=run([sys.executable,str(broken/'scripts/install-python.py')],1)
        assert 'Nothing was deleted' in failed.stderr
        assert (broken/'.venv').is_dir()
    print('Project selection, direct/Node calls, missing dependencies and explicit override passed on ' + sys.platform)


if __name__ == '__main__':
    main()
