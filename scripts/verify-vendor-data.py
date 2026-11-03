#!/usr/bin/env python3
"""Guard against silently overwritten month-comment dictionary keys."""
import ast
import json
from pathlib import Path
import runpy
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
source = root / 'vendor' / 'bazi' / 'yue.py'
tree = ast.parse(source.read_text())
definition = next(node.value for node in tree.body if isinstance(node, ast.Assign)
                  and any(isinstance(target, ast.Name) and target.id == 'months' for target in node.targets))
keys = [key.value for key in definition.keys]
expected = {stem + branch for stem in '甲乙丙丁戊己庚辛壬癸' for branch in '子丑寅卯辰巳午未申酉戌亥'}
assert len(keys) == len(set(keys)) == 120, 'duplicate month key silently overwrites data'
assert set(keys) == expected, 'missing or unexpected month key'
print('ok - 120 unique and complete month lookup keys')
months = runpy.run_path(str(source))['months']
assert months['甲戌'].lstrip().startswith('九月甲木')
assert months['甲申'] != months['甲戌']
print('ok - Jia-Xu and Jia-Shen comments remain distinct')
for date, branch in [('2000-08-14', '申'), ('2000-10-13', '戌')]:
    result = subprocess.run([sys.executable, str(root / 'scripts/bazi-classic.py'),
                             '--solar', date, '--hour', '12', '--gender', 'male',
                             '--birthplace', '上海'], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data['pillars']['day']['gan'] == '甲'
    assert data['pillars']['month']['zhi'] == branch
    assert data['monthComment'] == months['甲' + branch]
    print('ok - classic CLI retrieves correct month comment for ' + date)
print('verified 4 classical data checks')
