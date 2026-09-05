#!/usr/bin/env node
/**
 * rule-matcher.mjs — 根据聚合排盘数据匹配经典规则命中点。
 *
 * 用法:
 * node scripts/rule-matcher.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] \
 *   --gender <male|female> --birthplace "城市名" [--from 2026] [--to 2035] [--ziwei-years 2026,2027]
 */

import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { loadReportFramework } from './report-framework.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const node = process.execPath;

function ruleSet(framework, id) {
  return framework?.classicalRules?.ruleSets?.find(item => item.id === id) || null;
}

function seasonForMonth(qiongtong, monthZhi) {
  return qiongtong?.seasonTable?.find(item => item.months.includes(monthZhi)) || null;
}

function dayNote(qiongtong, dayGan) {
  return qiongtong?.dayMasterNotes?.find(item => item.dayMaster === dayGan) || null;
}

function monthSpecific(qiongtong, dayGan, monthZhi) {
  return qiongtong?.monthSpecificHints?.find(item => item.dayMaster === dayGan && item.month === monthZhi) || null;
}

function high(scores, element, threshold) {
  return (scores?.[element] || 0) >= threshold;
}

function low(scores, element, threshold) {
  return (scores?.[element] || 0) <= threshold;
}

const WUXING_GENERATES = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const WUXING_CONTROLS = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
const TEN_GOD_ROLES = ['印星', '比劫', '食伤', '财星', '官杀'];

function elementRole(dayElement, element) {
  if (element === dayElement) return '比劫';
  if (WUXING_GENERATES[element] === dayElement) return '印星';
  if (WUXING_GENERATES[dayElement] === element) return '食伤';
  if (WUXING_CONTROLS[dayElement] === element) return '财星';
  if (WUXING_CONTROLS[element] === dayElement) return '官杀';
  return '未知';
}

function roleScoresFor(data) {
  const scores = data.base?.fiveElements?.scores || {};
  const dayElement = data.base?.dayMaster?.wuXing;
  const roleScores = Object.fromEntries(TEN_GOD_ROLES.map(role => [role, 0]));
  for (const [element, value] of Object.entries(scores)) {
    const role = elementRole(dayElement, element);
    if (roleScores[role] !== undefined) roleScores[role] += value || 0;
  }
  return roleScores;
}

function strengthLabelFor(data) {
  const scores = data.base?.fiveElements?.scores || {};
  const dayElement = data.base?.dayMaster?.wuXing;
  const total = Object.values(scores).reduce((sum, value) => sum + (value || 0), 0);
  const dayScore = scores[dayElement] || 0;
  return total && dayScore >= total * 0.3 ? '身强' : '身弱';
}

function formatRoleEvidence(roleScores) {
  return TEN_GOD_ROLES.map(role => `${role}${roleScores[role] || 0}`).join('、');
}

function matchRolePressureTrigger(trigger, context) {
  const pressureScore = (trigger.pressureRoles || [])
    .reduce((sum, role) => sum + (context.roleScores[role] || 0), 0);
  const minAbsolute = trigger.minAbsolute || 0;
  const minTotalRatio = (trigger.minTotalRatio || 0) * context.total;
  const supportOk = !trigger.mustExceedSupport || pressureScore > context.supportScore;
  return {
    pass: context.strengthLabel === trigger.strength &&
      pressureScore >= Math.max(minAbsolute, minTotalRatio) &&
      supportOk,
    evidence: `${context.strengthLabel}；${formatRoleEvidence(context.roleScores)}；${trigger.pressureRoles.join('+')} ${pressureScore}，扶身承接 ${context.supportScore}`
  };
}

function matchElementHighTrigger(trigger, context) {
  const entries = Object.entries(trigger.elements || {});
  return {
    pass: entries.every(([element, threshold]) => high(context.scores, element, threshold)),
    evidence: entries.map(([element]) => `${element} ${context.scores[element] || 0}`).join('，')
  };
}

function matchCombinationStatusTrigger(trigger, data) {
  for (const year of data.years || []) {
    const hit = (year.combinationTransformations || []).some(item =>
      item.status?.includes(trigger.statusIncludes)
    );
    if (hit) return { pass: true, evidence: `${year.year} 有${trigger.statusIncludes}/牵制` };
  }
  return { pass: false, evidence: `未见${trigger.statusIncludes}` };
}

function matchRelationFlagsTrigger(trigger, data) {
  for (const year of data.years || []) {
    const flags = year.relationAnalysis?.flags || [];
    const hit = flags.some(flag => (trigger.any || []).includes(flag));
    if (hit) return { pass: true, evidence: `${year.year} 触发 ${flags.join('、')}` };
  }
  return { pass: false, evidence: '未见指定冲动关系' };
}

function matchBingyaoTrigger(trigger, data, context) {
  if (!trigger?.type) return { pass: false, evidence: '规则缺少 trigger' };
  if (trigger.type === 'rolePressure') return matchRolePressureTrigger(trigger, context);
  if (trigger.type === 'elementHigh') return matchElementHighTrigger(trigger, context);
  if (trigger.type === 'combinationStatus') return matchCombinationStatusTrigger(trigger, data);
  if (trigger.type === 'relationFlags') return matchRelationFlagsTrigger(trigger, data);
  return { pass: false, evidence: `未知 trigger: ${trigger.type}` };
}

function matchQiongtong(data, framework) {
  const qiongtong = ruleSet(framework, 'qiongtong_tiaohou');
  const monthZhi = data.base?.pillars?.month?.zhi;
  const dayGan = data.base?.dayMaster?.gan;
  const matches = [];
  const season = seasonForMonth(qiongtong, monthZhi);
  const note = dayNote(qiongtong, dayGan);
  const specific = monthSpecific(qiongtong, dayGan, monthZhi);
  if (season) {
    matches.push({
      ruleId: 'qiongtong_tiaohou.season',
      source: qiongtong.source,
      title: `${season.season}季调候`,
      evidence: `月支 ${monthZhi} 属 ${season.season}：${season.condition}`,
      interpretation: `常见所需：${season.commonNeed.join('、')}。${season.caution}`
    });
  }
  if (note) {
    matches.push({
      ruleId: 'qiongtong_tiaohou.dayMaster',
      source: qiongtong.source,
      title: `${dayGan}日主调候重点`,
      evidence: `日主 ${dayGan}`,
      interpretation: note.focus
    });
  }
  if (specific) {
    matches.push({
      ruleId: 'qiongtong_tiaohou.monthSpecific',
      source: qiongtong.source,
      title: `${dayGan}日 ${monthZhi}月细化提示`,
      evidence: `日主 ${dayGan}，月支 ${monthZhi}`,
      interpretation: specific.hint
    });
  }
  return matches;
}

function matchBingyao(data, framework) {
  const bingyao = ruleSet(framework, 'shenfeng_bingyao');
  if (!bingyao?.rules) return [];
  const scores = data.base?.fiveElements?.scores || {};
  const total = Object.values(scores).reduce((sum, value) => sum + (value || 0), 0);
  const strengthLabel = strengthLabelFor(data);
  const roleScores = roleScoresFor(data);
  const supportScore = (roleScores['印星'] || 0) + (roleScores['比劫'] || 0);
  const context = { scores, total, strengthLabel, roleScores, supportScore };
  const matches = [];
  for (const rule of bingyao.rules) {
    const matched = matchBingyaoTrigger(rule.trigger, data, context);
    if (matched.pass) {
      matches.push({
        ruleId: `shenfeng_bingyao.${rule.illness}`,
        source: bingyao.source,
        title: rule.illness,
        evidence: matched.evidence,
        interpretation: `药：${rule.medicine.join('、')}。现实校验：${rule.realityCheck}`
      });
    }
  }
  return matches;
}

function matchInteraction(data, framework) {
  const interaction = ruleSet(framework, 'interaction_priority');
  const matches = [];
  if (!interaction) return matches;
  const dynamicYears = (data.years || []).filter(year => (year.formationAnalysis || []).some(item => item.strength === '动态成局'));
  if (dynamicYears.length) {
    matches.push({
      ruleId: 'interaction_priority.formation',
      source: interaction.source,
      title: '成局重于单点',
      evidence: dynamicYears.map(year => `${year.year}:${year.formationAnalysis.map(item => item.description).join('、')}`).join('；'),
      interpretation: '这些年份不能只看单个合冲，要先看成局五行对原局喜忌的放大作用。'
    });
  }
  const constrained = (data.years || []).filter(year => (year.combinationTransformations || []).some(item => item.status.includes('合而不化')));
  if (constrained.length) {
    matches.push({
      ruleId: 'interaction_priority.combinationTransform',
      source: interaction.source,
      title: '合化成立性',
      evidence: constrained.map(year => `${year.year}:${year.combinationTransformations.map(item => `${item.relation}/${item.status}`).join('、')}`).join('；'),
      interpretation: '看到合不直接视为好运，应判断是成势、牵制、绑定还是现实合作成本。'
    });
  }
  return matches;
}

const GEJU_BY_TENGOD = {
  '正官': '正官格',
  '七杀': '七杀格',
  '正财': '正财格',
  '偏财': '偏财格',
  '正印': '正印格',
  '偏印': '偏印格',
  '食神': '食神格',
  '伤官': '伤官格'
};

const EXTERNAL_GEJU_BY_TENGOD = {
  '比肩': '建禄/羊刃外格候选',
  '劫财': '建禄/羊刃外格候选'
};

function matchGeju(data, framework) {
  const geju = ruleSet(framework, 'ziping_geju');
  if (!geju?.patterns) return [];
  const monthTenGod = data.base?.tenGods?.month?.gan;
  const patternName = GEJU_BY_TENGOD[monthTenGod];
  const pattern = geju.patterns.find(item => item.name === patternName);
  if (!pattern) {
    const externalPattern = EXTERNAL_GEJU_BY_TENGOD[monthTenGod];
    if (!externalPattern) return [];
    return [{
      ruleId: 'ziping_geju.外格候选',
      source: geju.source,
      title: externalPattern,
      evidence: `月干十神 ${monthTenGod || '-'}，月支 ${data.base?.pillars?.month?.zhi || '-'}；不入正八格，属传统外格/杂格候选范围。`,
      interpretation: '外格判断需结合月支主气、日主根气、刑冲合会、调候和现实承接综合判定；当前规则文件未实现外格 matcher，此处只提示不可误读为“无格局”。'
    }];
  }
  const strengthLabel = strengthLabelFor(data);
  const roleScores = roleScoresFor(data);
  const supportScore = (roleScores['印星'] || 0) + (roleScores['比劫'] || 0);
  const pressureScore = (roleScores['食伤'] || 0) + (roleScores['财星'] || 0) + (roleScores['官杀'] || 0);
  const successHint = supportScore >= pressureScore ? pattern.success.slice(0, 2) : [];
  const failureHint = pressureScore > supportScore ? pattern.failure.slice(0, 2) : [];
  return [{
    ruleId: `ziping_geju.${pattern.name}`,
    source: geju.source,
    title: `${pattern.name}成败边界`,
    evidence: `月干十神 ${monthTenGod}，月支 ${data.base?.pillars?.month?.zhi || '-'}；${strengthLabel}；${formatRoleEvidence(roleScores)}`,
    interpretation: [
      successHint.length ? `可用条件：${successHint.join('、')}` : null,
      failureHint.length ? `破格风险：${failureHint.join('、')}` : null,
      '此处只做格局候选提示，最终需回到月令、透干、根气、调候和现实承接。'
    ].filter(Boolean).join('；')
  }];
}

function matchCombinationTransform(data, framework) {
  const combination = ruleSet(framework, 'combination_transform_conditions');
  if (!combination) return [];
  const items = (data.years || [])
    .flatMap(year => (year.combinationTransformations || []).map(item => ({ year: year.year, ...item })))
    .filter(item => item.relation);
  if (!items.length) return [];
  return [{
    ruleId: 'combination_transform_conditions.dynamic',
    source: combination.source,
    title: '合化成立条件',
    evidence: items.slice(0, 6).map(item => `${item.year}:${item.relation}/${item.status || '-'}`).join('；'),
    interpretation: `${combination.principle}；核对项：${(combination.conditions || []).slice(0, 4).join('、')}。`
  }];
}

function matchShenshaBoundaries(data, framework) {
  const shensha = ruleSet(framework, 'shensha_boundaries');
  if (!shensha) return [];
  const spirits = (data.base?.classic?.spirits || []).flatMap(item =>
    (item.spirits || []).map(name => ({
      name,
      position: item.position,
      pillar: item.pillar
    }))
  );
  const findSpirit = aliases => spirits.filter(item => aliases.some(alias => item.name.includes(alias)));
  const hasMove = (data.years || []).some(year => year.lifeEventSignals?.cityMove?.level === '中高');
  const hasStudy = (data.years || []).some(year => ['中', '高'].includes(year.lifeEventSignals?.studyAndExams?.level));
  const matches = [];
  const yima = findSpirit(['驿马']);
  const studySpirits = findSpirit(['文昌', '学堂']);
  if (hasMove && yima.length) {
    const rule = shensha.rules.find(item => item.name === '驿马');
    matches.push({
      ruleId: 'shensha_boundaries.yima',
      source: shensha.source,
      title: '迁移信号边界',
      evidence: `原局神煞 ${yima.map(item => `${item.name}@${item.position}`).join('、')}；年度 lifeEventSignals.cityMove 出现中高信号`,
      interpretation: `${rule.use}；边界：${rule.boundary}`
    });
  }
  if (hasStudy && studySpirits.length) {
    const rule = shensha.rules.find(item => item.name === '文昌/学堂');
    matches.push({
      ruleId: 'shensha_boundaries.study',
      source: shensha.source,
      title: '学业考试边界',
      evidence: `原局神煞 ${studySpirits.map(item => `${item.name}@${item.position}`).join('、')}；年度 lifeEventSignals.studyAndExams 被引动`,
      interpretation: `${rule.use}；边界：${rule.boundary}`
    });
  }
  return matches;
}

function matchDayunTransition(data, framework) {
  const dayun = ruleSet(framework, 'dayun_transition');
  if (!dayun) return [];
  const years = data.years || [];
  const transitionYears = [];
  for (let i = 1; i < years.length; i++) {
    const previous = years[i - 1]?.bazi?.daYun?.ganZhi;
    const current = years[i]?.bazi?.daYun?.ganZhi;
    if (previous && current && previous !== current && !previous.includes('起运前') && !current.includes('起运前')) {
      transitionYears.push({
        previousYear: years[i - 1].year,
        year: years[i].year,
        from: previous,
        to: current
      });
    }
  }
  if (!transitionYears.length) return [];
  return [{
    ruleId: 'dayun_transition.window',
    source: dayun.source,
    title: '大运切换前后应期',
    evidence: transitionYears.map(item => `${item.previousYear}-${item.year}: ${item.from}→${item.to}`).join('；'),
    interpretation: '换运前后不宜机械断为立刻转好或转坏，要看旧运收束、新运主题进入，以及流年是否给到现实承接。'
  }];
}

function matchFuyinFanyin(data, framework) {
  const fuyin = ruleSet(framework, 'fuyin_fanyin_boundaries');
  if (!fuyin) return [];
  const years = data.years || [];
  const matched = years.filter(year => (year.relationAnalysis?.flags || []).some(flag => /伏吟|反吟/.test(flag)));
  if (!matched.length) return [];
  return [{
    ruleId: 'fuyin_fanyin_boundaries.trigger',
    source: fuyin.source,
    title: '伏吟反吟边界',
    evidence: matched.map(year => `${year.year}:${year.relationAnalysis.flags.filter(flag => /伏吟|反吟/.test(flag)).join('、')}`).join('；'),
    interpretation: '伏吟/反吟是议题放大器，不单独断吉凶；需进一步落到哪一柱、哪一类现实事项，以及是否有可承接的新平台。'
  }];
}

function matchTenGodMapping(data, framework) {
  const mapping = ruleSet(framework, 'ten_god_modern_mapping');
  if (!mapping?.mappings) return [];
  const labels = new Set();
  for (const year of data.years || []) {
    const weights = year.tendencyAnalysis?.roleWeights || {};
    const entries = Object.entries(weights).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
    const avg = entries.length ? entries.reduce((sum, [, value]) => sum + value, 0) / entries.length : 0;
    const top = entries.filter(([, value]) => value >= avg * 1.5).slice(0, 2);
    for (const [role] of (top.length ? top : entries.slice(0, 2))) labels.add(role);
  }
  const matches = [];
  for (const item of mapping.mappings) {
    if (!labels.has(item.tenGod)) continue;
    matches.push({
      ruleId: `ten_god_modern_mapping.${item.tenGod}`,
      source: mapping.source,
      title: `${item.tenGod}现实映射`,
      evidence: `年度触发标签包含 ${item.tenGod}`,
      interpretation: `现实用法：${item.modernUse.join('、')}。风险：${item.risk}`
    });
  }
  return matches;
}

function matchCalibration(data) {
  const calibration = data.userCalibration;
  if (!calibration) return [];
  return [{
    ruleId: 'calibration_event_table.status',
    source: 'calibration-template',
    title: `现实校准状态：${calibration.status || '未校准'}`,
    evidence: `事件数 ${calibration.events?.length || 0}；反向例 ${calibration.falsePositives?.length || 0}；漏触发 ${calibration.falseNegatives?.length || 0}`,
    interpretation: calibration.note || '未提供历史事件时，只能按先验信号保守解释，不能把年度信号写成已经验证的个人规律。'
  }];
}

export function matchClassicalRules(data) {
  const framework = data.reportFramework || loadReportFramework();
  const categories = [
    { id: 'qiongtong_tiaohou', name: '调候规则命中', matches: matchQiongtong(data, framework) },
    { id: 'ziping_geju', name: '格局成败命中', matches: matchGeju(data, framework) },
    { id: 'shenfeng_bingyao', name: '病药规则命中', matches: matchBingyao(data, framework) },
    { id: 'interaction_priority', name: '作用优先级命中', matches: matchInteraction(data, framework) },
    { id: 'shensha_boundaries', name: '神煞边界命中', matches: matchShenshaBoundaries(data, framework) },
    { id: 'combination_transform_conditions', name: '合化条件命中', matches: matchCombinationTransform(data, framework) },
    { id: 'dayun_transition', name: '大运切换命中', matches: matchDayunTransition(data, framework) },
    { id: 'fuyin_fanyin_boundaries', name: '伏吟反吟边界命中', matches: matchFuyinFanyin(data, framework) },
    { id: 'ten_god_modern_mapping', name: '十神现代映射命中', matches: matchTenGodMapping(data, framework) },
    { id: 'calibration_event_table', name: '现实校准表', matches: matchCalibration(data) }
  ];
  return {
    summary: {
      categoryCount: categories.length,
      matchCount: categories.reduce((sum, category) => sum + category.matches.length, 0)
    },
    categories
  };
}

function parseArgs() {
  return process.argv.slice(2);
}

function main() {
  const args = parseArgs();
  const result = spawnSync(node, ['scripts/fortune-report-data.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status);
  }
  const data = JSON.parse(result.stdout);
  process.stdout.write(JSON.stringify(matchClassicalRules(data), null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
