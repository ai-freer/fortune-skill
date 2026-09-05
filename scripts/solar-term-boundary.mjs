#!/usr/bin/env node
/**
 * solar-term-boundary.mjs — 节气边界提示 helper。
 *
 * 只做 warning，不改排盘结果。八字月柱以节气为界，出生时间接近“节”时
 * 需要在报告中保守说明月令/月柱敏感。
 */

import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Solar } = require('lunar-javascript');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { thresholdMinutes: 30 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--solar' && args[i + 1]) opts.solar = args[++i];
    else if (args[i] === '--hour' && args[i + 1]) opts.hour = parseInt(args[++i], 10);
    else if (args[i] === '--minute' && args[i + 1]) opts.minute = parseInt(args[++i], 10);
    else if (args[i] === '--threshold' && args[i + 1]) opts.thresholdMinutes = parseInt(args[++i], 10);
  }
  return opts;
}

function parseSolarDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) {
    throw new Error('日期格式错误，请使用 YYYY-MM-DD');
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function solarToDate(solar) {
  const [datePart, timePart] = solar.toYmdHms().split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, second || 0);
}

function jieQiSnapshot(jieQi) {
  if (!jieQi) return null;
  const solar = jieQi.getSolar();
  return {
    name: jieQi.getName(),
    solar: solar.toYmdHms(),
    isJie: jieQi.isJie(),
    isQi: jieQi.isQi()
  };
}

export function solarTermBoundaryInfo(solarDate, hour, minute = 0, thresholdMinutes = 30) {
  const { year, month, day } = parseSolarDate(solarDate);
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const current = new Date(year, month - 1, day, hour, minute, 0);
  const prevJie = lunar.getPrevJie(false);
  const nextJie = lunar.getNextJie(false);
  const candidates = [prevJie, nextJie]
    .filter(Boolean)
    .map(jieQi => {
      const jieDate = solarToDate(jieQi.getSolar());
      const diffMinutes = Math.round((current.getTime() - jieDate.getTime()) / 60000);
      return {
        ...jieQiSnapshot(jieQi),
        diffMinutes,
        absDiffMinutes: Math.abs(diffMinutes),
        direction: diffMinutes >= 0 ? 'after' : 'before'
      };
    })
    .sort((a, b) => a.absDiffMinutes - b.absDiffMinutes);
  const nearest = candidates[0] || null;
  return {
    checked: true,
    thresholdMinutes,
    near: Boolean(nearest && nearest.absDiffMinutes <= thresholdMinutes),
    nearest,
    previousJie: jieQiSnapshot(prevJie),
    nextJie: jieQiSnapshot(nextJie),
    note: nearest && nearest.absDiffMinutes <= thresholdMinutes
      ? '出生时间接近节气交界，八字月令/月柱对分钟误差敏感；报告需保守说明，必要时复核出生时间。'
      : '未接近节气交界。'
  };
}

function main() {
  try {
    const opts = parseArgs();
    if (!opts.solar || opts.hour === undefined) throw new Error('缺少 --solar 或 --hour');
    const result = solarTermBoundaryInfo(opts.solar, opts.hour, opts.minute || 0, opts.thresholdMinutes);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: 'solar_term_boundary_error', message: error.message }, null, 2) + '\n');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
