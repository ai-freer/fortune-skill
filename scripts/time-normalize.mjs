#!/usr/bin/env node
/**
 * time-normalize.mjs — 时间校正脚本（夏令时 + 真太阳时）
 *
 * 用法: node time-normalize.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] --birthplace "城市名"
 * 输出: JSON 到 stdout，日志到 stderr
 *
 * 校正流程:
 *   1. 出生地 → 时区 + 经度
 *   2. 夏令时检测（IANA tz database via Intl API）
 *   3. 真太阳时校正（经度差 × 4 分钟/度）
 *   4. 校正后时间 → 时辰
 */

import { pathToFileURL } from 'url';
import { findCity, TZ_STANDARD_LONGITUDE } from './city-data.mjs';
import { solarTermBoundaryInfo } from './solar-term-boundary.mjs';

// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { minute: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--solar' && args[i + 1]) opts.solar = args[++i];
    else if (args[i] === '--hour' && args[i + 1]) opts.hour = parseInt(args[++i], 10);
    else if (args[i] === '--minute' && args[i + 1]) opts.minute = parseInt(args[++i], 10);
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
// 利用 Intl.DateTimeFormat 的 resolvedOptions 和 UTC offset 差异来检测 DST
export function normalizeIntlDateTimeParts(parts) {
  const value = type => parts.find(p => p.type === type)?.value;
  const localYear = parseInt(value('year'), 10);
  const localMonth = parseInt(value('month'), 10);
  const localDay = parseInt(value('day'), 10);
  const rawHour = parseInt(value('hour'), 10);
  const localMinute = parseInt(value('minute'), 10);

  return {
    localYear,
    localMonth,
    localDay,
    localHour: rawHour === 24 ? 0 : rawHour,
    localMinute,
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
    0
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
  const { year, month, day } = parseSolarDate(dateStr);

  // 获取该日期的 offset
  const targetOffset = getUTCOffset(year, month, day, hour, minute, timezone);

  // 获取 1 月和 7 月的 offset 来确定标准时间 offset
  const janOffset = getUTCOffset(year, 1, 15, 12, 0, timezone);
  const julOffset = getUTCOffset(year, 7, 15, 12, 0, timezone);

  // 标准时间 offset 是较小的那个（北半球 1 月是标准时间，南半球 7 月是标准时间）
  const standardOffset = Math.min(janOffset, julOffset);
  const dstOffset = Math.max(janOffset, julOffset);

  const isDST = targetOffset > standardOffset;
  const dstShift = isDST ? (targetOffset - standardOffset) : 0;

  // 生成说明
  let note = '';
  if (isDST) {
    // 中国特殊说明
    if (timezone === 'Asia/Shanghai' && year >= 1986 && year <= 1991) {
      note = `中国 1986-1991 夏令时（4月中旬-9月中旬，+1h）`;
    } else if (timezone.startsWith('America/')) {
      note = `美国夏令时 (DST +${dstShift / 60}h)`;
    } else if (timezone.startsWith('Europe/')) {
      note = `欧洲夏令时 (DST +${dstShift / 60}h)`;
    } else if (timezone.startsWith('Australia/')) {
      note = `澳洲夏令时 (DST +${dstShift / 60}h)`;
    } else {
      note = `夏令时 (DST +${dstShift / 60}h)`;
    }
  }

  return {
    active: isDST,
    offset: isDST ? dstShift / 60 : 0, // hours
    offsetMinutes: dstShift, // minutes
    standardOffsetMinutes: standardOffset,
    note
  };
}

// ─── 真太阳时校正 ───────────────────────────────────────────
function calcTrueSolarTimeCorrection(longitude, timezone) {
  const stdLon = TZ_STANDARD_LONGITUDE[timezone];
  if (stdLon === undefined) return null;

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

// ─── 应用校正 ───────────────────────────────────────────────
function applyCorrections(dateStr, hour, minute, dstResult, solarTimeResult) {
  let totalMinutes = hour * 60 + minute;
  const { year, month, day } = parseSolarDate(dateStr);

  // 1. 减去 DST 偏移（DST 时钟拨快了，要减回去）
  if (dstResult.active) {
    totalMinutes -= dstResult.offsetMinutes;
  }

  // 2. 加上真太阳时校正
  if (solarTimeResult) {
    totalMinutes += solarTimeResult.correctionMinutes;
  }

  totalMinutes = Math.round(totalMinutes);

  // 处理跨日
  let correctedDate = new Date(year, month - 1, day);
  if (totalMinutes < 0) {
    // 前一天
    correctedDate.setDate(correctedDate.getDate() - 1);
    totalMinutes += 24 * 60;
  } else if (totalMinutes >= 24 * 60) {
    // 后一天
    correctedDate.setDate(correctedDate.getDate() + 1);
    totalMinutes -= 24 * 60;
  }

  const correctedHour = Math.floor(totalMinutes / 60);
  const correctedMinute = totalMinutes % 60;

  const correctedSolar = `${correctedDate.getFullYear()}-${String(correctedDate.getMonth() + 1).padStart(2, '0')}-${String(correctedDate.getDate()).padStart(2, '0')}`;

  return {
    solar: correctedSolar,
    hour: correctedHour,
    minute: correctedMinute,
    shichen: hourToShichen(correctedHour)
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

  // 确定时区
  let timezone;
  let longitude = null;

  if (city) {
    timezone = city.timezone;
    longitude = city.longitude;
  } else {
    // 城市不在表中：假设中国城市用 Asia/Shanghai，跳过真太阳时
    // 检查是否可能是中国城市（包含中文字符）
    const hasChinese = /[\u4e00-\u9fff]/.test(opts.birthplace);
    if (hasChinese) {
      timezone = 'Asia/Shanghai';
      warnings.push(`城市"${opts.birthplace}"不在内置城市表中，默认使用 Asia/Shanghai 时区，跳过真太阳时校正`);
    } else {
      fail('unknown_city', `城市"${opts.birthplace}"不在内置城市表中，无法确定时区。请使用主要城市名称。`, opts);
    }
  }

  // DST 检测
  const dst = detectDST(opts.solar, opts.hour, opts.minute, timezone);

  // 真太阳时校正
  let trueSolarTime = null;
  if (longitude !== null) {
    trueSolarTime = calcTrueSolarTimeCorrection(longitude, timezone);
    if (!trueSolarTime) {
      warnings.push(`时区 ${timezone} 的标准经度未配置，跳过真太阳时校正`);
    }
  }

  // 应用校正
  const corrected = applyCorrections(opts.solar, opts.hour, opts.minute, dst, trueSolarTime);
  const solarTermBoundary = solarTermBoundaryInfo(corrected.solar, corrected.hour, corrected.minute);
  if (solarTermBoundary.near && solarTermBoundary.nearest) {
    warnings.push(`接近节气${solarTermBoundary.nearest.name}，相差约 ${solarTermBoundary.nearest.absDiffMinutes} 分钟，月令/月柱需保守复核`);
  }

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
    dst: {
      active: dst.active,
      offset: dst.offset,
      note: dst.note
    },
    trueSolarTime: trueSolarTime ? {
      longitude: trueSolarTime.longitude,
      standardLongitude: trueSolarTime.standardLongitude,
      correction: trueSolarTime.correction
    } : null,
    corrected,
    boundary: {
      original: shichenBoundaryInfo(opts.hour, opts.minute),
      corrected: shichenBoundaryInfo(corrected.hour, corrected.minute)
    },
    solarTermBoundary,
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
