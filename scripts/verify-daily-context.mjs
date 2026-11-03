#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdtempSync, cpSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { dailyContext } from './daily-context.mjs';
const script = fileURLToPath(new URL('./daily-context.mjs', import.meta.url));
let count = 0;
function check(label, fn) { fn(); console.log(`ok - ${label}`); count++; }
function args(date, hour, location = '北京', minute = 0) {
  return ['--date', date, '--hour', String(hour), '--minute', String(minute), '--location', location];
}
function query(...a) { const out = dailyContext(args(...a)); assert.ok(!out.error, JSON.stringify(out)); return out; }
check('PR example has deterministic day without a fabricated natal chart', () => {
  const x = query('2026-07-05', 12);
  assert.equal(x.pillars.day.ganZhi, '庚辰');
  assert.equal(x.pillars.day.wuXing, '金土');
  assert.equal(x.schemaVersion, 'fortune.dailyContext.v1');
  assert.equal(x.scope, 'query_instant_not_entire_civil_day');
  assert.equal(x.dayMaster, undefined);
});
check('omitted minute equals explicit zero; malformed minute is rejected', () => {
  const base=['--date','2026-07-05','--hour','12','--location','北京'];
  assert.deepEqual(dailyContext(base), dailyContext([...base,'--minute','0']));
  for(const minute of ['-1','60','1.5','5junk']) assert.equal(dailyContext([...base,'--minute',minute]).error,'invalid_time');
  assert.equal(dailyContext([...base,'--minute']).error,'invalid_arguments');
});
check('civil midnight is not solar midnight; sect 2 retains late-Zi day', () => {
  const prev = query('2026-07-05', 0, '北京', 5);
  assert.equal(prev.pillars.day.ganZhi, '己卯');
  assert.equal(prev.timeContext.corrected.solar, '2026-07-04');
  assert.equal(prev.solarDateChanged, true);
  assert.equal(query('2026-07-05', 0, '北京', 30).pillars.day.ganZhi, '庚辰');
  assert.equal(query('2026-07-05', 23, '北京', 30).pillars.day.ganZhi, '庚辰');
});
check('same instant across zones shares physical year/month but local days differ', () => {
  const ny = query('2024-01-15', 12, '纽约');
  const bj = query('2024-01-16', 1, '北京');
  assert.equal(ny.timeContext.instant.utc, bj.timeContext.instant.utc);
  assert.deepEqual(ny.pillars.year, bj.pillars.year);
  assert.deepEqual(ny.pillars.month, bj.pillars.month);
  assert.equal(ny.pillars.day.ganZhi, '戊寅');
  assert.equal(bj.pillars.day.ganZhi, '己卯');
});
check('same civil time in different cities may have different solar dates', () => {
  const bj=query('2026-07-05',1,'北京');
  const west=query('2026-07-05',1,'乌鲁木齐');
  assert.equal(bj.timeContext.corrected.solar,'2026-07-05');
  assert.equal(west.timeContext.corrected.solar,'2026-07-04');
  assert.equal(bj.pillars.day.ganZhi,'庚辰');
  assert.equal(west.pillars.day.ganZhi,'己卯');
});
check('nonintegral timezone resolves without rounding the offset', () => {
  const x = query('2024-01-15', 12, '加德满都');
  assert.equal(x.timeContext.instant.utc, '2024-01-15T06:15:00+00:00');
  assert.equal(x.timeContext.dst.utcOffsetMinutes, 345);
});
check('gap and fold fail closed', () => {
  assert.equal(dailyContext(args('2024-03-10', 2, '纽约', 30)).error, 'nonexistent_local_time');
  assert.equal(dailyContext(args('2024-11-03', 1, '纽约', 30)).error, 'ambiguous_local_time');
});
check('solar-clock and solar-term precision guards reject boundary queries', () => {
  assert.equal(dailyContext(args('2026-07-05', 0, '北京', 20)).error, 'precision_boundary');
  assert.equal(dailyContext(args('2012-09-07', 13, '上海', 29)).error, 'precision_boundary');
  assert.equal(query('2012-09-07', 13, '上海', 26).pillars.month.ganZhi, '戊申');
  assert.equal(query('2012-09-07', 13, '上海', 32).pillars.month.ganZhi, '己酉');
});
check('year boundary and leap day remain calendar-valid', () => {
  assert.equal(query('2024-01-01', 0, '北京', 5).timeContext.corrected.solar, '2023-12-31');
  assert.ok(query('2024-02-29', 12).pillars.day.ganZhi);
  assert.equal(dailyContext(args('2023-02-29', 12)).error, 'invalid_date');
});
check('missing, unknown, duplicated and malformed parameters are rejected', () => {
  assert.equal(dailyContext([]).error, 'missing_param');
  for (const extra of [['--day','1'],['--date','2026-07-06'],['--gender','male']]) {
    assert.equal(dailyContext([...args('2026-07-05',12),...extra]).error,'invalid_arguments');
  }
  assert.equal(dailyContext(args('today',12)).error,'invalid_date');
  assert.equal(dailyContext(args('2026-07-05','12abc')).error,'invalid_time');
  assert.equal(dailyContext(args('2026-07-05',12,'中国')).error,'unknown_city');
  assert.equal(dailyContext(args('2026-07-05',12,' ')).error,'missing_param');
});
check('historical queries preserve conditional assumptions and supported-year limits', () => {
  assert.equal(query('1900-06-01',12,'上海').timeContext.precisionGuard.historicalTimezoneAssumption,true);
  assert.equal(dailyContext(args('1890-06-01',12)).error,'unsupported_solar_time');
});
check('host TZ does not change explicit query and failed Python does not fall back', () => {
  const run = env => spawnSync(process.execPath,[script,...args('2026-07-05',12)],{env:{...process.env,...env},encoding:'utf8'});
  const a=run({TZ:'Pacific/Honolulu'}), b=run({TZ:'Asia/Tokyo'});
  assert.equal(a.status,0); assert.equal(b.status,0); assert.equal(a.stdout,b.stdout);
  const bad=run({PYTHON:'/nonexistent/fortune-python'});
  assert.equal(bad.status,1); assert.ok(JSON.parse(bad.stdout).error);
});
check('import without argv is silent and nonzero CLI failures remain JSON', () => {
  const imported=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('./daily-context.mjs',import.meta.url).href)})`],{encoding:'utf8'});
  assert.equal(imported.status,0); assert.equal(imported.stdout,'');
  const bad=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.equal(bad.status,1); assert.equal(JSON.parse(bad.stdout).error,'missing_param');
});
check('real encoded paths and directory symlinks preserve CLI output', () => {
  const temp=mkdtempSync(join(tmpdir(),'fortune 流日 % # '));
  const root=dirname(dirname(script));
  try {
    const copy=join(temp,'实际 scripts');
    cpSync(join(root,'scripts'),copy,{recursive:true});
    symlinkSync(join(root,'node_modules'),join(temp,'node_modules'),'dir');
    symlinkSync(join(root,'data'),join(temp,'data'),'dir');
    const link=join(temp,'链接 scripts');
    symlinkSync(copy,link,'dir');
    for(const directory of [copy,link]) {
      const result=spawnSync(process.execPath,[join(directory,'daily-context.mjs'),...args('2026-07-05',12)],{encoding:'utf8'});
      assert.equal(result.status,0,result.stderr+result.stdout);
      assert.deepEqual(JSON.parse(result.stdout),query('2026-07-05',12));
    }
  } finally { rmSync(temp,{recursive:true,force:true}); }
});
check('empty, malformed, failed, signaled, oversized and timed-out child results fail closed', () => {
  const temp=mkdtempSync(join(tmpdir(),'fortune-daily-failures-'));
  const root=dirname(dirname(script));
  try {
    const copy=join(temp,'scripts');
    cpSync(join(root,'scripts'),copy,{recursive:true});
    symlinkSync(join(root,'node_modules'),join(temp,'node_modules'),'dir');
    const cases=[
      ['', 'time_normalization_failed'],
      ['console.log("not JSON")','time_normalization_failed'],
      ['console.log(JSON.stringify({error:"fixture_error",message:"fixture failure"}));process.exitCode=2','fixture_error'],
      ['process.kill(process.pid,"SIGTERM")','time_normalization_failed'],
      ['process.stdout.write("x".repeat(2*1024*1024))','time_normalization_failed'],
      ['setInterval(()=>{},1000)','time_normalization_failed']
    ];
    for(const [source,error] of cases) {
      writeFileSync(join(copy,'time-normalize.mjs'),source);
      const result=spawnSync(process.execPath,[join(copy,'daily-context.mjs'),...args('2026-07-05',12)],{encoding:'utf8',timeout:25000});
      assert.ifError(result.error);
      assert.equal(result.status,1,source);
      const output=JSON.parse(result.stdout);
      assert.equal(output.error,error,source);
      assert.equal(output.pillars,undefined);
    }
  } finally { rmSync(temp,{recursive:true,force:true}); }
});
check('skill has an explicit daily route and preserves full analysis framework', () => {
  const skill=readFileSync(new URL('../SKILL.md',import.meta.url),'utf8');
  for(const text of ['今日运势','daily fortune','scripts/daily-context.mjs','查询地','不能代表全天','## 第三阶段：八字分析','## 第四阶段：紫微斗数分析']) assert.ok(skill.includes(text),text);
});
console.log(`verified ${count} daily context checks`);
