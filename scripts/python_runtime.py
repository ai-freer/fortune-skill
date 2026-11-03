"""Keep direct classic CLI calls aligned with Node's Python selection."""
import os
from pathlib import Path
import shutil
import sys


def use_project_python():
    project = Path(__file__).resolve().parent.parent
    candidate = project / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    override = os.environ.get('PYTHON')
    selected = override or (str(candidate) if (project / '.venv').exists() else sys.executable)
    resolved = shutil.which(selected) or selected
    # Compare interpreter paths, not realpaths: a venv executable may symlink to
    # the system binary while providing a different sys.prefix/site-packages.
    def identity(path):
        return os.path.normcase(os.path.join(os.path.realpath(os.path.dirname(os.path.abspath(path))), os.path.basename(path)))
    if identity(resolved) != identity(sys.executable):
        if os.environ.get('FORTUNE_PYTHON_REEXEC') == '1':
            raise RuntimeError('Python selection loop; check PYTHON and .venv')
        env = dict(os.environ, FORTUNE_PYTHON_REEXEC='1')
        os.execve(resolved, [resolved, str(Path(sys.argv[0]).resolve()), *sys.argv[1:]], env)
    # The classic wrapper's Node child must use this same interpreter.
    os.environ['PYTHON'] = sys.executable
