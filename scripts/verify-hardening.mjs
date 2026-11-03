#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync, readlinkSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectDST } from './time-normalize.mjs';
import { findCity } from './city-data.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;
const python = process.env.PYTHON || 'python3';
const env = { ...process.env, NODE: node };
const birth = ['--solar', '1990-05-15', '--hour', '15', '--gender', 'male', '--birthplace', '上海'];
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`ok - ${label}`); }
function run(command, args, code = 0, options = {}) {
  const r = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024, ...options });
  assert.ifError(r.error);
  assert.equal(r.status, code, `${command} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r;
}
function cli(script, args, code = 0, options = {}) {
  return JSON.parse(run(script.endsWith('.py') ? python : node, [`scripts/${script}`, ...args], code, options).stdout);
}
check('DST resolves local Shanghai clock before and after spring transition', () => {
  assert.equal(detectDST('1990-04-15', 1, 30, 'Asia/Shanghai').active, false);
  assert.equal(detectDST('1990-04-15', 3, 30, 'Asia/Shanghai').active, true);
});
check('DST rejects gaps and repeated clocks instead of guessing', () => {
  for (const [date, hour, zone, code] of [
    ['1990-04-15', 2, 'Asia/Shanghai', 'nonexistent_local_time'],
    ['1990-09-16', 1, 'Asia/Shanghai', 'ambiguous_local_time'],
    ['2024-03-10', 2, 'America/New_York', 'nonexistent_local_time'],
    ['2024-11-03', 1, 'America/New_York', 'ambiguous_local_time']
  ]) assert.throws(() => detectDST(date, hour, 30, zone), error => error.code === code);
});
check('southern and fractional-offset zones resolve the same actual clock', () => {
  assert.equal(detectDST('2024-01-15', 12, 0, 'Australia/Sydney').utcOffsetMinutes, 660);
  assert.equal(detectDST('2024-07-15', 12, 0, 'Australia/Sydney').utcOffsetMinutes, 600);
  assert.equal(detectDST('2024-01-15', 12, 0, 'Asia/Kathmandu').utcOffsetMinutes, 345);
});
check('historical and current meridians follow IANA offsets', () => {
  for (const [date, city, meridian] of [['2024-01-15', '伊斯坦布尔', 45], ['2024-01-15', '特拉维夫', 30], ['1980-01-15', '新加坡', 112.5]]) {
    const d = cli('time-normalize.mjs', ['--solar', date, '--hour', '12', '--birthplace', city]);
    assert.equal(d.trueSolarTime.standardLongitude, meridian);
    assert.equal(d.trueSolarTime.method, 'local_apparent_solar_time_approximation');
    assert.equal(d.trueSolarTime.equationOfTimeApplied, true);
  }
});
check('normalizer never substitutes Shanghai for an unmatched city', () => {
  for (const city of ['中国', '火星虚构镇', 'NoSuchCity']) {
    const d = cli('time-normalize.mjs', [...birth, '--birthplace', city], 1);
    assert.equal(d.error, 'unknown_city');
    assert.equal(d.corrected, undefined);
  }
});
check('blank or country-only place names cannot silently match Beijing', () => {
  for (const place of [' ', '\t', '中国']) assert.equal(findCity(place), null);
  assert.equal(cli('time-normalize.mjs', [...birth, '--birthplace', ' '], 1).error, 'unknown_city');
});
for (const script of ['bazi-chart.mjs', 'ziwei-chart.mjs', 'bazi-classic.py']) {
  check(`${script} rejects unknown Chinese and non-Chinese cities without chart output`, () => {
    for (const city of ['NoSuchCity', '中国', '火星虚构镇']) {
      const d = cli(script, [...birth, '--birthplace', city], 1);
      assert.equal(d.error, 'time_normalization_failed');
      assert.equal(d.pillars, undefined);
      assert.equal(d.soulPalace, undefined);
    }
  });
  check(`${script} resolves the demonstrated solar-term basis conflict`, () => {
    const d = cli(script, [...birth, '--solar', '2012-09-07', '--hour', '13', '--minute', '26']);
    assert.equal(d.timeCorrection.calendarPolicy.version, 'utc-instant-v1');
    if (d.pillars) assert.equal(d.pillars.month.ganZhi, '戊申');
  });
}
check('solar-term direction uses actual Beijing instant at Bailu', () => {
  const d = cli('time-normalize.mjs', [...birth, '--solar', '2012-09-07', '--hour', '13', '--minute', '26']);
  assert.equal(d.solarTermBoundary.nearest.name, '白露');
  assert.equal(d.solarTermBoundary.nearest.direction, 'before');
  assert.equal(d.solarTermBoundary.calendarBoundaryConflict, false);
});
check('solar-term distances are independent of host DST', () => {
  const args = ['scripts/solar-term-boundary.mjs', '--solar', '2024-03-10', '--hour', '3', '--minute', '30'];
  const a = run(node, args, 0, { env: { ...env, TZ: 'UTC' } }).stdout;
  const b = run(node, args, 0, { env: { ...env, TZ: 'America/New_York' } }).stdout;
  assert.equal(a, b);
});
for (const script of ['time-normalize.mjs', 'bazi-chart.mjs', 'ziwei-chart.mjs', 'solar-term-boundary.mjs', 'fortune-report-data.mjs', 'report-draft.mjs']) {
  check(`${script} rejects truncated or fractional hours`, () => {
    for (const hour of ['15junk', '15.5']) run(node, [`scripts/${script}`, ...birth, '--hour', hour], 1);
  });
}
check('invalid and unsupported year requests fail explicitly', () => {
  for (const script of ['bazi-chart.mjs', 'ziwei-chart.mjs']) {
    for (const year of ['2026junk', '0', 'NaN']) assert.equal(cli(script, [...birth, '--year', year], 1).error, 'invalid_year');
  }
  assert.equal(cli('bazi-chart.mjs', [...birth, '--year', '2200'], 1).error, 'unsupported_year');
  assert.equal(cli('fortune-report-data.mjs', [...birth, '--ziwei-years', '2026,garbage'], 1).error, 'invalid_year');
});
check('missing Python returns structured failure without a null-stdout crash', () => {
  const d = cli('fortune-report-data.mjs', [...birth, '--from', '2026', '--to', '2026'], 1, { env: { ...env, PYTHON: '/no-such-fortune-python' } });
  assert.equal(d.error, 'child_process_failed');
  assert.equal(JSON.parse(d.input.stdout).error, 'time_normalization_failed');
});
check('JS charts reuse the current Node even when PATH has no node', () => {
  for (const script of ['bazi-chart.mjs', 'ziwei-chart.mjs']) {
    const d = cli(script, birth, 0, { env: { ...env, PATH: '', PYTHON: run(python, ['-c', 'import sys; print(sys.executable)']).stdout.trim() } });
    assert.equal(d.timeCorrection.applied, true);
  }
});
check('Python reports normalization failure for a missing Node runtime', () => {
  assert.equal(cli('bazi-classic.py', birth, 1, { env: { ...env, NODE: '/no-such-fortune-node' } }).error, 'time_normalization_failed');
});
const temp = mkdtempSync(join(realpathSync(tmpdir()), 'fortune-hardening-'));
try {
  check('hecan declares the real time method and audit rejects conflicting claims', () => {
    const d = cli('hecan-summary.mjs', [...birth, '--from', '2026', '--to', '2026', '--ziwei-years', '2026', '--focus', 'career']);
    assert.equal(d.timeBasis.method, 'local_apparent_solar_time_approximation');
    assert.equal(d.timeBasis.equationOfTimeApplied, true);
    assert.ok(d.timeBasis.principle.includes('地方视太阳时近似'));
    assert.ok(d.timeBasis.principle.includes('已加入 NOAA 均时差近似'));
    assert.ok(!JSON.stringify(d).includes('真太阳时'));
    const file = join(temp, 'hecan.json');
    writeFileSync(file, JSON.stringify(d));
    assert.equal(cli('hecan-audit.mjs', ['--file', file]).ok, true);
    for (const change of [
      { method: 'apparent_solar_time' },
      { equationOfTimeApplied: false },
      { principle: '真太阳时为正式排盘基准' }
    ]) {
      writeFileSync(file, JSON.stringify({ ...d, timeBasis: { ...d.timeBasis, ...change } }));
      const audit = cli('hecan-audit.mjs', ['--file', file], 1);
      assert.ok(audit.findings.some(item => item.id === 'time_basis_principle'));
    }
  });
  const installRoot = join(temp, 'install fixture');
  const bin = join(temp, 'mock-bin');
  const agentRoot = join(temp, 'agents');
  const oldTarget = join(temp, 'old-skill');
  for (const path of [installRoot, bin, oldTarget, join(agentRoot, '.codex/skills')]) mkdirSync(path, { recursive: true });
  // Exercise the installer with local stubs; redirect its platform paths only
  // in this disposable copy. No packages are installed and HOME is untouched.
  writeFileSync(join(installRoot, 'install.sh'), readFileSync(join(root, 'install.sh'), 'utf8').replaceAll('$HOME/', '$FORTUNE_TEST_AGENT_ROOT/'));
  writeFileSync(join(installRoot, 'SKILL.md'), 'name: fortune\n');
  writeFileSync(join(installRoot, 'package.json'), '{}');
  writeFileSync(join(installRoot, 'requirements.txt'), '');
  for (const [name, script] of [
    ['node', '#!/bin/sh\necho 22\n'],
    ['python3', '#!/bin/sh\nexit 0\n'],
    ['npm', '#!/bin/sh\nif [ "$1" = run ]; then echo "verified 31 checks"; exit "$FORTUNE_TEST_VERIFY_EXIT"; fi\nexit 0\n']
  ]) writeFileSync(join(bin, name), script, { mode: 0o755 });
  const link = join(agentRoot, '.codex/skills/fortune');
  symlinkSync(oldTarget, link, 'dir');
  const installEnv = { ...env, PATH: `${bin}:${env.PATH}`, FORTUNE_TEST_AGENT_ROOT: agentRoot };
  check('installer fails if verify fails and replaces old directory symlinks safely', () => {
    const r = run('bash', ['install.sh'], 1, { cwd: installRoot, env: { ...installEnv, FORTUNE_TEST_VERIFY_EXIT: '7', TMPDIR: temp } });
    assert.ok(!r.stdout.includes('安装完成'));
    assert.equal(readlinkSync(link), installRoot);
    assert.equal(existsSync(join(oldTarget, 'install fixture')), false);
  });
  check('installer reports success only after successful verification', () => {
    const r = run('bash', ['install.sh'], 0, { cwd: installRoot, env: { ...installEnv, FORTUNE_TEST_VERIFY_EXIT: '0', TMPDIR: temp } });
    assert.ok(r.stdout.includes('安装完成'));
    assert.ok(r.stdout.includes('31 项'));
  });
  check('invalid calibration shape is rejected before chart generation', () => {
    const file = join(temp, 'calibration.json');
    for (const value of [{ events: 'not-an-array' }, { events: [null] }, { falsePositives: {} }, null]) {
      writeFileSync(file, JSON.stringify(value));
      assert.equal(cli('fortune-report-data.mjs', [...birth, '--calibration-file', file], 1).error, 'invalid_calibration_file');
    }
  });
  const fixture = join(temp, 'privacy');
  mkdirSync(join(fixture, 'scripts'), { recursive: true });
  mkdirSync(join(fixture, 'references'));
  cpSync(join(root, 'scripts/privacy-check.mjs'), join(fixture, 'scripts/privacy-check.mjs'));
  cpSync(join(root, 'references/privacy-policy.json'), join(fixture, 'references/privacy-policy.json'));
  const scan = (code, args = [], extraEnv = {}) => JSON.parse(run(node, ['scripts/privacy-check.mjs', ...args], code, { cwd: fixture, env: { ...env, ...extraEnv } }).stdout);
  check('privacy scan fails closed outside Git or with missing Git', () => {
    assert.equal(scan(1).error, 'git_check_failed');
    assert.equal(scan(1, [], { PATH: '' }).error, 'git_check_failed');
    const d = scan(0, ['--no-git']);
    assert.equal(d.mode, 'policy-only');
    assert.equal(d.contentScanned, false);
  });
  const git = args => run('git', args, 0, { cwd: fixture });
  git(['init', '-q']);
  check('privacy detects nested and Unicode private filenames', () => {
    const name = '中文 目录/.env.local';
    mkdirSync(join(fixture, '中文 目录'));
    writeFileSync(join(fixture, name), 'placeholder');
    git(['add', '--', name]);
    assert.ok(scan(1).findings.some(item => item.file === name));
    git(['rm', '--cached', '-f', '--', name]);
  });
  check('tracked mode scans index content and never exposes matched values', () => {
    const value = ['sk', '-'].join('') + 'x'.repeat(30);
    writeFileSync(join(fixture, 'example.txt'), value);
    git(['add', 'example.txt']);
    writeFileSync(join(fixture, 'example.txt'), 'clean worktree');
    const d = scan(1, ['--tracked']);
    assert.ok(d.findings.some(item => item.type === 'secret_token_shape'));
    assert.ok(!JSON.stringify(d).includes(value.slice(0, 24)));
    git(['add', 'example.txt']);
    assert.equal(scan(0, ['--tracked']).ok, true);
  });
  check('privacy allows removal of an accidentally tracked private report', () => {
    mkdirSync(join(fixture, 'reports'));
    writeFileSync(join(fixture, 'reports/private.txt'), 'fixture');
    git(['add', 'reports/private.txt']);
    assert.equal(scan(1).ok, false);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
    git(['rm', '-f', 'reports/private.txt']);
    assert.equal(scan(0).ok, true);
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log(`verified ${checks} hardening checks`);
