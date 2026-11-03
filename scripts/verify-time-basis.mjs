#!/usr/bin/env node
import { pythonExecutable } from './python-runtime.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, cpSync, mkdtempSync, rmSync, appendFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { CITY_DB } from './city-data.mjs';
import { solarClock, equationOfTimeMinutes, clockParts } from './solar-clock.mjs';
import { calendarBasis } from './calendar-basis.mjs';
import { solarTermBoundaryInfo } from './solar-term-boundary.mjs';
const { Solar } = createRequire(import.meta.url)('lunar-javascript');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const python = pythonExecutable();
const env = { ...process.env, NODE: process.execPath, PYTHON: python };
let count = 0;
function check(name, fn) { fn(); count++; console.log(`ok - ${name}`); }
function run(script, args, code = 0, options = {}) {
  const result = spawnSync(script.endsWith('.py') ? python : process.execPath,
    [join(root, 'scripts', script), ...args], { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 20e6, ...options });
  assert.ifError(result.error);
  assert.equal(result.status, code, `${script}: ${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}
const birth = ['--solar', '1990-05-15', '--hour', '15', '--gender', 'male', '--birthplace', '上海'];
const digest = data => createHash('sha256').update(data).digest('hex');
check('all city zones have hashed pinned data and auditable source rules', () => {
  const data = join(root, 'data/tzdb');
  const manifest = JSON.parse(readFileSync(join(data, 'manifest.json')));
  assert.equal(manifest.version, '2026f');
  for (const zone of new Set(CITY_DB.map(city => city.timezone))) assert.ok(manifest.zones[zone], zone);
  for (const [zone, hash] of Object.entries(manifest.zones)) assert.equal(digest(readFileSync(join(data, zone))), hash);
  assert.equal(digest(readFileSync(join(data, 'tzdata.zi'))), manifest.sourceRulesSha256);
});
check('PEP 495 round trip rejects NY and Shanghai gaps and enumerates folds', () => {
  for (const [date, hour, zone, expected] of [
    ['2024-03-10', 2, 'America/New_York', []],
    ['2024-11-03', 1, 'America/New_York', ['2024-11-03T05:30:00+00:00', '2024-11-03T06:30:00+00:00']],
    ['1991-04-14', 2, 'Asia/Shanghai', []],
    ['1991-09-15', 1, 'Asia/Shanghai', ['1991-09-14T16:30:00+00:00', '1991-09-14T17:30:00+00:00']]
  ]) assert.deepEqual(run('timezone-resolve.py', [date, String(hour), '30', zone], 1).candidates, expected);
});
check('historical seconds and fractional or non-hour DST offsets survive', () => {
  const resolve = (date, zone) => run('timezone-resolve.py', [date, '12', '0', zone]);
  assert.equal(resolve('1900-06-01', 'Asia/Shanghai').offsetSeconds, 29143);
  assert.equal(resolve('2024-01-15', 'Asia/Kathmandu').offsetSeconds, 20700);
  assert.equal(resolve('2024-01-15', 'Australia/Lord_Howe').dstSeconds, 1800);
  assert.equal(resolve('2024-07-15', 'Australia/Lord_Howe').dstSeconds, 0);
  assert.equal(resolve('1980-01-15', 'Asia/Singapore').offsetSeconds, 27000);
  assert.equal(run('timezone-resolve.py', ['2024-10-06', '2', '15', 'Australia/Lord_Howe'], 1).error, 'nonexistent_local_time');
  assert.equal(run('timezone-resolve.py', ['2024-04-07', '1', '45', 'Australia/Lord_Howe'], 1).candidates.length, 2);
  assert.equal(run('timezone-resolve.py', ['2024-01-15', '12', '0', 'Unknown/Zone'], 1).error, 'timezone_resolution_failed');
});
check('tampered TZif fails without OS fallback', () => {
  const temp = mkdtempSync(join(tmpdir(), 'fortune-tzif-'));
  try {
    cpSync(join(root, 'scripts'), join(temp, 'scripts'), { recursive: true });
    cpSync(join(root, 'data'), join(temp, 'data'), { recursive: true });
    appendFileSync(join(temp, 'data/tzdb/Asia/Shanghai'), 'tampered');
    const r = spawnSync(python, [join(temp, 'scripts/timezone-resolve.py'), '2024-01-01', '12', '0', 'Asia/Shanghai'], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).message, 'timezone_data_integrity_error');
    unlinkSync(join(temp, 'data/tzdb/Asia/Shanghai'));
    const missing = spawnSync(python, [join(temp, 'scripts/timezone-resolve.py'), '2024-01-01', '12', '0', 'Asia/Shanghai'], { encoding: 'utf8' });
    assert.equal(missing.status, 1);
    assert.equal(JSON.parse(missing.stdout).error, 'timezone_resolution_failed');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
check('NOAA equation vectors independently evaluated in Python match', () => {
  // Values computed separately from the published coefficients, not chart outputs.
  assert.ok(Math.abs(equationOfTimeMinutes('1990-05-15T06:00:00Z') - 3.9282873563670164) < 1e-10);
  assert.ok(Math.abs(equationOfTimeMinutes('1984-02-29T15:10:00Z') + 12.907868195327312) < 1e-10);
  assert.deepEqual(solarClock('1990-05-15T06:00:00Z', 121.47).apparent, { solar: '1990-05-15', hour: 14, minute: 9, second: 48 });
  for (const [instant, expected] of [['2023-12-31T23:59:00Z', -2.6789544680723876], ['2024-01-01T00:00:00Z', -2.679883221322936], ['2024-02-29T12:00:00Z', -12.930581920147938]]) assert.ok(Math.abs(equationOfTimeMinutes(instant) - expected) < 1e-10);
  assert.throws(() => equationOfTimeMinutes('1800-01-01T00:00:00Z'));
});
check('east/west longitude and solar date rollover use UTC once', () => {
  const instant = '2024-01-01T06:00:00Z';
  assert.equal(solarClock(instant, -180).mean.solar, '2023-12-31');
  assert.equal(solarClock(instant, 180).mean.hour, 18);
  const next = solarClock('2024-01-01T18:00:00Z', 180);
  assert.equal(next.apparent.solar, '2024-01-02');
  assert.equal(clockParts(Date.UTC(2024, 0, 1, 0, 59, 59, 999)).hour, 0);
});
check('term direction keeps seconds before equality rather than rounding to after', () => {
  assert.equal(solarTermBoundaryInfo('2012-09-07', 13, 29, 30, 0).nearest.direction, 'before');
  assert.equal(solarTermBoundaryInfo('2012-09-07', 13, 29, 30, 2).nearest.direction, 'after');
  assert.equal(solarTermBoundaryInfo('2012-09-07', 13, 29, 30, 0).nearest.utc, '2012-09-07T05:29:01.000Z');
});
check('injected Bailu instants switch month while retaining identical solar day/hour', () => {
  const corrected = { solar: '2012-09-07', hour: 13, minute: 33, second: 35 };
  const before = calendarBasis({ corrected, calendarReference: { solar: '2012-09-07', hour: 13, minute: 29, second: 0 } });
  const after = calendarBasis({ corrected, calendarReference: { solar: '2012-09-07', hour: 13, minute: 29, second: 2 } });
  assert.equal(before.getMonth(), '戊申');
  assert.equal(after.getMonth(), '己酉');
  assert.equal(before.getDay(), after.getDay());
  assert.equal(before.getTime(), after.getTime());
  assert.equal(before.getTaiYuan(), Solar.fromYmdHms(2012, 9, 7, 13, 26, 0).getLunar().getEightChar().getTaiYuan());
});
check('Lichun contract changes year on physical term instant, not solar clock', () => {
  const term = Solar.fromYmdHms(2024, 2, 5, 12, 0, 0).getLunar().getPrevJie().getSolar();
  assert.equal(term.getMonth(), 2);
  const label = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour(), term.getMinute(), term.getSecond());
  const corrected = { solar: '2024-02-04', hour: 16, minute: 0, second: 0 };
  const before = calendarBasis({ corrected, calendarReference: clockParts(label - 1000) });
  const after = calendarBasis({ corrected, calendarReference: clockParts(label + 1000) });
  assert.equal(before.getYear(), '癸卯');
  assert.equal(after.getYear(), '甲辰');
});
check('midnight day and late-Zi stem policy are independent of term month', () => {
  const calendarReference = { solar: '2024-06-01', hour: 12, minute: 0, second: 0 };
  const a = calendarBasis({ calendarReference, corrected: { solar: '2024-06-01', hour: 23, minute: 30 } });
  const b = calendarBasis({ calendarReference, corrected: { solar: '2024-06-02', hour: 0, minute: 30 } });
  assert.notEqual(a.getDay(), b.getDay());
  assert.equal(a.getTime(), b.getTime());
  for (const gender of [0, 1]) {
    const physical = Solar.fromYmdHms(2024, 6, 1, 12, 0, 0).getLunar().getEightChar().getYun(gender, 1);
    assert.equal(a.getYun(gender).getStartSolar().toYmdHms(), physical.getStartSolar().toYmdHms());
    assert.equal(b.getYun(gender).getStartSolar().toYmdHms(), physical.getStartSolar().toYmdHms());
  }
});
check('ziwei explicitly preserves forward late-Zi independently of BaZi midnight day', () => {
  const iztro = createRequire(import.meta.url)('iztro');
  iztro.astro.config({ yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward' });
  const late = iztro.astro.astrolabeBySolarDate('2024-6-1', 12, '男');
  const early = iztro.astro.astrolabeBySolarDate('2024-6-2', 0, '男');
  assert.equal(late.earthlyBranchOfSoulPalace, early.earthlyBranchOfSoulPalace);
  assert.equal(late.earthlyBranchOfBodyPalace, early.earthlyBranchOfBodyPalace);
  const stars = chart => chart.palaces.map(p => p.majorStars.map(({ name, type, scope, brightness, mutagen }) => ({ name, type, scope, brightness, mutagen })));
  assert.deepEqual(stars(late), stars(early));
});
for (const script of ['bazi-chart.mjs', 'bazi-classic.py', 'ziwei-chart.mjs']) {
  check(`${script} preserves historical conditional calculation and refuses near-term precision`, () => {
    const historical = run(script, [...birth, '--solar', '1900-06-01', '--hour', '12', '--minute', '30']);
    assert.equal(historical.timeCorrection.precisionGuard.historicalTimezoneAssumption, true);
    assert.equal(historical.timeCorrection.dst.utcOffsetMinutes * 60, 29143);
    assert.ok(historical.timeCorrection.warnings.some(message => message.includes('以城市代表时区规则为条件计算')));
    assert.equal(run(script, [...birth, '--solar', '2012-09-07', '--hour', '13', '--minute', '29'], 1).error, 'solar_term_precision_boundary');
    assert.equal(run(script, [...birth, '--solar', '1984-02-29', '--hour', '23', '--minute', '19', '--birthplace', '当涂'], 1).error, 'approximate_solar_clock_boundary');
    assert.equal(run(script, [...birth, '--solar', '1984-02-29', '--hour', '23', '--minute', '24', '--birthplace', '当涂']).timeCorrection.corrected.hour, 23);
  });
}
check('JS and Python calendars agree across DST, non-hour zones and term correction', () => {
  for (const args of [birth,
    [...birth, '--solar', '2012-09-07', '--hour', '13', '--minute', '26'],
    [...birth, '--solar', '2024-01-15', '--hour', '12', '--birthplace', '加德满都'],
    [...birth, '--solar', '1984-02-29', '--hour', '23', '--minute', '10', '--birthplace', '当涂']]) {
    const js = run('bazi-chart.mjs', args), py = run('bazi-classic.py', args);
    for (const key of ['year', 'month', 'day', 'time']) assert.equal(js.pillars[key].ganZhi, py.pillars[key].ganZhi);
    assert.equal(js.timeCorrection.instant.utc, py.timeCorrection.instant.utc);
    for (const field of ['taiYuan', 'mingGong', 'shenGong']) {
      assert.equal(js.extra[field].ganZhi, py.extra[field]);
      assert.equal(js.extra[field].naYin, py.extra[`${field}NaYin`]);
    }
    assert.deepEqual(js.majorFortune.list.map(({ganZhi, startYear, endYear, startAge, endAge}) => ({ganZhi, startYear, endYear, startAge, endAge})), py.dayun);
  }
});
check('normalization and explicit-year ziwei are host-timezone independent', () => {
  for (const script of ['time-normalize.mjs', 'ziwei-chart.mjs']) {
    const a = run(script, [...birth, '--year', '2026'], 0, { env: { ...env, TZ: 'UTC' } });
    const b = run(script, [...birth, '--year', '2026'], 0, { env: { ...env, TZ: 'America/New_York' } });
    assert.deepEqual(a, b);
  }
});
check('main skill retains original complete BaZi and Ziwei frameworks', () => {
  const skill = readFileSync(join(root, 'SKILL.md'), 'utf8');
  const a = skill.indexOf('## 第三阶段：八字分析'), b = skill.indexOf('## 第五阶段：现实校准', a);
  assert.ok(a >= 0 && b > a);
  // Digest records the complete original HEAD blocks, including all twelve palaces.
  assert.equal(digest(skill.slice(a, b)), '32632a0ddb23d85694ee6532fd8783dde469fe14f11a13444063256cd4009d76');
  for (const term of ['贵人线索分析', '合婚分析', '流年快查', '长期流年与逐月分析', '报告归档工作流', 'bazi', 'ziwei', 'relationship compatibility', '叠加读取']) assert.ok(skill.includes(term), term);
  for (const match of skill.matchAll(/`(references\/[\w.-]+)`/g)) assert.ok(existsSync(join(root, match[1])), match[1]);
});
check('synthetic comprehensive report retains framework evidence inputs', () => {
  const data = run('fortune-report-data.mjs', [...birth, '--from', '2026', '--to', '2026', '--ziwei-years', '2026']);
  for (const path of ['base.pillars', 'base.tenGods', 'base.fiveElements', 'base.majorFortune', 'base.classic.strength', 'base.classic.sanming', 'base.classic.monthComment', 'base.ziwei.soulPalace', 'base.ziwei.bodyPalace', 'base.ziwei.triadAnalysis', 'base.ziwei.mutagenInteractions', 'methodologyFramework', 'reportFramework', 'ruleMatches']) {
    assert.notEqual(path.split('.').reduce((value, key) => value?.[key], data), undefined, path);
  }
  // This checks routing/contracts, not whether a language model actually reads or interprets them.
});
check('historical caveat propagates to hecan judgments and report opening', () => {
  const args = [...birth, '--solar', '1900-06-01', '--hour', '12', '--minute', '30', '--from', '1950', '--to', '1950', '--ziwei-years', '1950'];
  const hecan = run('hecan-summary.mjs', args);
  assert.ok(JSON.stringify(hecan).includes('历史时区待核实'));
  const draft = spawnSync(process.execPath, [join(root, 'scripts/report-draft.mjs'), ...args, '--type', 'main_summary_report'], { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 20e6 });
  assert.equal(draft.status, 0, draft.stderr);
  assert.ok(draft.stdout.includes('历史时区待核实'));
});
console.log(`verified ${count} time and skill contract checks (no model-level effect evaluation)`);
