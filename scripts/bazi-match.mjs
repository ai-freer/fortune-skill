#!/usr/bin/env node
/**
 * bazi-match.mjs — 八字合婚分析脚本
 *
 * 用法: node bazi-match.mjs \
 *   --solar1 "YYYY-MM-DD" --hour1 <0-23> --gender1 <male|female> --birthplace1 "城市" \
 *   --solar2 "YYYY-MM-DD" --hour2 <0-23> --gender2 <male|female> --birthplace2 "城市"
 *
 * 输出: JSON 到 stdout，日志到 stderr
 *
 * 分析维度:
 *   1. 日柱天合地合
 *   2. 年支关系（六合、三合、六冲、相刑、相害）
 *   3. 五行互补
 *   4. 十神关系（日干十神）
 *   5. 纳音关系
 *   6. 生肖关系
 *   7. 综合评分
 */

import { parseInteger } from './cli-input.mjs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { nayinElement } from './constants.mjs';

const require = createRequire(import.meta.url);
const { Solar } = require('lunar-javascript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--solar1' && args[i+1]) opts.solar1 = args[++i];
    else if (a === '--hour1' && args[i+1]) opts.hour1 = parseInteger(args[++i]);
    else if (a === '--minute1' && args[i+1]) opts.minute1 = parseInteger(args[++i]);
    else if (a === '--gender1' && args[i+1]) opts.gender1 = args[++i];
    else if (a === '--birthplace1' && args[i+1]) opts.birthplace1 = args[++i];
    else if (a === '--solar2' && args[i+1]) opts.solar2 = args[++i];
    else if (a === '--hour2' && args[i+1]) opts.hour2 = parseInteger(args[++i]);
    else if (a === '--minute2' && args[i+1]) opts.minute2 = parseInteger(args[++i]);
    else if (a === '--gender2' && args[i+1]) opts.gender2 = args[++i];
    else if (a === '--birthplace2' && args[i+1]) opts.birthplace2 = args[++i];
  }
  if (opts.minute1 === undefined) opts.minute1 = 0;
  if (opts.minute2 === undefined) opts.minute2 = 0;
  return opts;
}

function fail(error, message, input) {
  process.stdout.write(JSON.stringify({ error, message, input }, null, 2) + '\n');
  process.exit(1);
}

// ─── 获取排盘数据 ───────────────────────────────────────────
function getChart(solar, hour, minute, gender, birthplace) {
  try {
    const scriptPath = join(__dirname, 'bazi-chart.mjs');
    const result = execFileSync(process.execPath, [
      scriptPath, '--solar', solar, '--hour', String(hour),
      '--minute', String(minute), '--gender', gender, '--birthplace', birthplace
    ], { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(result.trim());
  } catch (e) {
    fail('chart_error', `排盘失败: ${e.message}`, { solar, hour, minute, gender, birthplace });
  }
}

// ─── 天干五行 ───────────────────────────────────────────────
const GAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};

const GAN_YINYANG = {};
'甲乙丙丁戊己庚辛壬癸'.split('').forEach((g, i) => {
  GAN_YINYANG[g] = i % 2 === 0 ? '阳' : '阴';
});

// ─── 天干合 ─────────────────────────────────────────────────
const GAN_HE = {
  '甲己': { hua: '土', name: '中正之合' },
  '乙庚': { hua: '金', name: '仁义之合' },
  '丙辛': { hua: '水', name: '威制之合' },
  '丁壬': { hua: '木', name: '淫慝之合' },
  '戊癸': { hua: '火', name: '无情之合' }
};

function checkGanHe(g1, g2) {
  const key1 = g1 + g2;
  const key2 = g2 + g1;
  return GAN_HE[key1] || GAN_HE[key2] || null;
}

// ─── 地支六合 ───────────────────────────────────────────────
const ZHI_LIUHE = {
  '子丑': '土', '丑子': '土',
  '寅亥': '木', '亥寅': '木',
  '卯戌': '火', '戌卯': '火',
  '辰酉': '金', '酉辰': '金',
  '巳申': '水', '申巳': '水',
  '午未': '土', '未午': '土'
};

// ─── 地支六冲 ───────────────────────────────────────────────
const ZHI_CHONG = new Set([
  '子午', '午子', '丑未', '未丑', '寅申', '申寅',
  '卯酉', '酉卯', '辰戌', '戌辰', '巳亥', '亥巳'
]);

// ─── 地支三合 ───────────────────────────────────────────────
const ZHI_SANHE = {
  '申子辰': '水', '巳酉丑': '金', '寅午戌': '火', '亥卯未': '木'
};

// ─── 地支相害 ───────────────────────────────────────────────
const ZHI_HAI = new Set([
  '子未', '未子', '丑午', '午丑', '寅巳', '巳寅',
  '卯辰', '辰卯', '申亥', '亥申', '酉戌', '戌酉'
]);

// ─── 地支相刑 ───────────────────────────────────────────────
const ZHI_XING = {
  '寅巳': '无恩之刑', '巳申': '无恩之刑', '申寅': '无恩之刑',
  '未丑': '持势之刑', '丑戌': '持势之刑', '戌未': '持势之刑',
  '子卯': '无礼之刑', '卯子': '无礼之刑'
};

// ─── 十神 ───────────────────────────────────────────────────
const TEN_GODS_TABLE = {
  '甲': { '甲':'比肩','乙':'劫财','丙':'食神','丁':'伤官','戊':'偏财','己':'正财','庚':'七杀','辛':'正官','壬':'偏印','癸':'正印' },
  '乙': { '甲':'劫财','乙':'比肩','丙':'伤官','丁':'食神','戊':'正财','己':'偏财','庚':'正官','辛':'七杀','壬':'正印','癸':'偏印' },
  '丙': { '甲':'偏印','乙':'正印','丙':'比肩','丁':'劫财','戊':'食神','己':'伤官','庚':'偏财','辛':'正财','壬':'七杀','癸':'正官' },
  '丁': { '甲':'正印','乙':'偏印','丙':'劫财','丁':'比肩','戊':'伤官','己':'食神','庚':'正财','辛':'偏财','壬':'正官','癸':'七杀' },
  '戊': { '甲':'七杀','乙':'正官','丙':'偏印','丁':'正印','戊':'比肩','己':'劫财','庚':'食神','辛':'伤官','壬':'偏财','癸':'正财' },
  '己': { '甲':'正官','乙':'七杀','丙':'正印','丁':'偏印','戊':'劫财','己':'比肩','庚':'伤官','辛':'食神','壬':'正财','癸':'偏财' },
  '庚': { '甲':'偏财','乙':'正财','丙':'七杀','丁':'正官','戊':'偏印','己':'正印','庚':'比肩','辛':'劫财','壬':'食神','癸':'伤官' },
  '辛': { '甲':'正财','乙':'偏财','丙':'正官','丁':'七杀','戊':'正印','己':'偏印','庚':'劫财','辛':'比肩','壬':'伤官','癸':'食神' },
  '壬': { '甲':'食神','乙':'伤官','丙':'偏财','丁':'正财','戊':'七杀','己':'正官','庚':'偏印','辛':'正印','壬':'比肩','癸':'劫财' },
  '癸': { '甲':'伤官','乙':'食神','丙':'正财','丁':'偏财','戊':'正官','己':'七杀','庚':'正印','辛':'偏印','壬':'劫财','癸':'比肩' }
};

// ─── 五行生克 ───────────────────────────────────────────────
const WUXING_SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const WUXING_KE = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };

function wuxingRelation(wx1, wx2) {
  if (wx1 === wx2) return '比和';
  if (WUXING_SHENG[wx1] === wx2) return `${wx1}生${wx2}`;
  if (WUXING_SHENG[wx2] === wx1) return `${wx2}生${wx1}`;
  if (WUXING_KE[wx1] === wx2) return `${wx1}克${wx2}`;
  if (WUXING_KE[wx2] === wx1) return `${wx2}克${wx1}`;
  return '无直接关系';
}

// ─── 生肖关系 ───────────────────────────────────────────────
const SHENGXIAO = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const ZHI_TO_SHENGXIAO = {};
'子丑寅卯辰巳午未申酉戌亥'.split('').forEach((z, i) => {
  ZHI_TO_SHENGXIAO[z] = SHENGXIAO[i];
});

// 生肖六合
const SX_LIUHE = { '鼠牛': true, '虎猪': true, '兔狗': true, '龙鸡': true, '蛇猴': true, '马羊': true };
// 生肖六冲
const SX_CHONG = { '鼠马': true, '牛羊': true, '虎猴': true, '兔鸡': true, '龙狗': true, '蛇猪': true };
// 生肖三合
const SX_SANHE = [
  new Set(['猴','鼠','龙']),
  new Set(['蛇','鸡','牛']),
  new Set(['虎','马','狗']),
  new Set(['猪','兔','羊'])
];

function shengxiaoRelation(sx1, sx2) {
  const key1 = sx1 + sx2, key2 = sx2 + sx1;
  if (SX_LIUHE[key1] || SX_LIUHE[key2]) return { type: '六合', score: 10, desc: `${sx1}${sx2}六合，感情融洽` };
  if (SX_CHONG[key1] || SX_CHONG[key2]) return { type: '六冲', score: -8, desc: `${sx1}${sx2}六冲，性格差异大` };
  for (const group of SX_SANHE) {
    if (group.has(sx1) && group.has(sx2)) return { type: '三合', score: 8, desc: `${sx1}${sx2}三合，志趣相投` };
  }
  return { type: '无特殊关系', score: 0, desc: `${sx1}与${sx2}无特殊冲合关系` };
}

// ─── 合婚分析 ───────────────────────────────────────────────
function analyzeMatch(chart1, chart2) {
  const p1 = chart1.pillars;
  const p2 = chart2.pillars;
  const dm1 = chart1.dayMaster;
  const dm2 = chart2.dayMaster;

  const analysis = {};
  let totalScore = 60; // 基础分

  // 1. 日柱天合地合
  const dayGanHe = checkGanHe(p1.day.gan, p2.day.gan);
  const dayZhiKey = p1.day.zhi + p2.day.zhi;
  const dayZhiHe = ZHI_LIUHE[dayZhiKey] || null;
  const dayZhiChong = ZHI_CHONG.has(dayZhiKey);

  analysis.dayPillar = {
    person1: p1.day.ganZhi,
    person2: p2.day.ganZhi,
    ganHe: dayGanHe ? { ...dayGanHe, desc: `${p1.day.gan}${p2.day.gan}合` } : null,
    zhiHe: dayZhiHe ? { hua: dayZhiHe, desc: `${p1.day.zhi}${p2.day.zhi}合化${dayZhiHe}` } : null,
    zhiChong: dayZhiChong ? `${p1.day.zhi}${p2.day.zhi}相冲` : null,
    tianHeDiHe: dayGanHe && dayZhiHe ? true : false
  };

  if (dayGanHe && dayZhiHe) totalScore += 15; // 天合地合
  else if (dayGanHe) totalScore += 8;
  else if (dayZhiHe) totalScore += 5;
  if (dayZhiChong) totalScore -= 10;

  // 2. 年支关系
  const yearZhiKey = p1.year.zhi + p2.year.zhi;
  const yearLiuhe = ZHI_LIUHE[yearZhiKey] || null;
  const yearChong = ZHI_CHONG.has(yearZhiKey);
  const yearXing = ZHI_XING[yearZhiKey] || null;
  const yearHai = ZHI_HAI.has(yearZhiKey);

  analysis.yearBranch = {
    person1: p1.year.zhi,
    person2: p2.year.zhi,
    liuhe: yearLiuhe ? `${p1.year.zhi}${p2.year.zhi}合化${yearLiuhe}` : null,
    chong: yearChong ? `${p1.year.zhi}${p2.year.zhi}相冲` : null,
    xing: yearXing,
    hai: yearHai ? `${p1.year.zhi}${p2.year.zhi}相害` : null
  };

  if (yearLiuhe) totalScore += 8;
  if (yearChong) totalScore -= 8;
  if (yearXing) totalScore -= 5;
  if (yearHai) totalScore -= 3;

  // 3. 五行互补
  const s1 = chart1.fiveElements.scores;
  const s2 = chart2.fiveElements.scores;
  const elements = ['金', '木', '水', '火', '土'];
  const complementary = [];
  const conflicting = [];

  for (const el of elements) {
    const v1 = s1[el] || 0;
    const v2 = s2[el] || 0;
    // 一方缺（<5）另一方旺（>15）= 互补
    if ((v1 < 5 && v2 > 15) || (v2 < 5 && v1 > 15)) {
      complementary.push({ element: el, person1: v1, person2: v2, desc: `${el}互补` });
    }
    // 双方都过旺（>20）= 冲突
    if (v1 > 20 && v2 > 20) {
      conflicting.push({ element: el, person1: v1, person2: v2, desc: `${el}双旺` });
    }
  }

  analysis.fiveElements = {
    person1: s1,
    person2: s2,
    complementary,
    conflicting,
    dayMasterRelation: wuxingRelation(dm1.wuXing, dm2.wuXing)
  };

  totalScore += complementary.length * 3;
  totalScore -= conflicting.length * 2;

  // 4. 十神关系
  const god1to2 = TEN_GODS_TABLE[dm1.gan]?.[dm2.gan] || '未知';
  const god2to1 = TEN_GODS_TABLE[dm2.gan]?.[dm1.gan] || '未知';

  // 正财正官 = 正配
  const goodGods = ['正财', '正官', '正印', '食神'];
  const badGods = ['七杀', '伤官'];

  analysis.tenGods = {
    person1ToDayMaster2: god1to2,
    person2ToDayMaster1: god2to1,
    desc: `甲方日干${dm1.gan}见乙方日干${dm2.gan}为${god1to2}，乙方日干${dm2.gan}见甲方日干${dm1.gan}为${god2to1}`
  };

  if (goodGods.includes(god1to2)) totalScore += 5;
  if (goodGods.includes(god2to1)) totalScore += 5;
  if (badGods.includes(god1to2)) totalScore -= 3;
  if (badGods.includes(god2to1)) totalScore -= 3;

  // 5. 纳音关系
  const nayin1 = chart1.nayin?.day || '';
  const nayin2 = chart2.nayin?.day || '';
  const nw1 = nayinElement(nayin1);
  const nw2 = nayinElement(nayin2);

  analysis.nayin = {
    person1: nayin1,
    person2: nayin2,
    elements: { person1: nw1, person2: nw2 },
    relation: nw1 && nw2 ? wuxingRelation(nw1, nw2) : '无法判断'
  };

  // 6. 生肖关系
  const sx1 = ZHI_TO_SHENGXIAO[p1.year.zhi] || '';
  const sx2 = ZHI_TO_SHENGXIAO[p2.year.zhi] || '';
  const sxRel = shengxiaoRelation(sx1, sx2);

  analysis.shengxiao = {
    person1: sx1,
    person2: sx2,
    ...sxRel
  };

  totalScore += sxRel.score;

  // 7. 综合评分
  totalScore = Math.max(0, Math.min(100, totalScore));

  let level;
  if (totalScore >= 85) level = '高互补';
  else if (totalScore >= 70) level = '中高互补';
  else if (totalScore >= 55) level = '中性互补';
  else if (totalScore >= 40) level = '高摩擦';
  else level = '需谨慎校准';

  analysis.summary = {
    score: totalScore,
    level,
    desc: `命理结构互补度 ${totalScore} 分，区间为「${level}」。此分数只描述传统命理结构的互补与摩擦，不代表关系成败。`
  };

  return analysis;
}

// ─── 主逻辑 ─────────────────────────────────────────────────
function main() {
  const opts = parseArgs();

  // 验证参数
  for (const suffix of ['1', '2']) {
    if (!opts[`solar${suffix}`]) fail('missing_param', `缺少 --solar${suffix}`, JSON.stringify(opts));
    if (opts[`hour${suffix}`] === undefined || isNaN(opts[`hour${suffix}`])) {
      fail('invalid_hour', `--hour${suffix} 必须为 0-23 的整数`, JSON.stringify(opts));
    }
    if (opts[`hour${suffix}`] < 0 || opts[`hour${suffix}`] > 23) {
      fail('invalid_hour', `--hour${suffix} 必须为 0-23 的整数`, JSON.stringify(opts));
    }
    if (opts[`minute${suffix}`] === undefined || isNaN(opts[`minute${suffix}`]) || opts[`minute${suffix}`] < 0 || opts[`minute${suffix}`] > 59) {
      fail('invalid_minute', `--minute${suffix} 必须为 0-59 的整数`, JSON.stringify(opts));
    }
    if (!opts[`gender${suffix}`]) fail('missing_param', `缺少 --gender${suffix}`, JSON.stringify(opts));
    if (!opts[`birthplace${suffix}`]) fail('missing_param', `缺少 --birthplace${suffix}`, JSON.stringify(opts));
  }

  console.error('[bazi-match] 排盘甲方...');
  const chart1 = getChart(opts.solar1, opts.hour1, opts.minute1, opts.gender1, opts.birthplace1);
  console.error('[bazi-match] 排盘乙方...');
  const chart2 = getChart(opts.solar2, opts.hour2, opts.minute2, opts.gender2, opts.birthplace2);

  console.error('[bazi-match] 合婚分析...');
  const matchAnalysis = analyzeMatch(chart1, chart2);

  const output = {
    input: {
      person1: { solar: opts.solar1, hour: opts.hour1, minute: opts.minute1, gender: opts.gender1, birthplace: opts.birthplace1 },
      person2: { solar: opts.solar2, hour: opts.hour2, minute: opts.minute2, gender: opts.gender2, birthplace: opts.birthplace2 }
    },
    person1: {
      pillars: chart1.pillars,
      dayMaster: chart1.dayMaster,
      fiveElements: chart1.fiveElements,
      nayin: chart1.nayin,
      timeCorrection: chart1.timeCorrection
    },
    person2: {
      pillars: chart2.pillars,
      dayMaster: chart2.dayMaster,
      fiveElements: chart2.fiveElements,
      nayin: chart2.nayin,
      timeCorrection: chart2.timeCorrection
    },
    match: matchAnalysis
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
