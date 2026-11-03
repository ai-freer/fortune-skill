#!/usr/bin/env node
/**
 * time-normalize.mjs — 时间校正脚本（夏令时 + 地方平太阳时）
 *
 * 用法: node time-normalize.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] --birthplace "城市名"
 * 输出: JSON 到 stdout，日志到 stderr
 *
 * 校正流程:
 *   1. 出生地 → 时区 + 经度
 *   2. 民用时间解析（固定版本 IANA TZif + Python 标准库）
 *   3. 太阳时近似（UTC + 东经 × 4 分钟/度 + NOAA 均时差）
 *   4. 校正后时间 → 时辰
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { solarClock, clockParts } from './solar-clock.mjs';
import { isMain } from './cli-entrypoint.mjs';
import { parseInteger } from './cli-input.mjs';
import { findCity } from './city-data.mjs';
import { solarTermBoundaryInfo } from './solar-term-boundary.mjs';

// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { minute: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--solar' && args[i + 1]) opts.solar = args[++i];
    else if (args[i] === '--hour' && args[i + 1]) opts.hour = parseInteger(args[++i]);
    else if (args[i] === '--minute' && args[i + 1]) opts.minute = parseInteger(args[++i]);
    else if (args[i] === '--birthplace' && args[i + 1]) opts.birthplace = args[++i];
  }
  return opts;
}

function fail(error, message, input) {
  process.stdout.write(JSON.stringify({ error, message, input }, null, 2) + '\n');
  process.exit(1);
}

function parseSolarDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) {
    fail('invalid_date', '日期格式错误，请使用 YYYY-MM-DD', dateStr);
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    fail('invalid_date', '日期不存在，请检查年月日', dateStr);
  }

  return { year, month, day };
}

// ─── DST 检测 ───────────────────────────────────────────────
// Legacy Intl formatting helpers retained for import compatibility only.
// Chart normalization below uses the pinned TZif resolver, never these helpers.
export function normalizeIntlDateTimeParts(parts) {
  const value = type => parts.find(p => p.type === type)?.value;
  const localYear = parseInt(value('year'), 10);
  const localMonth = parseInt(value('month'), 10);
  const localDay = parseInt(value('day'), 10);
  const rawHour = parseInt(value('hour'), 10);
  const localMinute = parseInt(value('minute'), 10);
  const localSecond = Number(value('second') || 0);

  return {
    localYear,
    localMonth,
    localDay,
    localHour: rawHour === 24 ? 0 : rawHour,
    localMinute,
    localSecond,
    hourWas24: rawHour === 24
  };
}

export function getUTCOffsetParts(y, m, d, h, minute, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });

  const utcDate = new Date(Date.UTC(y, m - 1, d, h, minute, 0));
  const parts = formatter.formatToParts(utcDate);
  const normalized = normalizeIntlDateTimeParts(parts);
  const localDate = new Date(Date.UTC(
    normalized.localYear,
    normalized.localMonth - 1,
    normalized.localDay,
    normalized.localHour,
    normalized.localMinute,
    normalized.localSecond
  ));
  const diffMs = localDate.getTime() - utcDate.getTime();
  return {
    ...normalized,
    offsetMinutes: diffMs / (60 * 1000)
  };
}

export function getUTCOffset(y, m, d, h, minute, timezone) {
  return getUTCOffsetParts(y, m, d, h, minute, timezone).offsetMinutes;
}

export function detectDST(dateStr, hour, minute, timezone) {
  const result = spawnSync(process.env.PYTHON || 'python3',
    [fileURLToPath(new URL('./timezone-resolve.py', import.meta.url)), dateStr,
      String(hour), String(minute), timezone], { encoding: 'utf8', timeout: 10000 });
  let data;
  try { data = JSON.parse(result.stdout || '{}'); } catch { data = {}; }
  if (result.status !== 0 || data.error || !data.utcInstant) {
    const error = new Error(data.error === 'ambiguous_local_time'
      ? `当地钟表时间重复，须核实对应 UTC 瞬时：${(data.candidates || []).join(', ')}`
      : data.error === 'nonexistent_local_time' ? '当地钟表时间不存在，请核实输入'
      : '固定时区数据解析失败，请检查 Python 3.9+ 和数据完整性');
    error.code = data.error || 'timezone_error';
    throw error;
  }
  return { active: data.dstSeconds !== 0, offset: data.dstSeconds / 3600,
    offsetMinutes: data.dstSeconds / 60, standardOffsetMinutes: data.standardOffsetSeconds / 60,
    utcOffsetMinutes: data.offsetSeconds / 60, utcInstant: data.utcInstant,
    tzdbVersion: data.tzdbVersion, tzifSha256: data.tzifSha256,
    note: `IANA ${data.tzdbVersion}; DST ${data.dstSeconds} seconds` };
}

// ─── 地方平太阳时校正 ───────────────────────────────────────────
function calcLocalMeanSolarTimeCorrection(longitude, standardOffsetMinutes) {
  // The historical offset comes from IANA, rather than today's fixed meridian.
  const stdLon = standardOffsetMinutes / 4;

  const diff = longitude - stdLon; // 正 = 偏东，负 = 偏西
  const correctionMinutes = diff * 4; // 每度 4 分钟

  return {
    longitude,
    standardLongitude: stdLon,
    correctionMinutes,
    correction: `${correctionMinutes >= 0 ? '+' : ''}${correctionMinutes.toFixed(2)}min`
  };
}

// ─── 时辰计算 ───────────────────────────────────────────────
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function hourToShichen(hour) {
  // 23:00-00:59 → 子, 01:00-02:59 → 丑, ...
  if (hour === 23) return '子';
  return SHICHEN[Math.floor((hour + 1) / 2)];
}

function shichenBoundaryInfo(hour, minute) {
  const total = hour * 60 + minute;
  const boundaries = [
    { minute: 60, label: '丑' },
    { minute: 180, label: '寅' },
    { minute: 300, label: '卯' },
    { minute: 420, label: '辰' },
    { minute: 540, label: '巳' },
    { minute: 660, label: '午' },
    { minute: 780, label: '未' },
    { minute: 900, label: '申' },
    { minute: 1020, label: '酉' },
    { minute: 1140, label: '戌' },
    { minute: 1260, label: '亥' },
    { minute: 1380, label: '子' }
  ];
  const prev = [...boundaries].reverse().find(b => total >= b.minute) || { minute: -60, label: '子' };
  const next = boundaries.find(b => total < b.minute) || { minute: 1500, label: '丑' };
  return {
    minutesSincePreviousBoundary: total - prev.minute,
    minutesToNextBoundary: next.minute - total,
    previousBoundaryShichen: prev.label,
    nextBoundaryShichen: next.label,
    nearBoundary: Math.min(total - prev.minute, next.minute - total) <= 15
  };
}

// ─── 主逻辑 ─────────────────────────────────────────────────
function main() {
  const opts = parseArgs();

  // 验证参数
  if (!opts.solar) fail('missing_param', '缺少 --solar 参数，格式 YYYY-MM-DD', opts);
  parseSolarDate(opts.solar);
  if (opts.hour === undefined || isNaN(opts.hour) || opts.hour < 0 || opts.hour > 23) {
    fail('invalid_hour', '--hour 必须为 0-23 的整数', opts);
  }
  if (opts.minute !== undefined && (isNaN(opts.minute) || opts.minute < 0 || opts.minute > 59)) {
    fail('invalid_minute', '--minute 必须为 0-59 的整数', opts);
  }
  if (!opts.birthplace) fail('missing_param', '缺少 --birthplace 参数', opts);

  const city = findCity(opts.birthplace);
  const warnings = [];

  if (!city) {
    fail('unknown_city', `城市"${opts.birthplace}"不在内置城市表中，无法确定出生地时区和经度。请提供可识别的城市名称。`, opts);
  }
  const { timezone, longitude } = city;

  // DST 检测
  let dst;
  try {
    dst = detectDST(opts.solar, opts.hour, opts.minute, timezone);
  } catch (error) {
    fail(error.code || 'timezone_error', error.message, opts);
  }

  // Keep the historical JSON key; the method is explicitly local mean solar time.
  const trueSolarTime = calcLocalMeanSolarTimeCorrection(longitude, dst.standardOffsetMinutes);

  // One physical instant drives both clocks. Never round across a boundary.
  let solar;
  try { solar = solarClock(dst.utcInstant, longitude); }
  catch (error) { fail('unsupported_solar_time', error.message, opts); }
  const corrected = { ...solar.apparent, shichen: hourToShichen(solar.apparent.hour) };
  const beijing = clockParts(new Date(dst.utcInstant).getTime() + 8 * 3600000);
  const solarTermBoundary = solarTermBoundaryInfo(beijing.solar, beijing.hour, beijing.minute, 30, beijing.second);
  solarTermBoundary.timeBasis = 'UTC+08:00';
  solarTermBoundary.calendarBoundaryConflict = false;
  warnings.push(solar.precision);
  if (Number(opts.solar.slice(0, 4)) < 1970) warnings.push('1970 年以前 IANA 记录覆盖不完整；本结果以城市代表时区规则为条件计算，需核实出生地点当时实际钟表制度，不是唯一确定的历史命盘。');
  if (solarTermBoundary.near && solarTermBoundary.nearest) {
    warnings.push(`接近节气${solarTermBoundary.nearest.name}，相差约 ${solarTermBoundary.nearest.absDiffMinutes} 分钟，月令/月柱需保守复核`);
  }

  const dayMinute = corrected.hour * 60 + corrected.minute + corrected.second / 60;
  const boundary = shichenBoundaryInfo(corrected.hour, corrected.minute + corrected.second / 60);
  const clockBoundaryDistance = Math.min(boundary.minutesSincePreviousBoundary,
    boundary.minutesToNextBoundary, dayMinute, 1440 - dayMinute);
  const precisionGuard = {
    marginMinutes: 2,
    historicalTimezoneAssumption: Number(opts.solar.slice(0, 4)) < 1970,
    reason: clockBoundaryDistance <= 2 ? 'approximate_solar_clock_boundary'
      : solarTermBoundary.nearest?.absDiffMinutes <= 2 ? 'solar_term_precision_boundary' : null,
    note: '2 分钟是项目保守拒绝窗口，并非 NOAA 算法或节气库的已证明误差界；窗口外仍须保留近似说明。'
  };
  // 原始时辰
  const originalShichen = hourToShichen(opts.hour);

  // 组装输出
  const output = {
    input: {
      solar: opts.solar,
      hour: opts.hour,
      minute: opts.minute,
      birthplace: opts.birthplace
    },
    city: city ? { name: city.name, province: city.province || null } : null,
    timezone,
    instant: { utc: dst.utcInstant, tzdbVersion: dst.tzdbVersion, tzifSha256: dst.tzifSha256 },
    calendarReference: beijing,
    calendarPolicy: {
      version: 'utc-instant-v1', yearMonth: 'actual instant, solar terms in UTC+08:00',
      dayTime: 'local apparent solar clock; EightChar sect=2, midnight day; late-Zi hour stem uses following day',
      dayun: 'actual instant in UTC+08:00; library sect=1 traditional shichen discretization',
      ziwei: 'local apparent calendar date and shichen; iztro normal year, forward late-Zi'
    },
    dst: {
      active: dst.active,
      offset: dst.offset,
      note: dst.note,
      utcOffsetMinutes: dst.utcOffsetMinutes
    },
    trueSolarTime: trueSolarTime ? {
      method: 'local_apparent_solar_time_approximation',
      equationOfTimeApplied: true,
      equationOfTime: solar,
      longitude: trueSolarTime.longitude,
      standardLongitude: trueSolarTime.standardLongitude,
      correction: trueSolarTime.correction,
      correctionMeaning: 'legacy longitude-only correction relative to standard meridian; excludes DST and equation of time',
      totalCorrectionMinutes: longitude * 4 - dst.utcOffsetMinutes + solar.equationOfTimeMinutes
    } : null,
    corrected,
    boundary: {
      original: shichenBoundaryInfo(opts.hour, opts.minute),
      corrected: shichenBoundaryInfo(corrected.hour, corrected.minute + corrected.second / 60)
    },
    solarTermBoundary,
    precisionGuard,
    original: {
      hour: opts.hour,
      minute: opts.minute,
      shichen: originalShichen
    },
    shichenChanged: corrected.shichen !== originalShichen,
    warnings: warnings.length > 0 ? warnings : undefined
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

if (isMain(import.meta.url)) {
  main();
}
