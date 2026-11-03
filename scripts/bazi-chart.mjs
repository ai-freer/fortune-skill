#!/usr/bin/env node
/**
 * bazi-chart.mjs — 八字排盘脚本（基于 lunar-javascript）
 *
 * 用法: node bazi-chart.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace "城市名" [--year <YYYY>]
 * 输出: JSON 到 stdout，日志到 stderr
 *
 * 输出字段:
 *   pillars       四柱（年月日时）
 *   tenGods       十神
 *   fiveElements   五行统计
 *   hiddenStems   藏干
 *   nayin         纳音
 *   dayMaster     日主信息
 *   majorFortune  大运列表
 *   annualFortune 当前流年
 *   spirits       神煞 / 旬空 / 地势
 *   extra         胎元、胎息、命宫、身宫
 *
 * --year <YYYY>: 流年快查模式，只输出该年的流年运势数据
 */

import { calendarBasis } from './calendar-basis.mjs';
import { parseInteger } from './cli-input.mjs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { normalizeSignalLevel } from './constants.mjs';
import { attachSchemaValidation, validateBaziOutput } from './schema-validators.mjs';

const require = createRequire(import.meta.url);
const { Solar } = require('lunar-javascript');

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
    console.error(`[bazi-chart] 时间校正失败: ${e.message}`);
    return null;
  }
}

// ─── 五行分数计算（参考 china-testing/bazi 的算法） ──────────
const GAN_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};

const ZHI_CANG = {
  '子': { '癸': 8 },
  '丑': { '己': 5, '癸': 2, '辛': 1 },
  '寅': { '甲': 5, '丙': 2, '戊': 1 },
  '卯': { '乙': 8 },
  '辰': { '戊': 5, '乙': 2, '癸': 1 },
  '巳': { '丙': 5, '戊': 2, '庚': 1 },
  '午': { '丁': 5, '己': 3 },
  '未': { '己': 5, '丁': 2, '乙': 1 },
  '申': { '庚': 5, '壬': 2, '戊': 1 },
  '酉': { '辛': 8 },
  '戌': { '戊': 5, '辛': 2, '丁': 1 },
  '亥': { '壬': 5, '甲': 3 }
};

const WUXING_GENERATES = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const WUXING_CONTROLS = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

const ROLE_REALITY = {
  '印星': {
    domains: ['贵人背书', '组织平台', '专业方法', '技术系统', '资质保护'],
    opportunity: '利于获得正式支持、方法论沉淀和系统资源',
    risk: '过强时容易依赖组织、流程迟缓或判断保守'
  },
  '比劫': {
    domains: ['个人体力', '同伴协作', '合伙关系', '竞争关系', '自我主张'],
    opportunity: '利于恢复能量、争取主动权和建立同盟',
    risk: '过强时容易竞争加剧、资源分摊或合伙边界不清'
  },
  '食伤': {
    domains: ['表达输出', '产品定义', '创新突破', '方法论传播', '规则挑战'],
    opportunity: '利于创造、表达、产品定义和对外影响力',
    risk: '身弱遇食伤过强，容易透支、口舌、与规则冲突'
  },
  '财星': {
    domains: ['项目机会', '商业化', '融资资金', '资源交换', '家庭资产'],
    opportunity: '利于看见机会、推动商业化和资源整合',
    risk: '身弱财旺时，机会越大，现金流、承诺和体力消耗越重'
  },
  '官杀': {
    domains: ['组织权责', '职位名分', '考核规则', '合规约束', '外部压力'],
    opportunity: '利于名分、责任、组织化和规则内承接',
    risk: '压力过强时容易形成组织摩擦、合规风险和身心负担'
  }
};

const SANHE_GROUPS = [
  { type: '三合局', element: '水', branches: ['申', '子', '辰'], description: '申子辰三合水局' },
  { type: '三合局', element: '木', branches: ['亥', '卯', '未'], description: '亥卯未三合木局' },
  { type: '三合局', element: '火', branches: ['寅', '午', '戌'], description: '寅午戌三合火局' },
  { type: '三合局', element: '金', branches: ['巳', '酉', '丑'], description: '巳酉丑三合金局' }
];

const SANHUI_GROUPS = [
  { type: '三会局', element: '木', branches: ['寅', '卯', '辰'], description: '寅卯辰三会木方' },
  { type: '三会局', element: '火', branches: ['巳', '午', '未'], description: '巳午未三会火方' },
  { type: '三会局', element: '金', branches: ['申', '酉', '戌'], description: '申酉戌三会金方' },
  { type: '三会局', element: '水', branches: ['亥', '子', '丑'], description: '亥子丑三会水方' }
];

function calcFiveElements(gans, zhis) {
  const scores = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  const ganScores = {};
  '甲乙丙丁戊己庚辛壬癸'.split('').forEach(g => { ganScores[g] = 0; });

  for (const g of gans) {
    scores[GAN_WUXING[g]] += 5;
    ganScores[g] += 5;
  }

  const zhiList = [...zhis, zhis[1]];
  for (const z of zhiList) {
    const cang = ZHI_CANG[z];
    if (cang) {
      for (const [gan, val] of Object.entries(cang)) {
        scores[GAN_WUXING[gan]] += val;
        ganScores[gan] += val;
      }
    }
  }

  return { scores, ganScores };
}

function getYinYang(gan) {
  const idx = '甲乙丙丁戊己庚辛壬癸'.indexOf(gan);
  return idx % 2 === 0 ? '阳' : '阴';
}

const GAN_COMBINE = {
  '甲己': '甲己合土', '己甲': '甲己合土',
  '乙庚': '乙庚合金', '庚乙': '乙庚合金',
  '丙辛': '丙辛合水', '辛丙': '丙辛合水',
  '丁壬': '丁壬合木', '壬丁': '丁壬合木',
  '戊癸': '戊癸合火', '癸戊': '戊癸合火'
};

const GAN_CLASH = {
  '甲庚': '甲庚冲', '庚甲': '甲庚冲',
  '乙辛': '乙辛冲', '辛乙': '乙辛冲',
  '丙壬': '丙壬冲', '壬丙': '丙壬冲',
  '丁癸': '丁癸冲', '癸丁': '丁癸冲'
};

const ZHI_LIUHE = {
  '子丑': '子丑合土', '丑子': '子丑合土',
  '寅亥': '寅亥合木', '亥寅': '寅亥合木',
  '卯戌': '卯戌合火', '戌卯': '卯戌合火',
  '辰酉': '辰酉合金', '酉辰': '辰酉合金',
  '巳申': '巳申合水', '申巳': '巳申合水',
  '午未': '午未合土', '未午': '午未合土'
};

const ZHI_CHONG = {
  '子午': '子午冲', '午子': '子午冲',
  '丑未': '丑未冲', '未丑': '丑未冲',
  '寅申': '寅申冲', '申寅': '寅申冲',
  '卯酉': '卯酉冲', '酉卯': '卯酉冲',
  '辰戌': '辰戌冲', '戌辰': '辰戌冲',
  '巳亥': '巳亥冲', '亥巳': '巳亥冲'
};

const ZHI_HAI = {
  '子未': '子未害', '未子': '子未害',
  '丑午': '丑午害', '午丑': '丑午害',
  '寅巳': '寅巳害', '巳寅': '寅巳害',
  '卯辰': '卯辰害', '辰卯': '卯辰害',
  '申亥': '申亥害', '亥申': '申亥害',
  '酉戌': '酉戌害', '戌酉': '酉戌害'
};

const ZHI_XING_PAIRS = {
  '子卯': '无礼之刑', '卯子': '无礼之刑',
  '寅巳': '无恩之刑', '巳寅': '无恩之刑',
  '巳申': '无恩之刑', '申巳': '无恩之刑',
  '寅申': '无恩之刑', '申寅': '无恩之刑',
  '丑未': '恃势之刑', '未丑': '恃势之刑',
  '未戌': '恃势之刑', '戌未': '恃势之刑',
  '丑戌': '恃势之刑', '戌丑': '恃势之刑'
};

function splitGanZhi(ganZhi) {
  return { gan: ganZhi?.[0] || '', zhi: ganZhi?.[1] || '' };
}

function elementWeightsFromGanZhi(ganZhi, multiplier = 1) {
  const { gan, zhi } = splitGanZhi(ganZhi);
  const weights = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  if (GAN_WUXING[gan]) weights[GAN_WUXING[gan]] += 5 * multiplier;
  const hidden = ZHI_CANG[zhi] || {};
  for (const [hiddenGan, value] of Object.entries(hidden)) {
    weights[GAN_WUXING[hiddenGan]] += value * multiplier;
  }
  return weights;
}

function mergeWeights(...items) {
  const merged = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  for (const item of items) {
    for (const [element, value] of Object.entries(item || {})) {
      merged[element] += value;
    }
  }
  return merged;
}

function clampScore(value) {
  return Math.max(1, Math.min(5, value));
}

function elementRole(dayElement, element) {
  if (element === dayElement) return '比劫';
  if (WUXING_GENERATES[element] === dayElement) return '印星';
  if (WUXING_GENERATES[dayElement] === element) return '食伤';
  if (WUXING_CONTROLS[dayElement] === element) return '财星';
  if (WUXING_CONTROLS[element] === dayElement) return '官杀';
  return '未知';
}

function collectBranchSources(transitGanZhi, pillars, daYunGanZhi, transitLabel = '流年') {
  const items = [
    ...Object.entries(pillars).map(([key, pillar]) => ({
      label: `${key}柱`,
      ganZhi: pillar.ganZhi,
      zhi: pillar.zhi
    })),
    {
      label: transitLabel,
      ganZhi: transitGanZhi,
      zhi: splitGanZhi(transitGanZhi).zhi
    }
  ];
  if (daYunGanZhi) {
    items.push({
      label: '大运',
      ganZhi: daYunGanZhi,
      zhi: splitGanZhi(daYunGanZhi).zhi
    });
  }
  return items;
}

function analyzeBranchFormations(transitGanZhi, pillars, daYunGanZhi, transitLabel = '流年') {
  const sources = collectBranchSources(transitGanZhi, pillars, daYunGanZhi, transitLabel);
  const groups = [...SANHE_GROUPS, ...SANHUI_GROUPS];
  const formations = [];

  for (const group of groups) {
    const matched = group.branches
      .map(branch => ({
        branch,
        sources: sources.filter(item => item.zhi === branch).map(item => item.label)
      }))
      .filter(item => item.sources.length > 0);
    const hasTransit = matched.some(item => item.sources.includes(transitLabel));
    const hasDaYun = matched.some(item => item.sources.includes('大运'));

    if (matched.length === 3) {
      formations.push({
        type: group.type,
        strength: hasTransit || hasDaYun ? '动态成局' : '原局成势',
        element: group.element,
        description: group.description,
        matched
      });
    } else if (matched.length === 2 && (hasTransit || hasDaYun)) {
      formations.push({
        type: group.type === '三合局' ? '半合' : '半会',
        strength: '有引动但未完整成局',
        element: group.element,
        description: `${matched.map(item => item.branch).join('')}引动${group.description}`,
        matched
      });
    }
  }

  return formations;
}

function transformElementFromDescription(description) {
  const matched = String(description || '').match(/合([金木水火土])/);
  return matched ? matched[1] : null;
}

function analyzeCombinationTransformations(relationAnalysis, scores, transitGanZhi, daYunGanZhi) {
  const dynamicWeights = mergeWeights(
    elementWeightsFromGanZhi(transitGanZhi),
    daYunGanZhi ? elementWeightsFromGanZhi(daYunGanZhi, 0.5) : null
  );
  const results = [];
  const relationItems = [
    ...(relationAnalysis?.pillarRelations || []),
    relationAnalysis?.daYunRelation
  ].filter(Boolean);

  for (const item of relationItems) {
    for (const relation of item.relations || []) {
      if (!['天干合', '地支六合'].includes(relation.type)) continue;
      const element = transformElementFromDescription(relation.description);
      const base = element ? (scores[element] || 0) : 0;
      const dynamic = element ? (dynamicWeights[element] || 0) : 0;
      const support = base + dynamic;
      const status = !element ? '只合不化'
        : support >= 24 ? '较易成势'
          : support >= 14 ? '有条件成立'
            : '合而不化/牵制为主';
      results.push({
        relation: relation.description,
        type: relation.type,
        target: item.target,
        element,
        support,
        status,
        note: '合化判断为辅助口径，需结合月令、原局强弱、现实资源和是否有正式承接。'
      });
    }
  }

  return results;
}

function inferLifeEventSignals(relationAnalysis, formationAnalysis, tendencyAnalysis) {
  const flags = relationAnalysis?.flags || [];
  const labels = tendencyAnalysis?.primaryTriggerLabels || tendencyAnalysis?.triggerLabels || [];
  const ratings = tendencyAnalysis?.ratings || {};
  const hasHardMoveSignal = flags.some(flag => ['地支冲', '反吟/天克地冲'].includes(flag));
  const hasSoftMoveSignal = formationAnalysis.some(item => item.strength === '动态成局');
  const hasRelationshipSignal = (flags.includes('地支冲') || flags.includes('自刑') || flags.includes('地支害'))
    && labels.some(label => ['财星', '官杀'].includes(label));
  const hasFamilyAssetSignal = labels.includes('财星') || labels.includes('官杀');
  const hasCareerSignal = labels.some(label => ['官杀', '印星', '食伤', '财星'].includes(label))
    || (ratings.careerOpportunity || 0) >= 4;
  const signal = (level, note, baseRateNote = '信号强度是命盘先验提示，不代表事件必然发生。') => {
    const signalIntensity = normalizeSignalLevel(level);
    return {
      level: signalIntensity,
      signalIntensity,
      baseRateNote,
      note
    };
  };

  return {
    studyAndExams: signal(
      labels.some(label => ['印星', '食伤'].includes(label)) ? '中' : '低',
      labels.includes('印星')
        ? '关注学业、考试、导师、学校平台、证书资质和专业训练。'
        : labels.includes('食伤')
          ? '关注表达输出、作品集、竞赛、面试和专业方向选择。'
          : labels.includes('官杀')
            ? '规则压力可作为辅助背景，但学业考试信号不作为主轴。'
            : '学业考试信号不作为主轴。'
    ),
    careerChange: signal(
      hasCareerSignal ? (ratings.organizationFriction >= 5 ? '高' : '中') : '低',
      hasCareerSignal ? '关注换工作、组织调整、职责重划、平台变化或项目名分变化。' : '职业变化信号不强。'
    ),
    cityMove: signal(
      hasHardMoveSignal ? '中高' : hasSoftMoveSignal ? '中' : '低',
      hasHardMoveSignal
        ? '关注跨城市、跨区域、外部平台、出差半径扩大或迁移类机会。'
        : hasSoftMoveSignal
          ? '有外部环境变化或工作半径扩大的背景，但不宜直接断为换城市。'
          : '迁移信号不强。'
    ),
    relationshipChange: signal(
      hasRelationshipSignal ? '中' : '低',
      hasRelationshipSignal ? '关系和伴侣议题可能被现实压力引动，重点看沟通、边界和共同资产安排。' : '伴侣关系变化信号不作为主轴。'
    ),
    familyAndAssets: signal(
      hasFamilyAssetSignal ? '中' : '低',
      hasFamilyAssetSignal ? '家庭责任、房产、资产配置、现金流或长期保障议题需要纳入判断。' : '家庭资产议题不作为主轴。'
    ),
    healthStress: signal(
      (ratings.physicalDrain || 0) >= 5 ? '高' : (ratings.physicalDrain || 0) >= 4 ? '中高' : '低',
      '身心消耗评分高时，健康、睡眠、炎症、血压、脾胃和情绪稳定是现实约束。'
    )
  };
}

function analyzeYearTendency(yearGanZhi, daYunGanZhi, scores, dayGan, relationAnalysis) {
  const dayElement = GAN_WUXING[dayGan];
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const dayScore = scores[dayElement] || 0;
  const strengthRatio = total ? dayScore / total : 0;
  const baseStrength = strengthRatio >= 0.3 ? '身强' : '身弱';
  const favorableRoles = baseStrength === '身弱'
    ? ['印星', '比劫']
    : ['食伤', '财星', '官杀'];
  const unfavorableRoles = baseStrength === '身弱'
    ? ['食伤', '财星', '官杀']
    : ['印星', '比劫'];

  const yearWeights = elementWeightsFromGanZhi(yearGanZhi);
  const daYunWeights = daYunGanZhi ? elementWeightsFromGanZhi(daYunGanZhi, 0.5) : null;
  const combinedWeights = mergeWeights(yearWeights, daYunWeights);
  const roleWeights = {};
  for (const [element, value] of Object.entries(combinedWeights)) {
    if (!value) continue;
    const role = elementRole(dayElement, element);
    roleWeights[role] = (roleWeights[role] || 0) + value;
  }

  const favorableScore = favorableRoles.reduce((sum, role) => sum + (roleWeights[role] || 0), 0);
  const unfavorableScore = unfavorableRoles.reduce((sum, role) => sum + (roleWeights[role] || 0), 0);
  const balance = favorableScore - unfavorableScore;
  const tendency = balance >= 6 ? '明显偏喜'
    : balance >= 2 ? '中性偏喜'
      : balance > -2 ? '中性'
        : balance > -6 ? '中性偏压'
          : '明显偏压';

  const triggerLabels = Object.entries(roleWeights)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([role]) => role);
  const roleEntries = Object.entries(roleWeights)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const averageRoleWeight = roleEntries.length
    ? roleEntries.reduce((sum, [, value]) => sum + value, 0) / roleEntries.length
    : 0;
  const dominantEntries = roleEntries.filter(([, value]) => value >= averageRoleWeight * 1.5).slice(0, 2);
  const primaryTriggerLabels = (dominantEntries.length ? dominantEntries : roleEntries.slice(0, 2))
    .map(([role]) => role);
  const relationFlags = relationAnalysis?.flags || [];
  const hasConflict = relationFlags.some(flag => ['天干冲', '地支冲', '地支刑', '地支害', '反吟/天克地冲'].includes(flag));
  const hasResource = (roleWeights['印星'] || 0) > 0;
  const hasWealth = (roleWeights['财星'] || 0) > 0;
  const hasOfficer = (roleWeights['官杀'] || 0) > 0;
  const hasOutput = (roleWeights['食伤'] || 0) > 0;
  const isFavorable = balance >= 2;
  const isPressure = balance <= -2;

  const ratings = {
    careerOpportunity: clampScore(3 + (hasWealth || hasOutput ? 1 : 0) + (isFavorable ? 1 : 0) - (hasConflict && isPressure ? 1 : 0)),
    organizationFriction: clampScore(2 + (hasOfficer ? 1 : 0) + (hasConflict ? 1 : 0) + (isPressure ? 1 : 0)),
    nobleSupport: clampScore(2 + (hasResource ? 2 : 0) + (isFavorable ? 1 : 0) - (hasConflict && !hasResource ? 1 : 0)),
    financialConversion: clampScore(2 + (hasWealth ? 2 : 0) + (isFavorable ? 1 : 0) - (isPressure ? 1 : 0)),
    physicalDrain: clampScore(2 + (isPressure ? 1 : 0) + (hasConflict ? 1 : 0) + (hasWealth && baseStrength === '身弱' ? 1 : 0))
  };

  return {
    baseStrength,
    dayElement,
    favorableRoles,
    unfavorableRoles,
    tendency,
    balance,
    roleWeights,
    _legacy: {
      triggerLabels: 'deprecated; prefer primaryTriggerLabels for report interpretation and lifeEventSignals.',
      dominantTriggerLabels: 'removed alias; use primaryTriggerLabels.'
    },
    triggerLabels,
    primaryTriggerLabels,
    roleReality: triggerLabels.map(role => ({
      role,
      ...(ROLE_REALITY[role] || {})
    })),
    ratings,
    notes: [
      '评分为命理解释辅助标签，不代表确定性预测。',
      '实际判断需结合现实资源、组织承接、预算授权和个人选择校准。'
    ]
  };
}

function buildYearFortune(ln, daYun, pillars, scores, dayGan) {
  const daYunGanZhi = daYun.getGanZhi() || null;
  const relationAnalysis = analyzeYearRelations(ln.getGanZhi(), pillars, daYunGanZhi);
  const formationAnalysis = analyzeBranchFormations(ln.getGanZhi(), pillars, daYunGanZhi);
  const combinationTransformations = analyzeCombinationTransformations(
    relationAnalysis,
    scores,
    ln.getGanZhi(),
    daYunGanZhi
  );
  const tendencyAnalysis = analyzeYearTendency(
    ln.getGanZhi(),
    daYunGanZhi,
    scores,
    dayGan,
    relationAnalysis
  );
  return {
    year: ln.getYear(),
    ganZhi: ln.getGanZhi(),
    age: ln.getAge(),
    daYun: {
      ganZhi: daYun.getGanZhi() || '（起运前）',
      startYear: daYun.getStartYear(),
      endYear: daYun.getEndYear(),
      startAge: daYun.getStartAge(),
      endAge: daYun.getEndAge()
    },
    liuYue: ln.getLiuYue().map(m => {
      const monthRelationAnalysis = analyzeYearRelations(m.getGanZhi(), pillars, daYunGanZhi, '流月');
      const monthFormationAnalysis = analyzeBranchFormations(m.getGanZhi(), pillars, daYunGanZhi, '流月');
      const monthTendencyAnalysis = analyzeYearTendency(
        m.getGanZhi(),
        daYunGanZhi,
        scores,
        dayGan,
        monthRelationAnalysis
      );
      return {
        month: m.getMonthInChinese(),
        ganZhi: m.getGanZhi(),
        relationAnalysis: monthRelationAnalysis,
        formationAnalysis: monthFormationAnalysis,
        tendencyAnalysis: monthTendencyAnalysis,
        lifeEventSignals: inferLifeEventSignals(
          monthRelationAnalysis,
          monthFormationAnalysis,
          monthTendencyAnalysis
        )
      };
    }),
    relations: {
      yearPillar: pillars.year.ganZhi,
      monthPillar: pillars.month.ganZhi,
      dayPillar: pillars.day.ganZhi,
      timePillar: pillars.time.ganZhi
    },
    relationAnalysis,
    formationAnalysis,
    combinationTransformations,
    tendencyAnalysis,
    lifeEventSignals: inferLifeEventSignals(
      relationAnalysis,
      formationAnalysis,
      tendencyAnalysis
    )
  };
}

function relationBetween(sourceGanZhi, targetGanZhi, sourceLabel, targetLabel) {
  const source = splitGanZhi(sourceGanZhi);
  const target = splitGanZhi(targetGanZhi);
  const relations = [];
  const ganPair = `${source.gan}${target.gan}`;
  const zhiPair = `${source.zhi}${target.zhi}`;

  if (sourceGanZhi === targetGanZhi) relations.push({ type: '伏吟', description: `${sourceLabel}与${targetLabel}同为${sourceGanZhi}` });
  if (GAN_COMBINE[ganPair]) relations.push({ type: '天干合', description: GAN_COMBINE[ganPair] });
  if (GAN_CLASH[ganPair]) relations.push({ type: '天干冲', description: GAN_CLASH[ganPair] });
  if (ZHI_LIUHE[zhiPair]) relations.push({ type: '地支六合', description: ZHI_LIUHE[zhiPair] });
  if (ZHI_CHONG[zhiPair]) relations.push({ type: '地支冲', description: ZHI_CHONG[zhiPair] });
  if (ZHI_HAI[zhiPair]) relations.push({ type: '地支害', description: ZHI_HAI[zhiPair] });
  if (ZHI_XING_PAIRS[zhiPair]) relations.push({ type: '地支刑', description: ZHI_XING_PAIRS[zhiPair] });
  if (source.zhi === target.zhi && ['辰', '午', '酉', '亥'].includes(source.zhi)) {
    relations.push({ type: '自刑', description: `${source.zhi}${source.zhi}自刑` });
  }
  if (GAN_CLASH[ganPair] && ZHI_CHONG[zhiPair]) {
    relations.push({ type: '反吟/天克地冲', description: `${sourceLabel}与${targetLabel}天干相冲、地支相冲` });
  }

  return relations.length ? { source: sourceLabel, target: targetLabel, sourceGanZhi, targetGanZhi, relations } : null;
}

function analyzeYearRelations(yearGanZhi, pillars, daYunGanZhi, sourceLabel = '流年') {
  const pillarRelations = Object.entries(pillars)
    .map(([key, pillar]) => relationBetween(yearGanZhi, pillar.ganZhi, sourceLabel, `${key}柱`))
    .filter(Boolean);
  const daYunRelation = daYunGanZhi ? relationBetween(yearGanZhi, daYunGanZhi, sourceLabel, '大运') : null;
  const flags = [];
  for (const item of [...pillarRelations, daYunRelation].filter(Boolean)) {
    for (const r of item.relations) {
      if (!flags.includes(r.type)) flags.push(r.type);
    }
  }
  return {
    yearGanZhi,
    daYunGanZhi: daYunGanZhi || null,
    pillarRelations,
    daYunRelation,
    flags
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
    console.error(`[bazi-chart] 时间校正: ${opts.solar} ${opts.hour}:${String(opts.minute).padStart(2,'0')} → ${useSolar} ${useHour}:${String(timeNorm.corrected.minute).padStart(2,'0')}`);
  } else {
    fail('time_normalization_failed', '时间校正失败，停止排盘；请检查出生地、当地时间和运行环境', { solar: opts.solar, hour: opts.hour, minute: opts.minute, birthplace: opts.birthplace });
  }

  const { year, month, day } = parseSolarDate(useSolar);

  let solar, lunar, ec;
  try {
    solar = Solar.fromYmdHms(year, month, day, useHour, useMinute, 0);
    lunar = solar.getLunar();
    ec = calendarBasis(timeNorm);
  } catch (e) {
    fail('calc_error', `排盘计算失败: ${e.message}`, opts.solar);
  }

  const isMale = opts.gender === 'male';
  const dayGan = ec.getDayGan();

  // ── 四柱 ──
  const gans = [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ec.getTimeGan()];
  const zhis = [ec.getYearZhi(), ec.getMonthZhi(), ec.getDayZhi(), ec.getTimeZhi()];
  const pillars = {
    year:  { gan: gans[0], zhi: zhis[0], ganZhi: ec.getYear(),  wuXing: ec.getYearWuXing() },
    month: { gan: gans[1], zhi: zhis[1], ganZhi: ec.getMonth(), wuXing: ec.getMonthWuXing() },
    day:   { gan: gans[2], zhi: zhis[2], ganZhi: ec.getDay(),   wuXing: ec.getDayWuXing() },
    time:  { gan: gans[3], zhi: zhis[3], ganZhi: ec.getTime(),  wuXing: ec.getTimeWuXing() }
  };

  // ── 十神 ──
  const tenGods = {
    year:  { gan: ec.getYearShiShenGan(),  zhi: ec.getYearShiShenZhi() },
    month: { gan: ec.getMonthShiShenGan(), zhi: ec.getMonthShiShenZhi() },
    day:   { gan: '日主',                   zhi: ec.getDayShiShenZhi() },
    time:  { gan: ec.getTimeShiShenGan(),  zhi: ec.getTimeShiShenZhi() }
  };

  // ── 藏干 ──
  const hiddenStems = {
    year:  ec.getYearHideGan(),
    month: ec.getMonthHideGan(),
    day:   ec.getDayHideGan(),
    time:  ec.getTimeHideGan()
  };

  // ── 纳音 ──
  const nayin = {
    year:  ec.getYearNaYin(),
    month: ec.getMonthNaYin(),
    day:   ec.getDayNaYin(),
    time:  ec.getTimeNaYin()
  };

  // ── 五行分数 ──
  const { scores, ganScores } = calcFiveElements(gans, zhis);

  // ── 日主信息 ──
  const dayMaster = {
    gan: dayGan,
    yinYang: getYinYang(dayGan),
    wuXing: GAN_WUXING[dayGan]
  };

  // ── 地势（十二长生） ──
  const diShi = {
    year:  ec.getYearDiShi(),
    month: ec.getMonthDiShi(),
    day:   ec.getDayDiShi(),
    time:  ec.getTimeDiShi()
  };

  // ── 旬空 ──
  const xunKong = {
    year:  { xun: ec.getYearXun(),  kong: ec.getYearXunKong() },
    day:   { xun: ec.getDayXun(),   kong: ec.getDayXunKong() }
  };

  // ── 胎元、胎息、命宫、身宫 ──
  const extra = {
    taiYuan:     { ganZhi: ec.getTaiYuan(),  naYin: ec.getTaiYuanNaYin() },
    taiXi:       { ganZhi: ec.getTaiXi(),    naYin: ec.getTaiXiNaYin() },
    mingGong:    { ganZhi: ec.getMingGong(),  naYin: ec.getMingGongNaYin() },
    shenGong:    { ganZhi: ec.getShenGong(),  naYin: ec.getShenGongNaYin() }
  };

  // ── 大运 ──
  const yun = ec.getYun(isMale ? 1 : 0);
  const yunStart = {
    years: yun.getStartYear(),
    months: yun.getStartMonth(),
    days: yun.getStartDay(),
    startSolar: yun.getStartSolar().toString()
  };

  const dayunList = yun.getDaYun();
  const majorFortune = dayunList.map(d => {
    const gz = d.getGanZhi();
    return {
      ganZhi: gz || '（起运前）',
      startYear: d.getStartYear(),
      endYear: d.getEndYear(),
      startAge: d.getStartAge(),
      endAge: d.getEndAge()
    };
  });

  // ── 流年快查模式 ──
  if (opts.year) {
    const targetYear = opts.year;
    let yearFortune = null;

    for (const d of dayunList) {
      if (targetYear >= d.getStartYear() && targetYear <= d.getEndYear()) {
        const liuNianList = d.getLiuNian();
        const ln = liuNianList.find(l => l.getYear() === targetYear);
        if (ln) {
          yearFortune = buildYearFortune(ln, d, pillars, scores, dayGan);
        }
        break;
      }
    }

    if (!yearFortune) fail('unsupported_year', '目标年份超出本命盘可计算的大运范围', { targetYear });

    const quickResult = {
      mode: 'yearFortune',
      input: {
        solar: opts.solar,
        hour: opts.hour,
        minute: opts.minute,
        gender: opts.gender,
        birthplace: opts.birthplace,
        targetYear: targetYear
      },
      pillars,
      dayMaster,
      fiveElements: { scores, ganScores },
      yearFortune,
      timeCorrection
    };

    attachSchemaValidation(quickResult, validateBaziOutput);
    process.stdout.write(JSON.stringify(quickResult, null, 2) + '\n');
    return;
  }

  // ── 当前流年（完整模式） ──
  const currentYear = new Date(Date.now() + 8 * 3600000).getUTCFullYear();
  let annualFortune = null;
  for (const d of dayunList) {
    if (currentYear >= d.getStartYear() && currentYear <= d.getEndYear()) {
      const liuNianList = d.getLiuNian();
      const ln = liuNianList.find(l => l.getYear() === currentYear);
      if (ln) {
        annualFortune = buildYearFortune(ln, d, pillars, scores, dayGan);
      }
      break;
    }
  }

  // ── 组装输出 ──
  const result = {
    input: {
      solar: opts.solar,
      hour: opts.hour,
      minute: opts.minute,
      gender: opts.gender,
      birthplace: opts.birthplace,
      lunarDate: lunar.toString(),
      solarDate: solar.toString()
    },
    pillars,
    tenGods,
    hiddenStems,
    nayin,
    dayMaster,
    fiveElements: {
      scores,
      ganScores
    },
    diShi,
    xunKong,
    extra,
    majorFortune: {
      startInfo: yunStart,
      list: majorFortune
    },
    annualFortune,
    timeCorrection
  };

  attachSchemaValidation(result, validateBaziOutput);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
