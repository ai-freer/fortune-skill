#!/usr/bin/env node
/**
 * hecan-summary.mjs — 结构化合参与可解释置信度汇总。
 *
 * 用法:
 * node scripts/hecan-summary.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] \
 *   --gender <male|female> --birthplace "城市名" [--from 2026] [--to 2035] \
 *   [--ziwei-years 2026,2027] [--focus career,migration]
 */

import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { attachSchemaValidation, validateHecanSummaryOutput } from './schema-validators.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const node = process.execPath;

const DOMAIN_CONFIG = {
  career: {
    label: '事业/平台',
    lifeSignal: 'careerChange',
    ziweiKey: 'career',
    roles: ['官杀', '印星', '食伤'],
    ruleKeywords: ['官', '事业', '平台', '名分', '规则', '格局', '病药']
  },
  migration: {
    label: '迁移/外部平台',
    lifeSignal: 'cityMove',
    ziweiKey: 'migration',
    roles: ['驿马', '迁移', '官杀', '印星'],
    ruleKeywords: ['迁移', '驿马', '冲动', '换运', '外部']
  },
  wealth: {
    label: '财务/兑现',
    lifeSignal: 'familyAndAssets',
    ziweiKey: 'wealth',
    roles: ['财星', '食伤'],
    ruleKeywords: ['财', '合化', '兑现', '资产', '预算']
  },
  relationship: {
    label: '关系/伴侣',
    lifeSignal: 'relationshipChange',
    ziweiKey: 'relationship',
    roles: ['官杀', '财星', '比劫'],
    ruleKeywords: ['关系', '夫妻', '合', '冲', '家庭']
  },
  home: {
    label: '家庭/田宅',
    lifeSignal: 'familyAndAssets',
    ziweiKey: 'home',
    roles: ['财星', '印星', '比劫'],
    ruleKeywords: ['田宅', '家庭', '资产', '父母', '长辈']
  },
  health: {
    label: '健康/消耗',
    lifeSignal: 'healthStress',
    ziweiKey: 'health',
    roles: ['印星', '比劫', '官杀'],
    ruleKeywords: ['健康', '疾厄', '病药', '消耗', '伏吟', '反吟']
  },
  study: {
    label: '学业/文书',
    lifeSignal: 'studyAndExams',
    ziweiKey: 'study',
    roles: ['印星', '食伤', '官杀'],
    ruleKeywords: ['学业', '文昌', '学堂', '文书', '资质']
  }
};

const SIGNAL_SCORE = { '低': 0, '中': 1, '中高': 2, '高': 3 };
const CALIBRATION_BONUS = { '未校准': 0, '弱校准': 0.04, '中校准': 0.08, '强校准': 0.12 };
const CALIBRATION_CAP = { '未校准': 0.74, '弱校准': 0.82, '中校准': 0.9, '强校准': 1 };
const CONFIDENCE_BASE = 0.24;
const HECAN_CARD_VERSION = 'v2';
const DOMAIN_COVERAGE_POLICY = {
  career: {
    minEvidenceNodes: 4,
    requiredSources: ['bazi', 'ziwei', 'rule'],
    requiredReportBoundaries: ['组织授权', '岗位名分', '现金流', '健康承接']
  },
  migration: {
    minEvidenceNodes: 3,
    requiredSources: ['bazi', 'ziwei'],
    requiredReportBoundaries: ['城市平台', '家庭成本', '退出机制']
  },
  wealth: {
    minEvidenceNodes: 4,
    requiredSources: ['bazi', 'ziwei', 'rule'],
    requiredReportBoundaries: ['预算', '现金流', '资产风险', '财务专业意见']
  },
  relationship: {
    minEvidenceNodes: 3,
    requiredSources: ['bazi', 'ziwei'],
    requiredReportBoundaries: ['沟通', '边界', '双方选择', '共同资产']
  },
  home: {
    minEvidenceNodes: 3,
    requiredSources: ['bazi', 'ziwei'],
    requiredReportBoundaries: ['家庭协商', '居住安排', '产权/预算', '长辈责任']
  },
  health: {
    minEvidenceNodes: 3,
    requiredSources: ['bazi', 'ziwei'],
    requiredReportBoundaries: ['睡眠', '压力恢复', '医学诊断', '低风险调整']
  },
  study: {
    minEvidenceNodes: 3,
    requiredSources: ['bazi', 'ziwei'],
    requiredReportBoundaries: ['学习方式', '考试规则', '家庭支持', '身心节奏']
  }
};

const DOMAIN_EVENT_KEYWORDS = {
  career: ['工作', '职业', '事业', '岗位', '升职', '离职', '跳槽', '创业', '平台'],
  migration: ['城市', '迁移', '搬家', '搬迁', '跨城', '出国', '移民', '外派'],
  wealth: ['财务', '财务投资', '投资', '资产', '买房', '卖房', '融资', '收入', '现金流'],
  relationship: ['伴侣', '关系', '婚恋', '结婚', '分手', '离婚', '合作'],
  home: ['家庭', '家庭资产', '田宅', '居住', '房产', '长辈', '子女'],
  health: ['健康', '疾病', '生病', '手术', '睡眠', '焦虑', '身心'],
  study: ['学业', '考试', '升学', '证书', '学习', '文书']
};

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const opts = { rawArgs, focus: null };
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--focus' && rawArgs[i + 1]) {
      opts.focus = rawArgs[i + 1].split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
    }
  }
  return opts;
}

function runReportData(rawArgs) {
  const filteredArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--focus') {
      i += 1;
      continue;
    }
    filteredArgs.push(rawArgs[i]);
  }

  const result = spawnSync(node, ['scripts/fortune-report-data.mjs', ...filteredArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    process.stdout.write(JSON.stringify({
      error: 'invalid_report_data_json',
      message: error.message,
      stdout: result.stdout.slice(0, 1000)
    }, null, 2) + '\n');
    process.exit(1);
  }
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function signalValue(signal) {
  return SIGNAL_SCORE[signal?.signalIntensity || signal?.level] ?? 0;
}

function confidenceLabel(score) {
  if (score >= 0.75) return '高';
  if (score >= 0.55) return '中高';
  if (score >= 0.35) return '中';
  return '低';
}

function roundScore(value) {
  return Number(value.toFixed(4));
}

function yearsScope(years = []) {
  const validYears = years.map(year => year.year).filter(Number.isInteger);
  if (!validYears.length) return '未指定年份范围';
  const from = Math.min(...validYears);
  const to = Math.max(...validYears);
  return from === to ? String(from) : `${from}-${to}`;
}

function evidenceLayer(source, type, fieldPath = '') {
  if (source === 'bazi' && fieldPath.startsWith('base.')) return 'base_chart';
  if (source === 'bazi' && fieldPath.startsWith('years[')) return 'annual_fortune';
  if (source === 'ziwei' && fieldPath.startsWith('base.')) return 'ziwei_base_or_decadal';
  if (source === 'ziwei' && fieldPath.startsWith('ziweiYears[')) return 'ziwei_annual';
  if (source === 'rule') return 'classical_rule';
  if (source === 'calibration') return 'historical_calibration';
  return type || 'unknown';
}

function domainKeywords(domain) {
  return [
    ...(DOMAIN_EVENT_KEYWORDS[domain] || []),
    DOMAIN_CONFIG[domain]?.label || '',
    ...(DOMAIN_CONFIG[domain]?.ruleKeywords || [])
  ].filter(Boolean);
}

function textMatchesDomain(text, domain) {
  const haystack = String(text || '');
  return domainKeywords(domain).some(keyword => haystack.includes(keyword));
}

function maxBaziSignal(years, domain) {
  const config = DOMAIN_CONFIG[domain];
  let best = null;
  for (const year of years || []) {
    const signal = year.lifeEventSignals?.[config.lifeSignal];
    const value = signalValue(signal);
    if (!best || value > best.value) {
      best = { year: year.year, signal, value, tendency: year.tendencyAnalysis };
    }
  }
  return best || { value: 0, signal: null, tendency: null };
}

function baziEvidenceFor(years, domain) {
  const config = DOMAIN_CONFIG[domain];
  return (years || [])
    .map((year, index) => {
      const signal = year.lifeEventSignals?.[config.lifeSignal];
      const labels = year.tendencyAnalysis?.primaryTriggerLabels || [];
      const relevantLabels = labels.filter(label => config.roles.includes(label));
      const relationFlags = year.relationAnalysis?.flags || [];
      const formations = (year.formationAnalysis || [])
        .filter(item => item.strength === '动态成局')
        .map(item => item.description);
      const score = signalValue(signal);
      if (!score && !relevantLabels.length && !formations.length) return null;
      return {
        source: 'bazi',
        type: 'year_signal',
        fieldPath: `years[${index}].lifeEventSignals.${config.lifeSignal}`,
        layer: 'annual_fortune',
        aspect: config.lifeSignal,
        year: year.year,
        timeScope: String(year.year),
        signal: signal?.signalIntensity || '低',
        polarity: 'support',
        summary: `${year.year} ${config.label}信号 ${signal?.signalIntensity || '低'}；主触发 ${relevantLabels.join('、') || labels.slice(0, 2).join('、') || '-'}；关系 ${relationFlags.slice(0, 3).join('、') || '-'}`,
        weight: clamp((score + relevantLabels.length) / 5)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
}

function ziweiScoreFor(data, domain) {
  const config = DOMAIN_CONFIG[domain];
  const candidates = [];
  const base = data.base?.ziwei?.currentDomainScores || data.base?.ziwei?.domainScores;
  if (base?.[config.ziweiKey]) candidates.push({ scope: data.base?.ziwei?.domainScoreScope?.label || '当前运限', ...base[config.ziweiKey] });
  for (const item of data.ziweiYears || []) {
    if (item.domainScores?.[config.ziweiKey]) {
      candidates.push({ scope: String(item.year), ...item.domainScores[config.ziweiKey] });
    }
  }
  return candidates.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
}

function ziweiEvidenceFor(data, domain) {
  const config = DOMAIN_CONFIG[domain];
  const evidence = [];
  const score = ziweiScoreFor(data, domain);
  if (score) {
    const baseScores = data.base?.ziwei?.currentDomainScores || data.base?.ziwei?.domainScores;
    const hasBaseDomainScore = Boolean(baseScores?.[config.ziweiKey]);
    const yearIndex = (data.ziweiYears || []).findIndex(item => String(item.year) === String(score.scope));
    const fieldPath = yearIndex >= 0
      ? `ziweiYears[${yearIndex}].domainScores.${config.ziweiKey}`
      : `${data.base?.ziwei?.currentDomainScores ? 'base.ziwei.currentDomainScores' : 'base.ziwei.domainScores'}.${config.ziweiKey}`;
    evidence.push({
      source: 'ziwei',
      type: 'domain_score',
      fieldPath: hasBaseDomainScore || yearIndex >= 0 ? fieldPath : null,
      layer: yearIndex >= 0 ? 'ziwei_annual' : 'ziwei_base_or_decadal',
      aspect: config.ziweiKey,
      scope: score.scope,
      timeScope: score.scope,
      signal: score.score ?? null,
      polarity: 'support',
      summary: `${score.scope} ${config.label}：${score.tendency || '-'}(${score.score ?? '-'}/5)；关键词 ${score.keywords?.slice(0, 4).join('、') || '-'}`,
      weight: clamp((score.score || 0) / 5)
    });
  }

  for (const [index, item] of (data.ziweiYears || []).entries()) {
    const interactions = (item.mutagenInteractions || []).filter(interaction => {
      const text = `${interaction.type || ''}${interaction.palaceName || ''}${interaction.note || ''}${interaction.description || ''}`;
      return config.ruleKeywords.some(keyword => text.includes(keyword)) ||
        (score?.mutagens || []).some(mutagen => mutagen.palaceName && text.includes(mutagen.palaceName));
    });
    if (interactions.length) {
      evidence.push({
        source: 'ziwei',
        type: 'mutagen_interaction',
        fieldPath: `ziweiYears[${index}].mutagenInteractions`,
        layer: 'ziwei_annual',
        aspect: 'mutagen_interaction',
        year: item.year,
        timeScope: String(item.year),
        signal: interactions.length,
        polarity: 'support',
        summary: `${item.year} 四化交互：${interactions.slice(0, 3).map(interaction => `${interaction.type || '交互'}@${interaction.palaceName || '-'}`).join('、')}`,
        weight: 0.55
      });
    }
  }
  return evidence.slice(0, 4);
}

function ruleEvidenceFor(ruleMatches, domain) {
  const config = DOMAIN_CONFIG[domain];
  const matches = [];
  for (const [categoryIndex, category] of (ruleMatches?.categories || []).entries()) {
    for (const [matchIndex, match] of (category.matches || []).entries()) {
      const text = `${category.name}${match.title}${match.evidence}${match.interpretation}`;
      if (config.ruleKeywords.some(keyword => text.includes(keyword)) ||
          config.roles.some(role => text.includes(role))) {
        matches.push({
          source: 'rule',
          type: category.id,
          fieldPath: `ruleMatches.categories[${categoryIndex}].matches[${matchIndex}]`,
          layer: 'classical_rule',
          aspect: category.id,
          ruleId: match.ruleId || category.id,
          timeScope: '规则命中',
          signal: match.title || category.name,
          polarity: 'support',
          summary: `${match.title}：${match.evidence}`,
          weight: 0.45
        });
      }
    }
  }
  return matches.slice(0, 4);
}

function calibrationEvidenceFor(calibration, domain) {
  if (!calibration || calibration.status === '未校准') return [];
  const matched = (calibration.events || []).filter(event => {
    const text = `${event.domain || ''}${event.event || ''}${event.impact || ''}${event.outcome || ''}`;
    return textMatchesDomain(text, domain);
  });
  if (!matched.length) return [];
  return matched.slice(0, 3).map((event, index) => ({
    source: 'calibration',
    type: 'historical_event_alignment',
    fieldPath: `userCalibration.events[${index}]`,
    layer: 'historical_calibration',
    aspect: event.domain || 'event',
    timeScope: event.date || '历史事件',
    signal: event.impact || event.outcome || event.event || '历史事件',
    polarity: 'support',
    summary: `${event.date || '历史'} ${event.domain || '事件'}：${event.event || '-'}；影响 ${event.impact || '-'}；结果 ${event.outcome || '-'}`,
    weight: clamp(0.35 + matched.length * 0.08, 0.35, 0.65)
  }));
}

function makeEvidenceNode(domain, item, index) {
  return {
    id: `${domain}.${item.source}.${item.type}.${index}`,
    source: item.source,
    type: item.type,
    system: item.source === 'rule' ? 'classical_rule' : item.source,
    layer: item.layer || evidenceLayer(item.source, item.type, item.fieldPath || ''),
    aspect: item.aspect || null,
    fieldPath: item.fieldPath || null,
    ruleId: item.ruleId || null,
    timeScope: item.timeScope || (item.year ? String(item.year) : item.scope || null),
    signal: item.signal ?? null,
    polarity: item.polarity || 'support',
    weight: roundScore(item.weight || 0),
    summary: item.summary
  };
}

function buildEvidenceNodes(domain, groupedEvidence) {
  return [
    ...(groupedEvidence.bazi || []),
    ...(groupedEvidence.ziwei || []),
    ...(groupedEvidence.rules || []),
    ...(groupedEvidence.calibration || [])
  ].map((item, index) => makeEvidenceNode(domain, item, index));
}

function coverageFor(domain, evidenceNodes) {
  const policy = DOMAIN_COVERAGE_POLICY[domain] || { minEvidenceNodes: 3, requiredSources: ['bazi', 'ziwei'], requiredReportBoundaries: [] };
  const supportNodes = (evidenceNodes || []).filter(node => node.polarity === 'support');
  const presentSources = [...new Set(supportNodes.map(node => node.source))];
  const missingSources = policy.requiredSources.filter(source => !presentSources.includes(source));
  const evidenceNodeCount = supportNodes.length;
  const status = missingSources.length
    ? 'missing_required_source'
    : evidenceNodeCount < policy.minEvidenceNodes
      ? 'thin'
      : 'pass';
  return {
    status,
    minEvidenceNodes: policy.minEvidenceNodes,
    evidenceNodeCount,
    requiredSources: policy.requiredSources,
    presentSources,
    missingSources,
    requiredReportBoundaries: policy.requiredReportBoundaries
  };
}

function calibrationProfileFor(calibration, domain) {
  const status = calibration?.status || '未校准';
  const events = calibration?.events || [];
  const falsePositives = calibration?.falsePositives || [];
  const falseNegatives = calibration?.falseNegatives || [];
  const domainEvents = events.filter(event => textMatchesDomain(`${event.domain || ''}${event.event || ''}${event.outcome || ''}`, domain));
  const domainFalsePositives = falsePositives.filter(event => textMatchesDomain(`${event.domain || ''}${event.event || ''}${event.note || ''}`, domain));
  const domainFalseNegatives = falseNegatives.filter(event => textMatchesDomain(`${event.domain || ''}${event.event || ''}${event.note || ''}`, domain));
  const baseBonus = CALIBRATION_BONUS[status] || 0;
  const domainBonus = Math.min(0.06, domainEvents.length * 0.02);
  const missPenalty = Math.min(0.12, domainFalsePositives.length * 0.025 + domainFalseNegatives.length * 0.035);
  const adjustment = clamp(baseBonus + domainBonus - missPenalty, -0.08, 0.18);
  const cap = Math.max(0.35, (CALIBRATION_CAP[status] ?? 0.74) - Math.min(0.16, (domainFalsePositives.length + domainFalseNegatives.length) * 0.04));
  return {
    status,
    events: events.length,
    domainEvents: domainEvents.length,
    falsePositives: falsePositives.length,
    falseNegatives: falseNegatives.length,
    domainFalsePositives: domainFalsePositives.length,
    domainFalseNegatives: domainFalseNegatives.length,
    adjustment: roundScore(adjustment),
    cap: roundScore(cap)
  };
}

function riskBoundaryFor(domain) {
  const boundaries = {
    career: '事业判断落到岗位名分、组织授权、现金流、健康承接和可退出方案；这些是承接条件，不用于削弱事业信号。',
    migration: '迁移判断写城市平台、家庭成本、预算、身份/签证或居住条件和退出机制；重点是承接路径，不把迁移信号简化成搬迁断语。',
    wealth: '财务判断只写预算、现金流和资产风险边界，不构成投资建议；重大财务决策以专业财务意见为准。',
    relationship: '关系判断写沟通模式、共同资产、压力来源和双方选择；重点是把关系信号落到可协商事项，不替双方做分合决定。',
    home: '家庭/田宅判断回到家庭协商、居住安排、产权/预算和长辈责任；重点是说明家庭信号如何承接现实安排。',
    health: '健康判断只作为身心消耗和恢复节奏观察，不构成医学诊断；具体健康问题以医生意见为准。',
    study: '学业判断写学习方式、考试规则、家庭支持和身心节奏；避免把考试信号写成必然录取或落榜。'
  };
  return boundaries[domain] || '判断作为命盘先验，需要结合现实资源、承接条件和个人选择。';
}

function counterEvidenceFor(domain, data, baziSignal, ziweiScore, evidenceCounts, time, calibrationStatus, evidenceNodes, coverage, calibrationProfile) {
  const config = DOMAIN_CONFIG[domain];
  const counters = [];
  const scope = yearsScope(data.years);
  const baziHigh = baziSignal.value >= 2;
  const baziLow = baziSignal.value === 0;
  const ziweiHigh = (ziweiScore?.score || 0) >= 4;
  const ziweiLow = ziweiScore && ziweiScore.score <= 2;

  if (baziLow && ziweiHigh) {
    counters.push({
      id: `${domain}.counter.bazi.low_signal`,
      source: 'bazi',
      type: 'low_signal',
      fieldPath: `years[].lifeEventSignals.${config.lifeSignal}`,
      layer: 'annual_fortune',
      aspect: config.lifeSignal,
      timeScope: scope,
      signal: '低',
      polarity: 'counter',
      weight: 0.5,
      summary: `${config.label} 紫微信号较强，但八字年度人生事件信号偏弱。`
    });
  }
  if (baziHigh && ziweiLow) {
    counters.push({
      id: `${domain}.counter.ziwei.low_score`,
      source: 'ziwei',
      type: 'low_domain_score',
      fieldPath: `ziwei.domainScores.${config.ziweiKey}`,
      layer: 'ziwei_domain_score',
      aspect: config.ziweiKey,
      timeScope: ziweiScore.scope,
      signal: ziweiScore.score,
      polarity: 'counter',
      weight: 0.5,
      summary: `${config.label} 八字信号较强，但紫微专项评分偏低。`
    });
  }
  if (evidenceCounts.rule === 0 && (baziHigh || ziweiHigh || (evidenceNodes || []).length >= 2)) {
    counters.push({
      id: `${domain}.counter.rules.missing_support`,
      source: 'rule',
      type: 'missing_rule_support',
      fieldPath: 'ruleMatches.categories',
      layer: 'classical_rule',
      aspect: 'missing_rule_support',
      timeScope: scope,
      signal: 0,
      polarity: 'constraint',
      weight: 0.4,
      summary: '缺少经典规则命中支撑，需避免把单一评分写成定论。'
    });
  }
  if (coverage?.missingSources?.length) {
    counters.push({
      id: `${domain}.counter.coverage.missing_required_source`,
      source: 'coverage',
      type: 'missing_required_source',
      fieldPath: 'judgments[].coverage',
      layer: 'coverage_policy',
      aspect: coverage.missingSources.join(','),
      timeScope: scope,
      signal: coverage.missingSources.join(','),
      polarity: 'constraint',
      weight: 0.35,
      summary: `领域覆盖缺少必要来源：${coverage.missingSources.join('、')}。`
    });
  }
  if (coverage?.status === 'thin') {
    counters.push({
      id: `${domain}.counter.coverage.thin_evidence`,
      source: 'coverage',
      type: 'thin_evidence',
      fieldPath: 'judgments[].coverage.evidenceNodeCount',
      layer: 'coverage_policy',
      aspect: 'evidence_density',
      timeScope: scope,
      signal: `${coverage.evidenceNodeCount}/${coverage.minEvidenceNodes}`,
      polarity: 'constraint',
      weight: 0.3,
      summary: `证据节点 ${coverage.evidenceNodeCount}/${coverage.minEvidenceNodes}，覆盖偏薄，写报告时需保守。`
    });
  }
  if (time.penalty > 0) {
    counters.push({
      id: `${domain}.counter.time.reliability_penalty`,
      source: 'time',
      type: 'time_reliability_penalty',
      fieldPath: 'base.timeCorrection',
      layer: 'time_reliability',
      aspect: 'birth_time',
      timeScope: '出生时刻',
      signal: roundScore(time.penalty),
      polarity: 'constraint',
      weight: roundScore(time.penalty),
      summary: time.assumptions.join('；') || '时间可靠性存在折减。'
    });
  }
  if (calibrationStatus === '未校准') {
    counters.push({
      id: `${domain}.counter.calibration.uncalibrated`,
      source: 'calibration',
      type: 'uncalibrated',
      fieldPath: 'userCalibration',
      layer: 'historical_calibration',
      aspect: 'uncalibrated',
      timeScope: scope,
      signal: calibrationStatus,
      polarity: 'constraint',
      weight: 0.3,
      summary: '未提供历史事件校准，结论只能作为命盘先验。'
    });
  } else if (calibrationProfile?.domainEvents === 0) {
    counters.push({
      id: `${domain}.counter.calibration.domain_gap`,
      source: 'calibration',
      type: 'domain_calibration_gap',
      fieldPath: 'userCalibration.events',
      layer: 'historical_calibration',
      aspect: 'domain_gap',
      timeScope: scope,
      signal: calibrationStatus,
      polarity: 'constraint',
      weight: 0.25,
      summary: `虽有历史校准样本，但${config.label}领域缺少同类事件样本。`
    });
  }
  if ((calibrationProfile?.domainFalsePositives || 0) + (calibrationProfile?.domainFalseNegatives || 0) > 0) {
    counters.push({
      id: `${domain}.counter.calibration.misses`,
      source: 'calibration',
      type: 'domain_calibration_misses',
      fieldPath: 'userCalibration.falsePositives/userCalibration.falseNegatives',
      layer: 'historical_calibration',
      aspect: 'false_positive_false_negative',
      timeScope: scope,
      signal: `${calibrationProfile.domainFalsePositives}/${calibrationProfile.domainFalseNegatives}`,
      polarity: 'counter',
      weight: 0.45,
      summary: `该领域存在反向例 ${calibrationProfile.domainFalsePositives} 条、漏触发 ${calibrationProfile.domainFalseNegatives} 条，已下调校准贡献。`
    });
  }
  return counters;
}

function timeReliability(data) {
  const correction = data.base?.timeCorrection;
  if (!correction?.applied) {
    return {
      penalty: 0.12,
      assumptions: ['时间校正未成功，时柱和紫微宫位需保守解释。']
    };
  }
  const assumptions = [];
  let penalty = 0;
  if (correction.boundary?.corrected?.nearBoundary) {
    penalty += 0.12;
    assumptions.push('校正后时间接近时辰边界，需考虑双盘或保守解释。');
  }
  if (correction.solarTermBoundary?.near) {
    penalty += 0.12;
    assumptions.push('出生时间接近节气交界，月令和调候判断需保守。');
  }
  if (correction.shichenChanged) {
    assumptions.push('标准时间与真太阳时对应时辰不同，正式结论以校正后时辰为准。');
  }
  return { penalty: clamp(penalty, 0, 0.24), assumptions };
}

function conflictsFor(domain, baziSignal, ziweiScore, evidenceCounts) {
  const conflicts = [];
  const baziHigh = baziSignal.value >= 2;
  const baziLow = baziSignal.value === 0;
  const ziweiHigh = (ziweiScore?.score || 0) >= 4;
  const ziweiLow = ziweiScore && ziweiScore.score <= 2;
  if (baziHigh && ziweiLow) {
    conflicts.push(`${DOMAIN_CONFIG[domain].label} 八字信号较强，但紫微专项评分偏低。`);
  }
  if (baziLow && ziweiHigh) {
    conflicts.push(`${DOMAIN_CONFIG[domain].label} 紫微信号较强，但八字年度人生事件信号偏弱。`);
  }
  if (evidenceCounts.rule === 0 && (baziHigh || ziweiHigh)) {
    conflicts.push('缺少经典规则命中支撑，需避免把单一评分写成定论。');
  }
  return conflicts;
}

function buildJudgment(data, domain) {
  const config = DOMAIN_CONFIG[domain];
  const baziSignal = maxBaziSignal(data.years, domain);
  const ziweiScore = ziweiScoreFor(data, domain);
  const baziEvidence = baziEvidenceFor(data.years, domain);
  const ziweiEvidence = ziweiEvidenceFor(data, domain);
  const ruleEvidence = ruleEvidenceFor(data.ruleMatches, domain);
  const calibrationEvidence = calibrationEvidenceFor(data.userCalibration, domain);
  const evidenceCounts = {
    bazi: baziEvidence.length,
    ziwei: ziweiEvidence.length,
    rule: ruleEvidence.length,
    calibration: calibrationEvidence.length
  };
  const conflicts = conflictsFor(domain, baziSignal, ziweiScore, evidenceCounts);
  const time = timeReliability(data);
  const calibrationStatus = data.userCalibration?.status || '未校准';
  const calibrationProfile = calibrationProfileFor(data.userCalibration, domain);

  const baziScore = baziSignal.value / 3;
  const ziweiScoreNorm = ziweiScore ? (ziweiScore.score || 0) / 5 : 0;
  const ruleScore = clamp(ruleEvidence.length / 3);
  const evidenceDensity = clamp((baziEvidence.length + ziweiEvidence.length + ruleEvidence.length) / 9);
  const conflictPenalty = Math.min(0.18, conflicts.length * 0.07);
  const calibrationBonus = calibrationProfile.adjustment;
  const calibrationCap = calibrationProfile.cap;

  const rawConfidence = clamp(
    CONFIDENCE_BASE +
    baziScore * 0.18 +
    ziweiScoreNorm * 0.18 +
    ruleScore * 0.14 +
    evidenceDensity * 0.12 +
    calibrationBonus -
    conflictPenalty -
    time.penalty
  );
  const confidence = roundScore(Math.min(rawConfidence, calibrationCap));
  const groupedEvidence = {
    bazi: baziEvidence,
    ziwei: ziweiEvidence,
    rules: ruleEvidence,
    calibration: calibrationEvidence
  };
  const evidenceNodes = buildEvidenceNodes(domain, groupedEvidence);
  const coverage = coverageFor(domain, evidenceNodes);
  const counterEvidence = counterEvidenceFor(domain, data, baziSignal, ziweiScore, evidenceCounts, time, calibrationStatus, evidenceNodes, coverage, calibrationProfile);
  const timeScope = yearsScope(data.years);
  const confidenceBreakdown = {
    base: CONFIDENCE_BASE,
    bazi: roundScore(baziScore * 0.18),
    ziwei: roundScore(ziweiScoreNorm * 0.18),
    rules: roundScore(ruleScore * 0.14),
    evidenceDensity: roundScore(evidenceDensity * 0.12),
    calibration: roundScore(calibrationBonus),
    conflictPenalty: roundScore(-conflictPenalty),
    timeReliabilityPenalty: roundScore(-time.penalty),
    rawConfidence: roundScore(rawConfidence),
    calibrationCap,
    calibrationSample: calibrationProfile,
    final: roundScore(confidence)
  };

  const tendencyParts = [
    baziSignal.signal?.signalIntensity ? `八字${baziSignal.signal.signalIntensity}` : null,
    ziweiScore?.tendency ? `紫微${ziweiScore.tendency}` : null,
    ruleEvidence.length ? `规则${ruleEvidence.length}条` : null,
    conflicts.length ? `冲突${conflicts.length}项` : null
  ].filter(Boolean);

  return {
    cardVersion: HECAN_CARD_VERSION,
    domain,
    label: config.label,
    timeScope,
    claim: `${config.label}：${tendencyParts.join('，') || '信号不足，保守观察'}`,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    confidenceBreakdown,
    coverage,
    riskBoundary: riskBoundaryFor(domain),
    evidence: groupedEvidence,
    evidenceNodes,
    counterEvidence,
    conflicts,
    assumptions: [
      `现实校准状态：${calibrationStatus}`,
      ...time.assumptions
    ],
    recommendationBoundary: '只作为命盘先验判断单元；需要结合现实资源、预算、健康、家庭条件和用户选择，不写成确定事件。'
  };
}

export function buildHecanSummary(data, focusDomains = null) {
  const domainIds = (focusDomains?.length ? focusDomains : Object.keys(DOMAIN_CONFIG))
    .filter(domain => DOMAIN_CONFIG[domain]);
  const judgments = domainIds
    .map(domain => buildJudgment(data, domain))
    .sort((a, b) => b.confidence - a.confidence);
  const output = {
    schemaVersion: 'fortune.hecanSummary.v2',
    input: data.input,
    timeBasis: {
      principle: '真太阳时为正式排盘基准；标准时间仅作为原始输入。',
      corrected: data.base?.timeCorrection?.corrected || null,
      shichenChanged: Boolean(data.base?.timeCorrection?.shichenChanged),
      solarTermBoundary: data.base?.timeCorrection?.solarTermBoundary || null
    },
    calibration: data.userCalibration || null,
    summary: {
      judgmentCount: judgments.length,
      cardVersion: HECAN_CARD_VERSION,
      evidenceNodeCount: judgments.reduce((sum, item) => sum + item.evidenceNodes.length, 0),
      counterEvidenceCount: judgments.reduce((sum, item) => sum + item.counterEvidence.length, 0),
      coveredDomains: judgments.map(item => item.domain),
      coveragePassCount: judgments.filter(item => item.coverage.status === 'pass').length,
      thinCoverageCount: judgments.filter(item => item.coverage.status !== 'pass').length,
      domainCoverage: judgments.map(item => ({
        domain: item.domain,
        status: item.coverage.status,
        evidenceNodeCount: item.coverage.evidenceNodeCount,
        missingSources: item.coverage.missingSources
      })),
      highConfidenceCount: judgments.filter(item => item.confidenceLabel === '高').length,
      mediumOrAboveCount: judgments.filter(item => item.confidence >= 0.35).length,
      conflictCount: judgments.reduce((sum, item) => sum + item.conflicts.length, 0)
    },
    judgments
  };
  attachSchemaValidation(output, validateHecanSummaryOutput);
  return output;
}

function main() {
  const opts = parseArgs();
  const data = runReportData(opts.rawArgs);
  const output = buildHecanSummary(data, opts.focus);
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
