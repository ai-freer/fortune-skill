#!/usr/bin/env python3
"""Create/reuse the project venv and verify pinned distribution hashes."""
from pathlib import Path
import subprocess
import sys
import venv
import os
import argparse
import shutil
import json


def install():
    parser = argparse.ArgumentParser(description='Hash-verified Python dependencies; project venv by default, explicit PYTHON respected.')
    parser.add_argument('--environment', choices=['project', 'current'], help='Installation target; defaults to current when PYTHON is set, otherwise project')
    parser.add_argument('--user', action='store_true', help='Use pip user site; requires current environment')
    args = parser.parse_args()
    mode = args.environment or ('current' if os.environ.get('PYTHON') else 'project')
    if args.user and mode != 'current':
        parser.error('--user requires --environment current')
    if sys.version_info < (3, 9):
        raise RuntimeError('Python 3.9+ is required')
    root = Path(__file__).resolve().parent.parent
    if mode == 'project':
        destination = root / '.venv'
        python = destination / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        if destination.is_symlink():
            raise RuntimeError('Refusing to modify a symlinked .venv; use a local project environment or manage PYTHON explicitly.')
        if destination.exists():
            if not (destination / 'pyvenv.cfg').is_file() or not python.is_file():
                raise RuntimeError('Existing .venv is incomplete or not a venv; move it aside before retrying. Nothing was deleted.')
        else:
            venv.EnvBuilder(with_pip=True).create(destination)
        subprocess.run([str(python), '-c',
            'import sys; from pathlib import Path; '
            'assert sys.version_info >= (3, 9); '
            'assert sys.prefix != sys.base_prefix and Path(sys.prefix).resolve() == Path(sys.argv[1]).resolve()',
            str(destination)], check=True)
        if 'include-system-site-packages = true' in (destination / 'pyvenv.cfg').read_text().lower():
            raise RuntimeError('Project .venv exposes global site-packages; move it aside and recreate an isolated environment.')
    else:
        selected = os.environ.get('PYTHON') or sys.executable
        python = Path(shutil.which(selected) or selected).absolute()
        subprocess.run([str(python), '-c', 'import sys; assert sys.version_info >= (3, 9)'], check=True)
    if mode == 'current':
        scope = 'user site' if args.user else 'selected interpreter site-packages'
        print(f'Installing pinned versions into {scope}; shared tools using this environment may be affected.', file=sys.stderr)
    common = [str(python), '-m', 'pip', 'install', '--require-hashes', '--no-deps',
              '--no-cache-dir', '--force-reinstall', '--disable-pip-version-check']
    if args.user:
        common.append('--user')
    subprocess.run([*common, '-r', str(root / 'requirements.txt')], check=True)
    health = subprocess.run([str(python), '-m', 'pip', 'check'], check=(mode == 'project'))
    if health.returncode:
        print('Warning: shared environment has pip-check issues; they are not automatically repaired. Verifying this skill runtime separately.', file=sys.stderr)
    expected = {item['name']: item['version'] for item in json.loads((root / 'references/python-artifacts.json').read_text())}
    subprocess.run([str(python), '-c',
        'import json,sys,importlib.metadata as m; '
        'assert all(m.version(n)==v for n,v in json.loads(sys.argv[1]).items())',
        json.dumps(expected)], check=True)
    subprocess.run([str(python), '-c', 'import lunar_python, colorama, bidict'], check=True)
    print(f'Python dependencies ready ({mode}; hash-verified runtime artifacts, build tools not hash-locked)')
    if mode == 'current':
        print('Runtime selection is not persisted: keep PYTHON set to this interpreter in the Agent environment.', file=sys.stderr)
    elif os.environ.get('PYTHON'):
        print('Note: PYTHON remains a runtime override; unset it to use the project .venv.', file=sys.stderr)


if __name__ == '__main__':
    try:
        install()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Python installation failed: {error}', file=sys.stderr)
        sys.exit(1)
