#!/usr/bin/env node
/**
 * ziwei-chart.mjs — 紫微斗数排盘脚本（基于 iztro）
 *
 * 用法: node ziwei-chart.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace "城市名" [--year <YYYY>] [--lang zh-CN]
 * 输出: JSON 到 stdout，日志到 stderr
 *
 * --year <YYYY>: 流年快查模式，只输出该年的流年运势数据
 */

import { parseInteger } from './cli-input.mjs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { attachSchemaValidation, validateZiweiOutput } from './schema-validators.mjs';

const require = createRequire(import.meta.url);
const iztro = require('iztro');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--solar' && args[i + 1]) opts.solar = args[++i];
    else if (args[i] === '--hour' && args[i + 1]) opts.hour = parseInteger(args[++i]);
    else if (args[i] === '--minute' && args[i + 1]) opts.minute = parseInteger(args[++i]);
    else if (args[i] === '--gender' && args[i + 1]) opts.gender = args[++i];
    else if (args[i] === '--birthplace' && args[i + 1]) opts.birthplace = args[++i];
    else if (args[i] === '--year' && args[i + 1]) opts.year = parseInteger(args[++i]);
    else if (args[i] === '--lang' && args[i + 1]) opts.lang = args[++i];
  }
  if (opts.minute === undefined) opts.minute = 0;
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

// ─── 时间校正 ───────────────────────────────────────────────
function normalizeTime(solar, hour, minute, birthplace) {
  try {
    const scriptPath = join(__dirname, 'time-normalize.mjs');
    const args = ['--solar', solar, '--hour', String(hour), '--minute', String(minute), '--birthplace', birthplace];
    const result = execFileSync(process.execPath, [scriptPath, ...args], {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result.trim());
  } catch (e) {
    console.error(`[ziwei-chart] 时间校正失败: ${e.message}`);
    return null;
  }
}

// ─── 24h → 时辰索引（iztro 使用 0-12） ─────────────────────
function hourToShichen(hour, minute = 0) {
  void minute;
  if (hour === 23) return 12;  // 晚子时
  if (hour >= 0 && hour < 1) return 0;   // 早子时
  return Math.floor((hour + 1) / 2);
}

const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子'];
const SHICHEN_RANGES = [
  '23:00~01:00', '01:00~03:00', '03:00~05:00', '05:00~07:00',
  '07:00~09:00', '09:00~11:00', '11:00~13:00', '13:00~15:00',
  '15:00~17:00', '17:00~19:00', '19:00~21:00', '21:00~23:00', '23:00~01:00'
];

// ─── 序列化宫位数据 ─────────────────────────────────────────
function serializeStar(star) {
  return {
    name: star.name,
    type: star.type,
    scope: star.scope,
    brightness: star.brightness || null,
    mutagen: star.mutagen || null
  };
}

function serializePalace(palace) {
  return {
    index: palace.index,
    name: palace.name,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
    isBodyPalace: palace.isBodyPalace,
    majorStars: palace.majorStars.map(serializeStar),
    minorStars: palace.minorStars.map(serializeStar),
    adjectiveStars: palace.adjectiveStars.map(serializeStar),
    changsheng12: palace.changsheng12,
    boshi12: palace.boshi12,
    jiangqian12: palace.jiangqian12,
    suiqian12: palace.suiqian12,
    decadal: palace.decadal,
    ages: palace.ages
  };
}

const MUTAGEN_TYPES = ['化禄', '化权', '化科', '化忌'];

function findStarPalace(palaces, starName) {
  if (!palaces || !starName) return null;
  for (const palace of palaces) {
    const allStars = [
      ...(palace.majorStars || []),
      ...(palace.minorStars || []),
      ...(palace.adjectiveStars || [])
    ];
    const star = allStars.find(s => s.name === starName);
    if (star) {
      return {
        palaceIndex: palace.index,
        palaceName: palace.name,
        heavenlyStem: palace.heavenlyStem,
        earthlyBranch: palace.earthlyBranch,
        star: serializeStar(star)
      };
    }
  }
  return null;
}

function summarizeMutagenPalaces(mutagen, palaces) {
  return (mutagen || []).map((starName, index) => ({
    type: MUTAGEN_TYPES[index] || `四化${index + 1}`,
    starName,
    palace: findStarPalace(palaces, starName)
  }));
}

function palaceSummary(palace) {
  if (!palace) return null;
  return {
    index: palace.index,
    name: palace.name,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
    majorStars: (palace.majorStars || []).map(serializeStar),
    minorStarNames: (palace.minorStars || []).map(star => star.name),
    adjectiveStarNames: (palace.adjectiveStars || []).map(star => star.name)
  };
}

function buildTriadAnalysis(palaces, horoscopeSummary = null) {
  if (!palaces?.length) return [];
  const byIndex = new Map(palaces.map(palace => [palace.index, palace]));
  const mutagens = [
    ...(horoscopeSummary?.decadal?.mutagenPalaces || []).map(item => ({ scope: '大限', ...item })),
    ...(horoscopeSummary?.yearly?.mutagenPalaces || []).map(item => ({ scope: '流年', ...item })),
    ...(horoscopeSummary?.monthly?.mutagenPalaces || []).map(item => ({ scope: '流月', ...item })),
    ...(horoscopeSummary?.daily?.mutagenPalaces || []).map(item => ({ scope: '流日', ...item }))
  ];

  return palaces.map(palace => {
    const triadIndexes = [(palace.index + 4) % 12, (palace.index + 8) % 12];
    const oppositeIndex = (palace.index + 6) % 12;
    const involvedIndexes = new Set([palace.index, ...triadIndexes, oppositeIndex]);
    return {
      palace: palaceSummary(palace),
      triad: triadIndexes.map(index => palaceSummary(byIndex.get(index))),
      opposite: palaceSummary(byIndex.get(oppositeIndex)),
      involvedPalaceNames: [...involvedIndexes].map(index => byIndex.get(index)?.name).filter(Boolean),
      mutagensInTriad: mutagens.filter(item => involvedIndexes.has(item.palace?.palaceIndex))
    };
  });
}

function collectMutagens(horoscopeSummary = null) {
  return [
    ...(horoscopeSummary?.decadal?.mutagenPalaces || []).map(item => ({ scope: '大限', ...item })),
    ...(horoscopeSummary?.yearly?.mutagenPalaces || []).map(item => ({ scope: '流年', ...item })),
    ...(horoscopeSummary?.monthly?.mutagenPalaces || []).map(item => ({ scope: '流月', ...item })),
    ...(horoscopeSummary?.daily?.mutagenPalaces || []).map(item => ({ scope: '流日', ...item }))
  ].filter(item => item.palace);
}

function buildMutagenInteractions(horoscopeSummary = null) {
  const mutagens = collectMutagens(horoscopeSummary);
  const byPalace = new Map();
  for (const item of mutagens) {
    const key = item.palace.palaceIndex;
    if (!byPalace.has(key)) byPalace.set(key, []);
    byPalace.get(key).push(item);
  }

  const interactions = [];
  for (const items of byPalace.values()) {
    const palace = items[0].palace;
    const types = items.map(item => item.type);
    const has = type => types.includes(type);
    const jiCount = items.filter(item => item.type === '化忌').length;
    if (jiCount >= 2) {
      interactions.push({
        type: '双忌叠加',
        palaceName: palace.palaceName,
        palaceIndex: palace.palaceIndex,
        items,
        note: '同一宫位被多个层级化忌引动，相关领域问题更集中，需重点看现实承接和避险。'
      });
    }
    if (has('化禄') && has('化忌')) {
      interactions.push({
        type: '禄忌交战',
        palaceName: palace.palaceName,
        palaceIndex: palace.palaceIndex,
        items,
        note: '同一领域同时有机会和纠缠，常见为先有资源/收益，再有代价、拖延或损耗。'
      });
    }
    if (has('化权') && has('化忌')) {
      interactions.push({
        type: '权忌同宫',
        palaceName: palace.palaceName,
        palaceIndex: palace.palaceIndex,
        items,
        note: '主导权与阻力同在，适合争取名分，但不宜硬碰规则或强行推进。'
      });
    }
    if (has('化科') && has('化忌')) {
      interactions.push({
        type: '科忌同宫',
        palaceName: palace.palaceName,
        palaceIndex: palace.palaceIndex,
        items,
        note: '文书、名誉、资质、考试或表达中有修正压力，需重视材料、合规和沟通。'
      });
    }
  }
  return interactions;
}

const DOMAIN_PALACES = {
  career: { label: '事业/官禄', palaces: ['事业', '官禄'], keywords: ['岗位', '组织', '事业', '名分', '职责'] },
  migration: { label: '迁移/城市', palaces: ['迁移'], keywords: ['外部平台', '跨城', '出差', '迁移', '贵人'] },
  wealth: { label: '财帛/兑现', palaces: ['财帛'], keywords: ['收入', '预算', '投资', '现金流', '兑现'] },
  relationship: { label: '伴侣/合作', palaces: ['夫妻'], keywords: ['伴侣', '合作', '关系', '合伙', '亲密关系'] },
  home: { label: '田宅/家庭资产', palaces: ['田宅'], keywords: ['居住', '房产', '家庭资产', '产权', '文书'] },
  health: { label: '疾厄/健康', palaces: ['疾厄'], keywords: ['健康', '睡眠', '压力', '恢复', '身心'] },
  study: { label: '学业/文书', palaces: ['父母', '官禄', '事业'], keywords: ['学业', '考试', '导师', '文书', '资质'] }
};

function scoreMutagen(type) {
  if (type === '化禄') return 2;
  if (type === '化权') return 1;
  if (type === '化科') return 1;
  if (type === '化忌') return -2;
  return 0;
}

function levelFromScore(score, hasInteraction) {
  if (hasInteraction && score <= 0) return '高压';
  if (score >= 3) return '较强';
  if (score >= 1) return '中性偏有利';
  if (score === 0) return '中性';
  if (score <= -3) return '明显压力';
  return '中性偏压';
}

function buildDomainScores(triadAnalysis = [], mutagenInteractions = []) {
  const result = {};
  for (const [domain, config] of Object.entries(DOMAIN_PALACES)) {
    const relatedTriads = triadAnalysis.filter(item => {
      const names = item.involvedPalaceNames || [];
      return config.palaces.some(name => names.includes(name));
    });
    const mutagens = relatedTriads.flatMap(item => item.mutagensInTriad || []);
    const relatedInteractions = mutagenInteractions.filter(item => {
      const palaceName = item.palaceName || '';
      return relatedTriads.some(triad => (triad.involvedPalaceNames || []).includes(palaceName));
    });
    const rawScore = mutagens.reduce((sum, item) => sum + scoreMutagen(item.type), 0);
    result[domain] = {
      label: config.label,
      score: Math.max(1, Math.min(5, 3 + rawScore - Math.min(2, relatedInteractions.length))),
      tendency: levelFromScore(rawScore, relatedInteractions.length > 0),
      keywords: config.keywords,
      mutagens: mutagens.map(item => ({
        scope: item.scope,
        type: item.type,
        starName: item.starName,
        palaceName: item.palace?.palaceName || null
      })),
      interactions: relatedInteractions.map(item => ({
        type: item.type,
        palaceName: item.palaceName,
        note: item.note
      }))
    };
  }
  return result;
}

function summarizeHoroscope(horoscope, palaces = null) {
  if (!horoscope) return null;
  const summarize = (scope) => scope ? {
    heavenlyStem: scope.heavenlyStem,
    earthlyBranch: scope.earthlyBranch,
    palaceNames: scope.palaceNames,
    mutagen: scope.mutagen,
    mutagenPalaces: summarizeMutagenPalaces(scope.mutagen, palaces),
    notableStars: (scope.stars || []).map((stars, index) => ({
      index,
      palaceName: scope.palaceNames?.[index] || null,
      stars: (stars || []).map(s => s.name)
    })).filter(item => item.stars.length > 0)
  } : null;
  return {
    decadal: summarize(horoscope.decadal),
    yearly: summarize(horoscope.yearly),
    monthly: summarize(horoscope.monthly),
    daily: summarize(horoscope.daily)
  };
}

// ─── 主逻辑 ─────────────────────────────────────────────────
function main() {
  const opts = parseArgs();

  // 验证参数
  if (!opts.solar) fail('missing_param', '缺少 --solar 参数，格式 YYYY-MM-DD', JSON.stringify(opts));
  if (opts.hour === undefined || isNaN(opts.hour) || opts.hour < 0 || opts.hour > 23) {
    fail('invalid_hour', '--hour 必须为 0-23 的整数', JSON.stringify(opts));
  }
  if (opts.minute === undefined || isNaN(opts.minute) || opts.minute < 0 || opts.minute > 59) {
    fail('invalid_minute', '--minute 必须为 0-59 的整数', JSON.stringify(opts));
  }
  if (!opts.birthplace) fail('missing_param', '缺少 --birthplace 参数', JSON.stringify(opts));
  if (!opts.gender || !['male', 'female'].includes(opts.gender)) {
    fail('invalid_gender', '--gender 必须为 male 或 female', JSON.stringify(opts));
  }

  if (opts.year !== undefined && (!Number.isInteger(opts.year) || opts.year < 1 || opts.year > 9999)) fail('invalid_year', '--year 必须为 1-9999 的整数', opts);
  parseSolarDate(opts.solar);

  // ── 时间校正 ──
  const timeNorm = normalizeTime(opts.solar, opts.hour, opts.minute, opts.birthplace);
  if (timeNorm?.precisionGuard?.reason) fail(timeNorm.precisionGuard.reason, '历史时区或近似算法边界不能可靠确定，停止精确排盘', timeNorm.precisionGuard);
  let useSolar, useHour, useMinute;
  let timeCorrection;

  if (timeNorm && !timeNorm.error) {
    useSolar = timeNorm.corrected.solar;
    useHour = timeNorm.corrected.hour;
    useMinute = timeNorm.corrected.minute;
    timeCorrection = {
      applied: true,
      original: timeNorm.original,
      corrected: timeNorm.corrected,
      dst: timeNorm.dst,
      trueSolarTime: timeNorm.trueSolarTime,
      timezone: timeNorm.timezone,
      precisionGuard: timeNorm.precisionGuard,
      instant: timeNorm.instant,
      calendarReference: timeNorm.calendarReference,
      calendarPolicy: timeNorm.calendarPolicy,
      shichenChanged: timeNorm.shichenChanged,
      boundary: timeNorm.boundary || null,
      solarTermBoundary: timeNorm.solarTermBoundary || null,
      warnings: timeNorm.warnings || []
    };
    console.error(`[ziwei-chart] 时间校正: ${opts.solar} ${opts.hour}:${String(opts.minute).padStart(2,'0')} → ${useSolar} ${useHour}:${String(timeNorm.corrected.minute).padStart(2,'0')}`);
  } else {
    fail('time_normalization_failed', '时间校正失败，停止排盘；请检查出生地、当地时间和运行环境', { solar: opts.solar, hour: opts.hour, minute: opts.minute, birthplace: opts.birthplace });
  }

  const { year, month, day } = parseSolarDate(useSolar);

  const genderCN = opts.gender === 'male' ? '男' : '女';
  const shichenIndex = hourToShichen(useHour, useMinute);
  const dateStr = `${year}-${month}-${day}`;

  let astrolabe;
  try {
    iztro.astro.config({ yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward', ...(opts.lang ? { language: opts.lang } : {}) });
    astrolabe = iztro.astro.astrolabeBySolarDate(dateStr, shichenIndex, genderCN);
  } catch (e) {
    fail('calc_error', `紫微排盘计算失败: ${e.message}`, opts.solar);
  }

  // ── 流年快查模式 ──
  if (opts.year) {
    const targetYear = opts.year;
    // 获取目标年份的运限信息
    // 用目标年份的中间日期来获取运限
    const targetDateStr = `${targetYear}-6-15`;
    const targetShichen = 6; // 午时
    const yearFortuneScope = {
      sampleDate: targetDateStr,
      sampleShichen: '午',
      sampleShichenIndex: targetShichen,
      note: '年度运限以年中代表点取样；年初、立春前后、生日附近或具体月份需另按指定日期复核。'
    };

    let yearHoroscope = null;
    try {
      const h = astrolabe.horoscope(targetDateStr, targetShichen);
      yearHoroscope = {
        decadal: h.decadal,
        yearly: h.yearly
      };
    } catch (e) {
      fail('unsupported_year', `流年运限计算失败: ${e.message}`, { targetYear });
    }

    // 命宫和身宫
    const soulPalaceData = astrolabe.palaces.find(
      p => p.earthlyBranch === astrolabe.earthlyBranchOfSoulPalace
    );
    const bodyPalaceData = astrolabe.palaces.find(
      p => p.earthlyBranch === astrolabe.earthlyBranchOfBodyPalace
    );

    const yearFortuneSummary = summarizeHoroscope(yearHoroscope, astrolabe.palaces);
    if (yearFortuneSummary) yearFortuneSummary.yearFortuneScope = yearFortuneScope;
    const triadAnalysis = buildTriadAnalysis(astrolabe.palaces, yearFortuneSummary);
    const mutagenInteractions = buildMutagenInteractions(yearFortuneSummary);
    const yearResult = {
      mode: 'yearFortune',
      input: {
        solar: opts.solar,
        hour: opts.hour,
        minute: opts.minute,
        gender: opts.gender,
        birthplace: opts.birthplace,
        targetYear
      },
      fiveElementsClass: astrolabe.fiveElementsClass,
      soulPalace: soulPalaceData ? {
        name: soulPalaceData.name,
        earthlyBranch: soulPalaceData.earthlyBranch,
        majorStars: soulPalaceData.majorStars.map(serializeStar)
      } : null,
      bodyPalace: bodyPalaceData ? {
        name: bodyPalaceData.name,
        earthlyBranch: bodyPalaceData.earthlyBranch,
        majorStars: bodyPalaceData.majorStars.map(serializeStar)
      } : null,
      yearFortune: yearHoroscope,
      yearFortuneSummary,
      yearFortuneScope,
      triadAnalysis,
      mutagenInteractions,
      domainScores: buildDomainScores(triadAnalysis, mutagenInteractions),
      palaces: astrolabe.palaces.map(serializePalace),
      timeCorrection
    };

    attachSchemaValidation(yearResult, validateZiweiOutput);
    process.stdout.write(JSON.stringify(yearResult, null, 2) + '\n');
    return;
  }

  // ── 完整排盘模式 ──
  const palaces = astrolabe.palaces.map(serializePalace);

  const soulPalaceData = astrolabe.palaces.find(
    p => p.earthlyBranch === astrolabe.earthlyBranchOfSoulPalace
  );
  const bodyPalaceData = astrolabe.palaces.find(
    p => p.earthlyBranch === astrolabe.earthlyBranchOfBodyPalace
  );

  const soulPalace = soulPalaceData ? {
    name: soulPalaceData.name,
    heavenlyStem: soulPalaceData.heavenlyStem,
    earthlyBranch: soulPalaceData.earthlyBranch,
    majorStars: soulPalaceData.majorStars.map(serializeStar),
    minorStars: soulPalaceData.minorStars.map(serializeStar)
  } : null;

  const bodyPalace = bodyPalaceData ? {
    name: bodyPalaceData.name,
    heavenlyStem: bodyPalaceData.heavenlyStem,
    earthlyBranch: bodyPalaceData.earthlyBranch,
    isBodyPalace: bodyPalaceData.isBodyPalace,
    majorStars: bodyPalaceData.majorStars.map(serializeStar),
    minorStars: bodyPalaceData.minorStars.map(serializeStar)
  } : null;

  // ── 运限 ──
  const now = new Date(Date.now() + 8 * 3600000);
  const nowDateStr = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  const nowShichen = hourToShichen(now.getUTCHours(), now.getUTCMinutes());

  let horoscope = null;
  try {
    const h = astrolabe.horoscope(nowDateStr, nowShichen);
    horoscope = {
      decadal: h.decadal,
      yearly: h.yearly,
      monthly: h.monthly || null,
      daily: h.daily || null
    };
  } catch (e) {
    console.error(`[ziwei-chart] 运限计算警告: ${e.message}`);
  }

  const horoscopeSummary = summarizeHoroscope(horoscope, astrolabe.palaces);
  const triadAnalysis = buildTriadAnalysis(astrolabe.palaces, horoscopeSummary);
  const mutagenInteractions = buildMutagenInteractions(horoscopeSummary);
  const currentDomainScores = buildDomainScores(triadAnalysis, mutagenInteractions);
  const domainScoreScope = {
    type: 'currentTransit',
    label: '当前运限',
    date: nowDateStr,
    includes: ['大限', '流年', '流月', '流日'],
    note: '此评分来自当前运限四化与三方四正，不代表纯本命盘。'
  };

  const output = {
    input: {
      solar: opts.solar,
      hour: opts.hour,
      minute: opts.minute,
      gender: opts.gender,
      birthplace: opts.birthplace,
      shichen: `${SHICHEN_NAMES[shichenIndex]}时`,
      shichenRange: SHICHEN_RANGES[shichenIndex],
      lunarDate: astrolabe.lunarDate,
      solarDate: astrolabe.solarDate,
      chineseDate: astrolabe.chineseDate
    },
    palaces,
    soulPalace,
    bodyPalace,
    fiveElementsClass: astrolabe.fiveElementsClass,
    zodiac: astrolabe.zodiac,
    sign: astrolabe.sign,
    fourPillars: astrolabe.chineseDate,
    horoscope,
    horoscopeSummary,
    triadAnalysis,
    mutagenInteractions,
    currentDomainScores,
    domainScoreScope,
    domainScores: currentDomainScores,
    timeCorrection
  };

  attachSchemaValidation(output, validateZiweiOutput);
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
