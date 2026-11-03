#!/usr/bin/env node
/**
 * report-draft.mjs — 基于聚合数据生成 Markdown 报告草稿骨架。
 *
 * 用法:
 * node scripts/report-draft.mjs --type long_year_month --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] \
 *   --gender <male|female> --birthplace "城市名" [--from 2026] [--to 2035] [--ziwei-years 2026,2027]
 */

import { parseInteger } from './cli-input.mjs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildHecanSummary } from './hecan-summary.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const node = process.execPath;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { type: 'long_year_month', minute: 0, from: new Date(Date.now() + 8 * 3600000).getUTCFullYear(), to: new Date(Date.now() + 8 * 3600000).getUTCFullYear() + 9 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) opts.type = args[++i];
    else if (args[i] === '--solar' && args[i + 1]) opts.solar = args[++i];
    else if (args[i] === '--hour' && args[i + 1]) opts.hour = parseInteger(args[++i]);
    else if (args[i] === '--minute' && args[i + 1]) opts.minute = parseInteger(args[++i]);
    else if (args[i] === '--gender' && args[i + 1]) opts.gender = args[++i];
    else if (args[i] === '--birthplace' && args[i + 1]) opts.birthplace = args[++i];
    else if (args[i] === '--calibration-file' && args[i + 1]) opts.calibrationFile = args[++i];
    else if (args[i] === '--from' && args[i + 1]) opts.from = parseInteger(args[++i]);
    else if (args[i] === '--to' && args[i + 1]) opts.to = parseInteger(args[++i]);
    else if (args[i] === '--ziwei-years' && args[i + 1]) opts.ziweiYears = args[++i];
  }
  return opts;
}

function fail(message, detail) {
  process.stderr.write(`${message}\n${detail ? JSON.stringify(detail, null, 2) : ''}\n`);
  process.exit(1);
}

function runReportData(opts) {
  const args = [
    'scripts/fortune-report-data.mjs',
    '--solar', opts.solar,
    '--hour', String(opts.hour),
    '--minute', String(opts.minute),
    '--gender', opts.gender,
    '--birthplace', opts.birthplace,
    '--from', String(opts.from),
    '--to', String(opts.to)
  ];
  if (opts.ziweiYears) args.push('--ziwei-years', opts.ziweiYears);
  if (opts.calibrationFile) args.push('--calibration-file', opts.calibrationFile);
  const result = spawnSync(node, args, { cwd: root, encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
  if (result.status !== 0) fail('fortune-report-data 执行失败', { stdout: result.stdout, stderr: result.stderr });
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`fortune-report-data 输出不是 JSON: ${error.message}`, result.stdout.slice(0, 1000));
  }
}

function templateFor(data, type) {
  const templates = data.reportFramework?.reportTemplates?.templates || [];
  return templates.find(t => t.id === type) || templates.find(t => t.id === `${type}_report`) || templates[0];
}

function ratingsText(ratings = {}) {
  return [
    `事业机会 ${ratings.careerOpportunity ?? '-'}/5`,
    `组织摩擦 ${ratings.organizationFriction ?? '-'}/5`,
    `贵人可用 ${ratings.nobleSupport ?? '-'}/5`,
    `财务兑现 ${ratings.financialConversion ?? '-'}/5`,
    `身心消耗 ${ratings.physicalDrain ?? '-'}/5`
  ].join('；');
}

function signalText(item) {
  return item?.signalIntensity || item?.level || '-';
}

function shortList(items = [], max = 3) {
  return items.slice(0, max).join('、') || '-';
}

function primaryLabels(tendency = {}, max = 4) {
  return shortList(tendency.primaryTriggerLabels || tendency.dominantTriggerLabels || tendency.triggerLabels || [], max);
}

function makeRuleMatches(ruleMatches) {
  const categories = ruleMatches?.categories || [];
  if (!categories.length) return '- 未生成规则命中数据。';
  const lines = [];
  for (const category of categories) {
    lines.push(`### ${category.name}`);
    if (!category.matches?.length) {
      lines.push('');
      lines.push('- 暂无明显命中。');
      lines.push('');
      continue;
    }
    lines.push('');
    for (const match of category.matches) {
      lines.push(`- ${match.title}（${match.source || match.ruleId}）：${match.evidence}。${match.interpretation}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function makePillarTable(data) {
  const pillars = data.base?.pillars || {};
  const rows = [
    '| 四柱 | 干支 | 天干 | 地支 | 五行 |',
    '|---|---|---|---|---|'
  ];
  for (const [key, label] of [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['time', '时柱']]) {
    const pillar = pillars[key] || {};
    rows.push(`| ${label} | ${pillar.ganZhi || '-'} | ${pillar.gan || '-'} | ${pillar.zhi || '-'} | ${pillar.wuXing || '-'} |`);
  }
  return rows.join('\n');
}

function makeFiveElementSummary(data) {
  const scores = data.base?.fiveElements?.scores || {};
  const ganScores = data.base?.fiveElements?.ganScores || {};
  const scoreText = Object.entries(scores).map(([key, value]) => `${key}${value}`).join('、') || '-';
  const ganText = Object.entries(ganScores).filter(([, value]) => value).map(([key, value]) => `${key}${value}`).join('、') || '-';
  return [`- 五行分数：${scoreText}`, `- 天干藏干分数：${ganText}`].join('\n');
}

function makeMajorFortuneTable(data) {
  const fortunes = data.base?.majorFortune?.list || [];
  if (!fortunes.length) return '- 未生成大运数据。';
  const rows = [
    '| 大运 | 起止年份 | 起止年龄 |',
    '|---|---|---|'
  ];
  for (const item of fortunes) {
    rows.push(`| ${item.ganZhi || '-'} | ${item.startYear || '-'}-${item.endYear || '-'} | ${item.startAge || '-'}-${item.endAge || '-'} |`);
  }
  return rows.join('\n');
}

function makeZiweiBaseSummary(data) {
  const ziwei = data.base?.ziwei || {};
  const lines = [
    `- 命宫：${ziwei.soulPalace || '-'}`,
    `- 身宫：${ziwei.bodyPalace || '-'}`,
    `- 五行局：${ziwei.fiveElementsClass || '-'}`,
    '',
    '### 紫微三方四正提示',
    ''
  ];
  const triads = ziwei.triadAnalysis || [];
  if (!triads.length) {
    lines.push('- 未生成三方四正摘要。');
  } else {
    for (const item of triads.slice(0, 12)) {
      const palace = item.palace?.name || item.palace?.palaceName || '-';
      const involved = item.involvedPalaceNames?.join('、') || '-';
      const mutagens = (item.mutagensInTriad || [])
        .slice(0, 4)
        .map(m => `${m.scope || ''}${m.type || ''}${m.starName || ''}在${m.palace?.palaceName || '未知宫'}`)
        .join('；') || '无明显四化';
      lines.push(`- ${palace}三方四正：${involved}；四化提示：${mutagens}`);
    }
  }
  return lines.join('\n');
}

function makeMainLifeWritingRequirements() {
  return [
    '- 主报告默认写成详细报告，不得压缩成摘要版。',
    '- 八字部分至少展开：月令调候、日主强弱、格局/病药、十神结构、合冲刑害、喜用神、现实承接。',
    '- 紫微部分至少展开：命宫身宫、官禄、财帛、夫妻、子女、田宅、福德、疾厄、迁移等重点宫位，并说明三方四正和四化落宫。',
    '- 大运部分至少展开：已发生大运的现实校准、当前大运主题、未来 3-5 年摘要。',
    '- 有用户提供历史经历时，必须单列现实校准，不要把用户经历写成绝对命定。',
    '- 涉及事业/财务/健康/关系时，必须转成现实建议、边界和可执行策略。',
    '- 若用户同时要求独立流年逐月报告，主报告的流年只做摘要，但本命详批不得省略。'
  ].join('\n');
}

function makeYearTable(years) {
  const rows = [
    '| 年份 | 流年 | 大运 | 喜忌 | 触发标签 | 评分 | 人生议题信号强度（先验） |',
    '|---|---|---|---|---|---|---|'
  ];
  for (const year of years) {
    const life = year.lifeEventSignals || {};
    const signals = [
      `学业:${signalText(life.studyAndExams)}`,
      `工作:${signalText(life.careerChange)}`,
      `迁移:${signalText(life.cityMove)}`,
      `关系:${signalText(life.relationshipChange)}`,
      `资产:${signalText(life.familyAndAssets)}`,
      `健康:${signalText(life.healthStress)}`
    ].join(' ');
    rows.push(`| ${year.year} | ${year.bazi?.ganZhi || ''} | ${year.bazi?.daYun?.ganZhi || ''} | ${year.tendencyAnalysis?.tendency || ''} | ${primaryLabels(year.tendencyAnalysis, 4)} | ${ratingsText(year.tendencyAnalysis?.ratings)} | ${signals} |`);
  }
  return rows.join('\n');
}

function makeYearNarrativePrompts(years) {
  const lines = [];
  for (const year of years || []) {
    const tendency = year.tendencyAnalysis || {};
    const life = year.lifeEventSignals || {};
    const events = Object.entries(life)
      .filter(([, value]) => signalText(value) !== '低' && signalText(value) !== '-')
      .map(([key, value]) => `${key}:${signalText(value)}`);
    const formations = (year.formationAnalysis || [])
      .filter(item => item.strength === '动态成局' || item.strength === '半会/半合')
      .map(item => item.description);
    const combinations = (year.combinationTransformations || [])
      .filter(item => item.status && item.status !== '无明显合化')
      .map(item => `${item.relation}/${item.status}`);
    lines.push(`- ${year.year}：${year.bazi?.ganZhi || ''}，${year.bazi?.daYun?.ganZhi || ''}大运；总体倾向 ${tendency.tendency || '-'}。主触发标签：${primaryLabels(tendency, 4)}。人生议题信号强度：${shortList(events, 6)}。结构触发：${shortList([...formations, ...combinations], 5)}。写作时需区分“机会窗口”和“承接成本”。`);
  }
  return lines.join('\n') || '- 未生成年度数据。';
}

function makeCalibrationBlock(data) {
  const calibration = data.userCalibration || {};
  const lines = [
    `- 校准状态：${calibration.status || '未校准'}`,
    `- 历史事件样本：${calibration.events?.length || 0}`,
    `- 反向例 / 未发生样本：${calibration.falsePositives?.length || 0}`,
    `- 未触发但发生样本：${calibration.falseNegatives?.length || 0}`,
    `- 说明：${calibration.note || '未提供历史事件时，只能按命盘先验信号保守分析。'}`
  ];
  return lines.join('\n');
}

function methodologyCategoryNames(data) {
  return (data.methodologyFramework?.sixCategories || [])
    .map(category => category.name)
    .join('、') || '-';
}

function makeHecanJudgmentCards(data) {
  const hecan = buildHecanSummary(data);
  const rows = [
    '| 领域 | 时间范围 | 判断 | 置信度 | 覆盖状态 | 证据节点 | 反证/约束 | 置信度构成 |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const item of hecan.judgments || []) {
    const breakdown = item.confidenceBreakdown || {};
    const parts = [
      `八字${breakdown.bazi ?? 0}`,
      `紫微${breakdown.ziwei ?? 0}`,
      `规则${breakdown.rules ?? 0}`,
      `密度${breakdown.evidenceDensity ?? 0}`,
      `校准${breakdown.calibration ?? 0}`,
      `扣分${roundForReport((breakdown.conflictPenalty ?? 0) + (breakdown.timeReliabilityPenalty ?? 0))}`
    ].join(' ');
    rows.push(`| ${item.label} | ${item.timeScope} | ${item.claim} | ${item.confidenceLabel}(${item.confidenceBreakdown?.final ?? item.confidence}) | ${item.coverage?.status || '-'} | ${item.evidenceNodes?.length || 0} | ${item.counterEvidence?.length || 0} | ${parts} |`);
  }
  return [
    '> v2 合参卡片只描述证据一致性和可判定性，不代表事件必然发生；写报告时需把反证、约束和现实承接一起写入。',
    '',
    ...rows
  ].join('\n');
}

function makeHecanEvidenceDigest(data) {
  const hecan = buildHecanSummary(data);
  const lines = [];
  for (const item of hecan.judgments || []) {
    const supports = (item.evidenceNodes || [])
      .filter(node => node.polarity === 'support')
      .slice(0, 4);
    const counters = (item.counterEvidence || []).slice(0, 3);
    lines.push(`### ${item.label}`);
    lines.push('');
    lines.push(`- 判断：${item.claim}；置信度 ${item.confidenceLabel}(${item.confidenceBreakdown?.final ?? item.confidence})；时间范围 ${item.timeScope}。`);
    lines.push(`- 覆盖策略：${item.coverage?.status || '-'}；必要来源 ${item.coverage?.requiredSources?.join('、') || '-'}；已见 ${item.coverage?.presentSources?.join('、') || '-'}；缺口 ${item.coverage?.missingSources?.join('、') || '无'}。`);
    lines.push(`- 证据来源：${supports.map(node => `${node.source}/${node.layer}:${node.fieldPath || node.type}`).join('；') || '暂无'}。`);
    lines.push(`- 证据摘要：${supports.map(node => node.summary).join('；') || '暂无'}。`);
    lines.push(`- 反证/约束：${counters.map(node => node.summary).join('；') || '暂无明显反证或约束'}。`);
    lines.push(`- 风险边界：${item.riskBoundary || item.recommendationBoundary || '-'}。`);
    lines.push(`- 正文绑定要求：本领域正文必须引用至少一条证据来源、一条现实承接边界，并说明信号不等于确定事件。`);
    lines.push('');
  }
  return lines.join('\n').trim() || '- 未生成 v2 证据摘要。';
}

function roundForReport(value) {
  return Number(value.toFixed(4));
}

function makeZiweiSummary(ziweiYears) {
  const lines = [];
  for (const item of ziweiYears || []) {
    const yearly = item.summary?.yearly?.mutagenPalaces || [];
    lines.push(`- ${item.year}：${yearly.map(m => `${m.type}${m.starName}在${m.palace?.palaceName || '未知宫'}`).join('；')}`);
  }
  return lines.join('\n') || '- 未指定紫微流年。';
}

function makeZiweiDomainScores(data) {
  const lines = [];
  const base = data.base?.ziwei?.currentDomainScores || data.base?.ziwei?.domainScores;
  if (base) {
    lines.push('| 范围 | 事业 | 迁移 | 财务 | 关系 | 家庭资产 | 健康 | 学业文书 |');
    lines.push('|---|---|---|---|---|---|---|---|');
    lines.push(makeDomainScoreRow(data.base?.ziwei?.domainScoreScope?.label || '当前运限', base));
  }
  for (const item of data.ziweiYears || []) {
    if (item.domainScores) {
      if (!lines.length) {
        lines.push('| 范围 | 事业 | 迁移 | 财务 | 关系 | 家庭资产 | 健康 | 学业文书 |');
        lines.push('|---|---|---|---|---|---|---|---|');
      }
      lines.push(makeDomainScoreRow(String(item.year), item.domainScores));
    }
  }
  return lines.join('\n') || '- 未生成紫微专项评分。';
}

function scoreText(item) {
  if (!item) return '-';
  return `${item.tendency || item.level || '-'}(${item.score ?? '-'})`;
}

function makeDomainScoreRow(label, scores) {
  return `| ${label} | ${scoreText(scores.career)} | ${scoreText(scores.migration)} | ${scoreText(scores.wealth)} | ${scoreText(scores.relationship)} | ${scoreText(scores.home)} | ${scoreText(scores.health)} | ${scoreText(scores.study)} |`;
}

function makeMutagenInteractions(ziweiYears) {
  const lines = [];
  for (const item of ziweiYears || []) {
    const interactions = item.mutagenInteractions || [];
    if (!interactions.length) {
      lines.push(`- ${item.year}：未见明显四化交互。`);
      continue;
    }
    lines.push(`- ${item.year}：${interactions.map(interaction => `${interaction.type || interaction.relation || '交互'}：${interaction.description || interaction.summary || interaction.note || '-'}`).join('；')}`);
  }
  return lines.join('\n') || '- 未生成四化交互数据。';
}

function makeMonthlyPrompt(data) {
  const years = data.years || [];
  const lines = [];
  for (const year of years.slice(0, 2)) {
    lines.push(`### ${year.year} 逐月草稿`);
    lines.push('');
    const months = year.monthlyAnalysis || [];
    if (!months.length) {
      lines.push('- 未生成逐月数据。');
      lines.push('');
      continue;
    }
    lines.push('| 月份 | 干支 | 倾向 | 标签 | 工作信号强度 | 迁移信号强度 | 关系信号强度 | 健康信号强度 |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const month of months) {
      const life = month.lifeEventSignals || {};
      lines.push(`| ${month.month} | ${month.ganZhi || ''} | ${month.tendencyAnalysis?.tendency || ''} | ${primaryLabels(month.tendencyAnalysis, 3)} | ${signalText(life.careerChange)} | ${signalText(life.cityMove)} | ${signalText(life.relationshipChange)} | ${signalText(life.healthStress)} |`);
    }
    lines.push('');
  }
  return lines.join('\n').trim() || '- 未生成逐月分析。';
}

function makeStudySignals(data) {
  const rows = [
    '| 年份 | 主触发标签 | 学业考试 | 压力边界 | 写作提示 |',
    '|---|---|---|---|---|'
  ];
  for (const year of data.years || []) {
    const life = year.lifeEventSignals || {};
    rows.push(`| ${year.year} | ${primaryLabels(year.tendencyAnalysis, 3)} | ${signalText(life.studyAndExams)} | ${signalText(life.healthStress)} | 学业只写学习方式、考试准备、导师/家庭支持和身心节奏，不写婚恋、跳槽、投资判断。 |`);
  }
  return rows.join('\n');
}

function makeCareerTransitionSignals(data) {
  const rows = [
    '| 年份 | 主触发标签 | 职业/平台 | 迁移/外部平台 | 组织摩擦 | 财务承接 |',
    '|---|---|---|---|---|---|'
  ];
  for (const year of data.years || []) {
    const life = year.lifeEventSignals || {};
    const ratings = year.tendencyAnalysis?.ratings || {};
    rows.push(`| ${year.year} | ${primaryLabels(year.tendencyAnalysis, 3)} | ${signalText(life.careerChange)} | ${signalText(life.cityMove)} | ${ratings.organizationFriction ?? '-'}/5 | ${ratings.financialConversion ?? '-'}/5 |`);
  }
  return rows.join('\n');
}

function makeRelationshipFamilySignals(data) {
  const rows = [
    '| 年份 | 主触发标签 | 关系议题 | 家庭/资产 | 健康压力 | 写作提示 |',
    '|---|---|---|---|---|---|'
  ];
  for (const year of data.years || []) {
    const life = year.lifeEventSignals || {};
    rows.push(`| ${year.year} | ${primaryLabels(year.tendencyAnalysis, 3)} | ${signalText(life.relationshipChange)} | ${signalText(life.familyAndAssets)} | ${signalText(life.healthStress)} | 写沟通、边界、预算和家庭协商，不写确定分合。 |`);
  }
  return rows.join('\n');
}

function renderCommonOpening(data, template, title) {
  return [
    `# ${title}`,
    '',
    '> 本草稿由脚本生成，供 LLM 进一步解释、取舍和润色；不应直接作为最终报告。',
    '',
    '## 1. 输入与时辰',
    '',
    ...(data.base.timeCorrection?.precisionGuard?.historicalTimezoneAssumption ? ['- 历史时区待核实：以下结果以城市代表时区规则为条件，不能视为唯一确定的历史命盘。'] : []),
    '- 时间基准：地方视太阳时近似，已加入 NOAA 均时差近似；不提供秒级天文精度保证。年月柱/交节与大运另按出生 UTC 瞬时的北京时间参考计算；日时柱与紫微按太阳钟规则。',
    '',
    `- 出生信息：${data.input.solar} ${data.input.hour}:${String(data.input.minute).padStart(2, '0')}，${data.input.birthplace}，${data.input.gender}`,
    `- 排盘四柱：${Object.values(data.base.pillars || {}).map(p => p.ganZhi).join(' ')}`,
    `- 时辰校正：${data.base.timeCorrection?.corrected?.solar || '-'} ${data.base.timeCorrection?.corrected?.hour ?? '-'}:${String(data.base.timeCorrection?.corrected?.minute ?? 0).padStart(2, '0')}`,
    '',
    '## 2. 模板章节',
    '',
    ...(template?.sections || []).map(section => `- ${section}`),
    '',
    '## 3. 方法论核对',
    '',
    `- 方法论类别：${data.methodologyFramework?.summary?.categoryCount || 0}`,
    `- 关键点：${data.methodologyFramework?.summary?.keyPointCount || 0}`,
    `- 六大方法论覆盖：${methodologyCategoryNames(data)}`,
    `- 报告模板：${template?.id || 'unknown'}`,
    '',
    '## 3.1 现实校准状态',
    '',
    makeCalibrationBlock(data),
    '',
    '## 3.2 结构化合参 v2 判断卡片',
    '',
    makeHecanJudgmentCards(data),
    '',
    '## 3.3 v2 证据节点与反证摘要',
    '',
    makeHecanEvidenceDigest(data)
  ];
}

function renderSpecializedMarkdown(data, opts, template, title) {
  const lines = renderCommonOpening(data, template, title);
  if (template?.id === 'main_life_report') {
    lines.push(
      '',
      '## 4. 八字命盘数据',
      '',
      makePillarTable(data),
      '',
      makeFiveElementSummary(data),
      '',
      '## 5. 经典规则证据链',
      '',
      makeRuleMatches(data.ruleMatches),
      '',
      '## 6. 紫微本盘与三方四正',
      '',
      makeZiweiBaseSummary(data),
      '',
      '## 7. 大运阶段表',
      '',
      makeMajorFortuneTable(data),
      '',
      '## 8. 未来 3-5 年摘要提示',
      '',
      makeYearNarrativePrompts((data.years || []).slice(0, 5)),
      '',
      '## 9. 紫微流年辅助提示',
      '',
      makeZiweiSummary(data.ziweiYears),
      '',
      '## 10. 详细主报告写作要求',
      '',
      makeMainLifeWritingRequirements()
    );
  } else if (template?.id === 'main_summary_report') {
    lines.push(
      '',
      '## 4. Summary（执行摘要）',
      '',
      '- 写作要求：结论先行，像商业报告执行摘要；只保留关键判断、风险窗口、行动建议和详细版索引。',
      '- 文件建议：姓名-YYYY-MM-DD-Summary.md。',
      '- 注意：Summary 不替代详细版；默认应与 main_life_report 成对输出。',
      '',
      '## 5. 命局核心摘要',
      '',
      `- 日主：${data.base.dayMaster?.gan || '-'}，五行分数：${Object.entries(data.base.fiveElements?.scores || {}).map(([key, value]) => `${key}${value}`).join('、')}`,
      `- 规则命中：${data.ruleMatches?.summary?.categoryCount || 0} 类，${data.ruleMatches?.summary?.matchCount || 0} 条`,
      '',
      '## 6. 未来摘要',
      '',
      makeYearNarrativePrompts((data.years || []).slice(0, 5))
    );
  } else if (template?.id === 'yearly_outlook_report') {
    lines.push(
      '',
      '## 4. 十年总览表',
      '',
      '> 信号强度 ≠ 必然发生；仅代表此命盘在该年面对该议题的先验权重较高，必须结合现实资源、个人选择和校准样本。',
      '',
      makeYearTable(data.years || []),
      '',
      '## 5. 经典规则命中',
      '',
      makeRuleMatches(data.ruleMatches),
      '',
      '## 6. 年度写作提示',
      '',
      makeYearNarrativePrompts(data.years || [])
    );
  } else if (template?.id === 'monthly_outlook_report') {
    lines.push(
      '',
      '## 4. 逐月分析表',
      '',
      '> 逐月报告可以写成长篇，但只用于观察主题底色、结构触发和现实边界，不生成逐月确定事件或高风险行动指令；“中高/高”不等于事件必然发生。',
      '',
      makeMonthlyPrompt(data),
      '',
      '## 5. 年度底色',
      '',
      makeYearNarrativePrompts((data.years || []).slice(0, 2)),
      '',
      '## 6. 详细逐月写作要求',
      '',
      '- 每个月可展开关键词、结构解释、家庭/关系/财务/健康观察和风险边界。',
      '- 建议写成“适合观察/需要留意/倾向于/不宜过度解读”，不要写成确定事件。',
      '- 不输出逐月具体行动指令，不把月份信号写成必须签约、买卖、搬迁、投资、分手、结婚或换工作。',
      '- 现实建议应服务于节奏、边界、预算、睡眠、家庭协商和风险控制。'
    );
  } else if (template?.id === 'student_report') {
    lines.push(
      '',
      '## 4. 学业与学习方式信号',
      '',
      makeStudySignals(data),
      '',
      '## 5. 学校/导师/家庭支持',
      '',
      '- 将印星、官杀、食伤转译为学习系统、规则压力、表达输出和作品集准备。',
      '- 家庭支持只写资源、陪伴、边界和节奏，不把家长选择写成命定。',
      '',
      '## 6. 压力与健康边界',
      '',
      '- 学生报告不输出成人事业机会、婚恋判断、投资判断或跳槽建议。',
      '- 身心压力只写睡眠、焦虑、社交和亲子沟通的观察边界。',
      '',
      '## 7. 详细写作要求',
      '',
      '- 每个年份/月度可详细展开，但必须围绕学习、考试、兴趣、家庭支持和身心节奏。',
      '- 禁止把学业信号写成必然升学、必然落榜、必然换学校。'
    );
  } else if (template?.id === 'career_transition_report') {
    lines.push(
      '',
      '## 4. 职业/平台变化信号',
      '',
      makeCareerTransitionSignals(data),
      '',
      '## 5. 现实承接与退出机制',
      '',
      '- 把职业信号拆成岗位名分、组织摩擦、外部平台、预算授权、现金流和健康成本。',
      '- 对换工作、创业、换城市只写窗口、条件和验证步骤，不写确定事件。',
      '',
      '## 6. 详细写作要求',
      '',
      '- 先讲当前大运背景，再讲年度窗口；所有行动建议必须配现实前提。',
      '- 必须写清低成本验证、退出条件、家庭/健康缓冲和现金流边界。'
    );
  } else if (template?.id === 'relationship_family_report') {
    lines.push(
      '',
      '## 4. 关系与家庭议题信号',
      '',
      makeRelationshipFamilySignals(data),
      '',
      '## 5. 沟通、资产与家庭边界',
      '',
      '- 关系报告只写沟通模式、压力来源、共同资产、家庭责任和协商边界。',
      '- 不把任何年份/月度写成必然结婚、分手、离婚、怀孕或家庭变故。',
      '',
      '## 6. 详细写作要求',
      '',
      '- 结合夫妻宫/日支/财官、田宅/家庭资产和现实沟通条件展开。',
      '- 对重大关系决策必须回到现实沟通、专业咨询和双方选择。'
    );
  } else {
    return null;
  }
  lines.push(
    '',
    '## 免责声明',
    '',
    '本草稿基于传统命理文化和脚本计算结果，仅供文化研究、娱乐参考和自我观察，不构成医学、法律、投资、职业或其他专业建议。'
  );
  return lines.join('\n');
}

function renderMarkdown(data, opts) {
  const template = templateFor(data, opts.type);
  const title = template?.name || '命理报告草稿';
  const specialized = renderSpecializedMarkdown(data, opts, template, title);
  if (specialized) return specialized;
  const lines = [
    ...renderCommonOpening(data, template, title),
    '',
    '## 4. 经典规则命中',
    '',
    makeRuleMatches(data.ruleMatches),
    '',
    '## 5. 年度结构化表',
    '',
    '> 信号强度 ≠ 必然发生；仅代表此命盘在该年面对该议题的先验权重较高，必须结合现实资源、个人选择和校准样本。',
    '',
    makeYearTable(data.years || []),
    '',
    '## 6. 年度写作提示',
    '',
    makeYearNarrativePrompts(data.years || []),
    '',
    '## 7. 紫微专项评分',
    '',
    makeZiweiDomainScores(data),
    '',
    '## 8. 紫微四化落宫',
    '',
    makeZiweiSummary(data.ziweiYears),
    '',
    '## 9. 紫微四化交互',
    '',
    makeMutagenInteractions(data.ziweiYears),
    '',
    '## 10. LLM 待补充',
    '',
    '### 现实校准状态',
    '',
    makeCalibrationBlock(data),
    '',
    '- 结合现实经历做历史校准。',
    '- 解释经典规则如何映射到现实承接条件。',
    '- 将表格信号转化为年度主题、风险边界和行动建议。',
    '- 对“贵人、迁移、换工作、伴侣/家庭变化”等高敏问题保留边界，不写成确定性预言。',
    '',
    '## 免责声明',
    '',
    '本草稿基于传统命理文化和脚本计算结果，仅供文化研究、娱乐参考和自我观察，不构成医学、法律、投资、职业或其他专业建议。'
  ];
  return lines.join('\n');
}

function main() {
  const opts = parseArgs();
  const data = runReportData(opts);
  process.stdout.write(renderMarkdown(data, opts) + '\n');
}

main();
