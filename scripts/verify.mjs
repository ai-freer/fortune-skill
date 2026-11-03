#!/usr/bin/env node
/**
 * Minimal regression checks for the fortune skill command-line tools.
 */

import { pythonExecutable } from './python-runtime.mjs';
import { spawnSync } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const node = process.execPath;
const python = pythonExecutable();

function run(label, command, args, expectCode = 0) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, NODE: process.execPath, PYTHON: python },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.status !== expectCode) {
    throw new Error([
      `${label} exited with ${result.status}, expected ${expectCode}`,
      result.stdout.trim(),
      result.stderr.trim()
    ].filter(Boolean).join('\n'));
  }

  return result;
}

function parseJson(label, stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${error.message}\n${stdout.slice(0, 1000)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [
  {
    label: 'Python artifact locks and advisory status contracts',
    run() { run(this.label, python, ['scripts/verify-python-supply-chain.py']); }
  },
  {
    label: 'explicit daily query context and workflow regressions',
    run() { process.stdout.write(run(this.label, node, ['scripts/verify-daily-context.mjs']).stdout); }
  },
  {
    label: 'classical month data has complete unique keys and distinct lookup results',
    run() { process.stdout.write(run(this.label, python, ['scripts/verify-vendor-data.py']).stdout); }
  },
  {
    label: 'UTC time basis, pinned tzdb and complete skill framework regressions',
    run() { process.stdout.write(run(this.label, node, ['scripts/verify-time-basis.mjs']).stdout); }
  },
  {
    label: 'time, input, runtime and privacy hardening regressions',
    run() {
      const result = run(this.label, node, ['scripts/verify-hardening.mjs']);
      process.stdout.write(result.stdout);
    }
  },
  {
    label: 'entrypoints handle encoded paths and imports without argv[1]',
    run() {
      const result = run(this.label, node, ['scripts/verify-entrypoints.mjs']);
      process.stdout.write(result.stdout);
    }
  },
  {
    label: 'time-normalize valid Shanghai DST case',
    run() {
      const result = run(this.label, node, [
        'scripts/time-normalize.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--birthplace', '上海'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.corrected.hour === 14, 'expected corrected hour 14');
      assert(json.corrected.minute === 9, 'expected NOAA-corrected minute 9');
      assert(json.shichenChanged === true, 'expected shichenChanged true');
      assert(Math.abs(json.boundary?.corrected?.minutesToNextBoundary - 50.2) < 0.00001, 'expected unrounded corrected boundary distance 50.2');
      assert(json.solarTermBoundary?.near === false, 'expected non-boundary solar term state');
    }
  },
  {
    label: 'time-normalize solar term boundary case',
    run() {
      const result = run(this.label, node, [
        'scripts/time-normalize.mjs',
        '--solar', '2023-04-05',
        '--hour', '9',
        '--minute', '10',
        '--birthplace', '上海'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.solarTermBoundary?.near === true, 'expected near solar term boundary');
      assert(json.solarTermBoundary?.nearest?.name === '清明', 'expected 清明 nearest boundary');
    }
  },
  {
    label: 'time-normalize Intl hour 24 normalization',
    run() {
      const result = run(this.label, node, [
        '--input-type=module',
        '-e',
        "import { normalizeIntlDateTimeParts } from './scripts/time-normalize.mjs'; const r = normalizeIntlDateTimeParts([{type:'year',value:'2024'},{type:'month',value:'1'},{type:'day',value:'1'},{type:'hour',value:'24'},{type:'minute',value:'00'}]); console.log(JSON.stringify(r));"
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.localHour === 0, 'expected hour 24 to normalize to 0');
      assert(json.hourWas24 === true, 'expected hourWas24 marker');
    }
  },
  {
    label: 'time-normalize county alias boundary case',
    run() {
      const result = run(this.label, node, [
        'scripts/time-normalize.mjs',
        '--solar', '1984-02-29',
        '--hour', '23',
        '--minute', '10',
        '--birthplace', '当涂'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.city?.name === '马鞍山', 'expected 当涂 to resolve to 马鞍山');
      assert(json.corrected.hour === 22, 'expected corrected hour 22');
      assert(json.corrected.minute === 51, 'expected NOAA-corrected minute 51');
      assert(json.corrected.shichen === '亥', 'expected corrected shichen 亥');
    }
  },
  {
    label: 'time-normalize compound birthplace alias case',
    run() {
      const result = run(this.label, node, [
        'scripts/time-normalize.mjs',
        '--solar', '1984-02-29',
        '--hour', '23',
        '--birthplace', '马鞍山-当涂'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.city?.name === '马鞍山', 'expected compound birthplace to resolve to 马鞍山');
      assert(json.corrected.shichen === '亥', 'expected corrected shichen 亥');
      assert(json.shichenChanged === true, 'expected shichenChanged true');
    }
  },
  {
    label: 'time-normalize invalid date format',
    run() {
      const result = run(this.label, node, [
        'scripts/time-normalize.mjs',
        '--solar', '1990/05/15',
        '--hour', '12',
        '--birthplace', '上海'
      ], 1);
      const json = parseJson(this.label, result.stdout);
      assert(json.error === 'invalid_date', 'expected invalid_date');
    }
  },
  {
    label: 'time-normalize nonexistent date',
    run() {
      const result = run(this.label, node, [
        'scripts/time-normalize.mjs',
        '--solar', '1990-02-31',
        '--hour', '12',
        '--birthplace', '上海'
      ], 1);
      const json = parseJson(this.label, result.stdout);
      assert(json.error === 'invalid_date', 'expected invalid_date');
    }
  },
  {
    label: 'bazi-chart complete chart',
    run() {
      const result = run(this.label, node, [
        'scripts/bazi-chart.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.pillars.time.ganZhi === '癸未', 'expected time pillar 癸未');
      assert(json.fiveElements.scores.金 === 17, 'expected 金 score 17');
      assert(json.timeCorrection.shichenChanged === true, 'expected time correction to change shichen');
      assert(json.timeCorrection.boundary?.corrected, 'expected time correction boundary info');
      assert(json.timeCorrection.solarTermBoundary?.checked === true, 'expected solar term boundary info');
      assert(json.schemaValidation?.ok === true, 'expected bazi schema validation ok');
    }
  },
  {
    label: 'ziwei-chart complete chart',
    run() {
      const result = run(this.label, node, [
        'scripts/ziwei-chart.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.input.shichen === '未时', 'expected corrected shichen 未时');
      assert(json.soulPalace?.majorStars?.length > 0, 'expected soul palace major stars');
      assert(json.timeCorrection.solarTermBoundary?.checked === true, 'expected solar term boundary info');
      assert(json.schemaValidation?.ok === true, 'expected ziwei schema validation ok');
    }
  },
  {
    label: 'bazi-classic complete chart',
    run() {
      const result = run(this.label, python, [
        'scripts/bazi-classic.py',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.pillars.time.ganZhi === '癸未', 'expected time pillar 癸未');
      assert(json.scores.金 === 17, 'expected 金 score 17');
    }
  },
  {
    label: 'bazi-classic minute boundary case',
    run() {
      const result = run(this.label, python, [
        'scripts/bazi-classic.py',
        '--solar', '1984-02-29',
        '--hour', '23',
        '--minute', '10',
        '--gender', 'male',
        '--birthplace', '当涂'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.timeCorrection.corrected.minute === 51, 'expected NOAA-corrected minute 51');
      assert(json.pillars.time.ganZhi === '癸亥', 'expected corrected 亥时 pillar 癸亥');
    }
  },
  {
    label: 'bazi year fortune',
    run() {
      const result = run(this.label, node, [
        'scripts/bazi-chart.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--year', '2026'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.mode === 'yearFortune', 'expected yearFortune mode');
      assert(json.yearFortune.ganZhi === '丙午', 'expected 2026 丙午');
      assert(json.yearFortune.relationAnalysis?.flags?.length >= 0, 'expected relationAnalysis');
      assert(Array.isArray(json.yearFortune.formationAnalysis), 'expected formationAnalysis');
      assert(Array.isArray(json.yearFortune.combinationTransformations), 'expected combinationTransformations');
      assert(json.yearFortune.tendencyAnalysis?.tendency, 'expected tendencyAnalysis');
      assert(json.yearFortune.tendencyAnalysis?.primaryTriggerLabels?.length > 0, 'expected primary trigger labels');
      assert(json.yearFortune.tendencyAnalysis?.primaryTriggerLabels.length < json.yearFortune.tendencyAnalysis?.triggerLabels.length, 'expected primary labels to be narrower than legacy labels');
      assert(json.yearFortune.tendencyAnalysis?._legacy?.triggerLabels, 'expected legacy trigger label marker');
      assert(!json.yearFortune.tendencyAnalysis?.dominantTriggerLabels, 'expected dominant alias to be removed');
      assert(json.yearFortune.tendencyAnalysis?.ratings?.careerOpportunity >= 1, 'expected ratings');
      assert(json.yearFortune.lifeEventSignals?.careerChange, 'expected lifeEventSignals');
      assert(json.yearFortune.lifeEventSignals?.studyAndExams, 'expected study and exams signal');
      assert(json.yearFortune.lifeEventSignals?.studyAndExams?.level === '低', 'expected study signal to follow primary labels');
      assert(json.yearFortune.lifeEventSignals?.studyAndExams?.signalIntensity === '低', 'expected signalIntensity to mirror level');
      assert(json.schemaValidation?.ok === true, 'expected bazi schema validation ok');
      assert(json.yearFortune.liuYue?.[0]?.tendencyAnalysis?.tendency, 'expected monthly tendency');
    }
  },
  {
    label: 'ziwei year fortune summary',
    run() {
      const result = run(this.label, node, [
        'scripts/ziwei-chart.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--year', '2026'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.mode === 'yearFortune', 'expected yearFortune mode');
      assert(json.yearFortuneSummary?.yearly?.mutagen?.length === 4, 'expected yearly mutagen summary');
      assert(json.yearFortuneSummary?.yearly?.mutagenPalaces?.length === 4, 'expected mutagen palace summary');
      assert(json.yearFortuneScope?.sampleDate === '2026-6-15', 'expected year fortune sample date');
      assert(json.yearFortuneSummary?.yearFortuneScope?.sampleShichen === '午', 'expected year fortune sample shichen');
      assert(json.triadAnalysis?.length === 12, 'expected triad analysis for 12 palaces');
      assert(json.triadAnalysis?.[0]?.opposite?.name, 'expected opposite palace summary');
      assert(json.domainScores?.career?.tendency, 'expected ziwei domain scores');
      assert(json.schemaValidation?.ok === true, 'expected ziwei schema validation ok');
    }
  },
  {
    label: 'methodology framework summary',
    run() {
      const result = run(this.label, node, [
        'scripts/methodology-framework.mjs',
        '--summary'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.categoryCount === 6, 'expected six methodology categories');
      assert(json.keyPointCount >= 20, 'expected at least twenty methodology key points');
      assert(json.categoryIds.includes('historical_calibration'), 'expected historical calibration category');
      assert(json.categoryIds.includes('life_stage_templates'), 'expected life stage templates category');
    }
  },
  {
    label: 'report framework summary',
    run() {
      const result = run(this.label, node, [
        'scripts/report-framework.mjs',
        '--summary'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.classicalRuleSetCount >= 9, 'expected classical rule sets');
      assert(json.calibrationFieldCount >= 5, 'expected calibration fields');
      assert(json.reportTemplateCount >= 8, 'expected report templates');
      assert(json.reportTemplateIds.includes('student_report'), 'expected student report template');
      assert(json.reportTemplateIds.includes('monthly_outlook_report'), 'expected monthly outlook template');
      assert(json.privacyPrivatePathCount >= 1, 'expected privacy private paths');
    }
  },
  {
    label: 'privacy policy loads without scanning content',
    run() {
      const result = run(this.label, node, [
        'scripts/privacy-check.mjs',
        '--no-git'
      ], 0);
      const json = parseJson(this.label, result.stdout);
      assert(json.policy.privatePaths.includes('reports/'), 'expected reports private path');
    }
  },
  {
    label: 'fortune report data aggregate',
    run() {
      const result = run(this.label, node, [
        'scripts/fortune-report-data.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--from', '2026',
        '--to', '2027',
        '--ziwei-years', '2026'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.years.length === 2, 'expected two bazi years');
      assert(json.ziweiYears.length === 1, 'expected one ziwei year');
      assert(json.methodologyFramework?.summary?.categoryCount === 6, 'expected methodology framework');
      assert(json.methodologyFramework?.summary?.keyPointCount >= 20, 'expected methodology key points');
      assert(json.reportFramework?.summary?.reportTemplateCount >= 5, 'expected report framework');
      assert(json.base.ziwei.triadAnalysis?.length === 12, 'expected base triad analysis');
      assert(json.base.ziwei.domainScores?.career?.tendency, 'expected base ziwei domain scores');
      assert(json.base.tenGods?.month?.gan, 'expected base ten gods');
      assert(json.base.tenGods?.zhiMain, 'expected explicit zhiMain ten gods');
      assert(json.base.tenGods?.zhiFull, 'expected explicit zhiFull ten gods');
      assert(json.base.hiddenStems?.month?.length > 0, 'expected base hidden stems');
      assert(json.base.nayin?.day, 'expected base nayin');
      assert(json.base.diShi?.day, 'expected base di shi');
      assert(json.base.xunKong?.day?.kong, 'expected base xun kong');
      assert(json.userCalibration?.status === '未校准', 'expected default uncalibrated status');
      assert(json.ziweiYears[0].triadAnalysis?.length === 12, 'expected year triad analysis');
      assert(json.ziweiYears[0].yearFortuneScope?.sampleDate === '2026-6-15', 'expected ziwei year scope');
      assert(Array.isArray(json.ziweiYears[0].mutagenInteractions), 'expected mutagen interactions');
      assert(json.ziweiYears[0].domainScores?.career?.tendency, 'expected year ziwei domain scores');
      assert(json.ruleMatches?.summary?.matchCount >= 1, 'expected rule matches');
      assert(Array.isArray(json.base.classic?.spirits), 'expected classic spirits');
      assert(json.base.timeCorrection.boundary?.corrected, 'expected boundary info');
      assert(json.base.timeCorrection.solarTermBoundary?.checked === true, 'expected solar term boundary info');
      assert(json.years[0].tendencyAnalysis?.triggerLabels?.length > 0, 'expected tendency labels');
      assert(json.years[0].tendencyAnalysis?.primaryTriggerLabels?.length > 0, 'expected primary tendency labels');
      assert(json.years[0].lifeEventSignals?.cityMove, 'expected life event signals');
      assert(json.years[0].lifeEventSignals?.cityMove?.signalIntensity, 'expected signal intensity');
      assert(json.years[0].lifeEventSignals?.studyAndExams, 'expected study signals');
      assert(json.years[0].monthlyAnalysis?.[0]?.lifeEventSignals, 'expected monthly life event signals');
      assert(json.schemaValidation?.ok === true, 'expected report data schema validation ok');
    }
  },
  {
    label: 'rule matcher summary',
    run() {
      const result = run(this.label, node, [
        'scripts/rule-matcher.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--from', '2026',
        '--to', '2027',
        '--ziwei-years', '2026'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.summary?.categoryCount === 10, 'expected ten matcher categories');
      assert(json.categories.some(category => category.id === 'ziping_geju'), 'expected geju matcher category');
      assert(json.categories.find(category => category.id === 'ziping_geju')?.matches?.some(match => match.ruleId === 'ziping_geju.外格候选'), 'expected external geju candidate');
      assert(json.categories.some(category => category.id === 'combination_transform_conditions'), 'expected combination matcher category');
      assert(json.categories.some(category => category.id === 'calibration_event_table'), 'expected calibration matcher category');
      assert(json.summary?.matchCount >= 1, 'expected at least one rule match');
    }
  },
  {
    label: 'hecan summary confidence',
    run() {
      const result = run(this.label, node, [
        'scripts/hecan-summary.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--from', '2026',
        '--to', '2027',
        '--ziwei-years', '2026',
        '--focus', 'career,migration,health'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.schemaValidation?.ok === true, 'expected hecan schema validation ok');
      assert(json.schemaVersion === 'fortune.hecanSummary.v2', 'expected hecan v2 schema version');
      assert(json.summary?.judgmentCount === 3, 'expected focused hecan judgments');
      assert(json.summary?.cardVersion === 'v2', 'expected v2 card summary');
      assert(json.summary?.evidenceNodeCount >= 3, 'expected v2 evidence nodes');
      assert(json.summary?.coveragePassCount === 3, 'expected focused domain coverage pass');
      assert(Array.isArray(json.summary?.domainCoverage), 'expected domain coverage summary');
      assert(json.timeBasis?.principle?.includes('地方视太阳时近似'), 'expected local mean solar time principle');
      assert(json.timeBasis.method === 'local_apparent_solar_time_approximation', 'expected explicit method');
      assert(json.timeBasis.equationOfTimeApplied === true, 'expected equation-of-time limitation');
      assert(json.judgments.every(item => item.confidence >= 0 && item.confidence <= 1), 'expected confidence range');
      assert(json.judgments.some(item => item.domain === 'career'), 'expected career judgment');
      assert(json.judgments.every(item => item.evidence?.bazi && item.evidence?.ziwei && item.evidence?.rules), 'expected separated evidence');
      assert(json.judgments.every(item => item.cardVersion === 'v2' && item.timeScope && item.confidenceBreakdown?.final >= 0 && item.confidenceBreakdown?.calibrationSample), 'expected v2 judgment cards');
      assert(json.judgments.every(item => item.coverage?.status === 'pass' && item.riskBoundary), 'expected coverage and risk boundary');
      assert(json.judgments.every(item => Array.isArray(item.evidenceNodes) && item.evidenceNodes.every(node => node.fieldPath !== undefined && node.polarity && node.system && node.layer)), 'expected traceable typed evidence nodes');
      assert(json.judgments.every(item => Array.isArray(item.counterEvidence)), 'expected counter evidence arrays');
      assert(json.judgments.every(item => item.recommendationBoundary?.includes('不写成确定事件')), 'expected recommendation boundary');
    }
  },
  {
    label: 'report draft smoke',
    run() {
      const result = run(this.label, node, [
        'scripts/report-draft.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--from', '2026',
        '--to', '2026',
        '--ziwei-years', '2026'
      ]);
      assert(result.stdout.includes('时间基准：地方视太阳时近似，已加入 NOAA 均时差近似'), 'expected time-method disclosure');
      assert(!result.stdout.includes('真太阳时'), 'no apparent-solar-time claim in generated draft');
      assert(result.stdout.includes('## 3.2 结构化合参 v2 判断卡片'), 'expected hecan v2 card section');
      assert(result.stdout.includes('## 3.3 v2 证据节点与反证摘要'), 'expected hecan v2 evidence digest section');
      assert(result.stdout.includes('覆盖策略'), 'expected v2 coverage policy output');
      assert(result.stdout.includes('风险边界'), 'expected v2 risk boundary output');
      assert(result.stdout.includes('## 4. 经典规则命中'), 'expected rule match section');
      assert(result.stdout.includes('## 7. 紫微专项评分'), 'expected ziwei domain score section');
      assert(result.stdout.includes('## 9. 紫微四化交互'), 'expected mutagen interaction section');
    }
  },
  {
    label: 'specialized report drafts smoke',
    run() {
      const commonArgs = [
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--from', '2026',
        '--to', '2027',
        '--ziwei-years', '2026'
      ];
      const yearly = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'yearly_outlook_report', ...commonArgs]);
      assert(yearly.stdout.includes('# 十年流年报告'), 'expected yearly report title');
      assert(yearly.stdout.includes('## 4. 十年总览表'), 'expected yearly overview section');
      const monthly = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'monthly_outlook_report', ...commonArgs]);
      assert(monthly.stdout.includes('# 两年逐月报告'), 'expected monthly report title');
      assert(monthly.stdout.includes('## 4. 逐月分析表'), 'expected monthly section');
      const student = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'student_report', ...commonArgs]);
      assert(student.stdout.includes('## 4. 学业与学习方式信号'), 'expected student specialized section');
      const career = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'career_transition_report', ...commonArgs]);
      assert(career.stdout.includes('## 4. 职业/平台变化信号'), 'expected career transition specialized section');
      const relationship = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'relationship_family_report', ...commonArgs]);
      assert(relationship.stdout.includes('## 4. 关系与家庭议题信号'), 'expected relationship specialized section');
      const mainLife = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'main_life_report', ...commonArgs]);
      const mainSummary = run(this.label, node, ['scripts/report-draft.mjs', '--type', 'main_summary_report', ...commonArgs]);
      for (const report of [yearly, monthly, student, career, relationship, mainLife, mainSummary]) {
        assert(report.stdout.includes('时间基准：地方视太阳时近似，已加入 NOAA 均时差近似'), 'all report templates disclose time approximation');
        assert(!report.stdout.includes('真太阳时'), 'no apparent-solar-time claim in generated reports');
      }
    }
	  },
  {
    label: 'hecan audit smoke',
    run() {
      const result = run(this.label, node, [
        'scripts/hecan-audit.mjs',
        '--solar', '1990-05-15',
        '--hour', '15',
        '--gender', 'male',
        '--birthplace', '上海',
        '--from', '2026',
        '--to', '2027',
        '--ziwei-years', '2026',
        '--focus', 'career,migration,health'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.ok === true, 'expected hecan audit ok');
      assert(json.summary?.schemaVersion === 'fortune.hecanSummary.v2', 'expected audited v2 schema');
      assert(json.summary?.judgmentCount === 3, 'expected audited focused judgments');
      assert(json.summary?.evidenceNodeCount >= 3, 'expected audited evidence nodes');
      assert(json.summary?.coveragePassCount === 3, 'expected audited coverage pass count');
    }
  },
  {
    label: 'hecan domain calibration profile',
    run() {
      const file = join(root, '.tmp-hecan-calibration.json');
      writeFileSync(file, JSON.stringify({
        events: [
          { date: '2022', domain: '财务投资', event: '资产配置调整', impact: '中等', outcome: '先难后稳' },
          { date: '2023', domain: '工作', event: '岗位职责扩大', impact: '重大', outcome: '顺利落地' },
          { date: '2024', domain: '健康', event: '睡眠压力上升', impact: '中等', outcome: '调整后改善' }
        ],
        falsePositives: [
          { date: '2021', domain: '财务投资', event: '预期财务波动未明显发生' }
        ],
        falseNegatives: [
          { date: '2020', domain: '财务投资', event: '无明显信号但出现支出压力' }
        ]
      }, null, 2));
      try {
        const result = run(this.label, node, [
          'scripts/hecan-summary.mjs',
          '--solar', '1990-05-15',
          '--hour', '15',
          '--gender', 'male',
          '--birthplace', '上海',
          '--from', '2026',
          '--to', '2027',
          '--ziwei-years', '2026',
          '--focus', 'wealth',
          '--calibration-file', file
        ]);
        const json = parseJson(this.label, result.stdout);
        const wealth = json.judgments.find(item => item.domain === 'wealth');
        assert(wealth?.evidence?.calibration?.length >= 1, 'expected calibration evidence for wealth');
        assert(wealth.confidenceBreakdown?.calibrationSample?.domainEvents === 1, 'expected domain calibration event count');
        assert(wealth.confidenceBreakdown?.calibrationSample?.domainFalsePositives === 1, 'expected domain false positive count');
        assert(wealth.confidenceBreakdown?.calibrationSample?.domainFalseNegatives === 1, 'expected domain false negative count');
        assert(wealth.counterEvidence.some(item => item.type === 'domain_calibration_misses'), 'expected calibration miss counter evidence');
      } finally {
        rmSync(file, { force: true });
      }
    }
  },
  {
	    label: 'report qa smoke',
	    run() {
	      const file = join(root, '.tmp-report-qa.md');
	      writeFileSync(file, [
	        '# 测试报告',
	        '时间校正和地方视太阳时近似：已检查时辰边界。',
	        '方法论：经典规则索引、用神体系、作用优先级、紫微深化、历史经验校准、人生阶段模板均已核对。',
	        '证据链：依据月支、日主、五行、大运、流年、四化落宫、宫位和神煞字段，不单独断事，强调现实承接和边界。',
	        '现实校准：历史校准表已说明，个人经历由用户提供；未校准时保守解释。',
	        '维度：事业、财务、关系、健康、迁移、学业、家庭均有负载检查。',
	        '隐私：reports/ 不提交敏感材料。',
		        '贵人边界：可承接资源需要预算、授权和组织承接；弱连接资源只做低成本维护和小项目验证。',
	        '建议：保留策略、风险、承接和边界。',
	        '免责声明：仅供文化研究和自我观察参考，不构成专业建议。'
	      ].join('\n'));
	      try {
	        const result = run(this.label, node, ['scripts/report-qa.mjs', '--file', file]);
		        const json = parseJson(this.label, result.stdout);
		        assert(json.ok === true, 'expected report qa ok');
		        assert(json.summary?.checkCount === 27, 'expected twenty seven qa checks');
	      } finally {
	        rmSync(file, { force: true });
	      }
	    }
	  },
  {
    label: 'report qa long report requires full matrix',
    run() {
      const file = join(root, '.tmp-report-qa-long-bad.md');
      writeFileSync(file, [
        '# 十年流年报告',
        '报告模板：long_year_month_report',
        '时间校正和地方视太阳时近似：已检查时辰边界。',
        '方法论：经典规则索引、用神体系。',
        '现实校准：未校准。',
        '维度：事业、财务、关系、健康、迁移。',
        '免责声明：仅供参考，不构成专业建议。'
      ].join('\n'));
      try {
        const result = run(this.label, node, ['scripts/report-qa.mjs', '--file', file], 1);
        const json = parseJson(this.label, result.stdout);
        assert(json.ok === false, 'expected long report qa failure');
        assert(json.summary?.reportType === 'long', 'expected long report type');
        assert(json.findings.some(item => item.id === 'methodology_matrix' && item.severity === 'error'), 'expected methodology matrix error');
        assert(json.findings.some(item => item.id === 'dimension_balance' && item.severity === 'error'), 'expected dimension balance error');
        assert(json.findings.some(item => item.id === 'hecan_v2_cards' && item.severity === 'error'), 'expected hecan v2 card error');
      } finally {
        rmSync(file, { force: true });
      }
    }
  },
  {
    label: 'report qa catches unhedged event prediction',
    run() {
      const file = join(root, '.tmp-report-qa-bad.md');
      writeFileSync(file, [
        '# 测试报告',
        '时辰校正：已完成。',
        '方法论：经典规则索引、用神体系、作用优先级、紫微深化、历史经验校准、人生阶段模板均已核对。',
        '现实校准：未校准。',
        '维度：事业、财务、关系、健康、迁移、学业、家庭均有覆盖。',
        '免责声明：仅供参考，不构成专业建议。',
        '你 2027 年将会换工作并搬到深圳。'
      ].join('\n'));
      try {
        const result = run(this.label, node, ['scripts/report-qa.mjs', '--file', file], 1);
        const json = parseJson(this.label, result.stdout);
        assert(json.ok === false, 'expected report qa failure');
        assert(json.findings.some(item => item.id === 'no_absolute_prediction'), 'expected absolute prediction finding');
      } finally {
        rmSync(file, { force: true });
      }
	    }
	  },
  {
    label: 'report qa catches student audience leakage',
    run() {
      const file = join(root, '.tmp-report-qa-student-bad.md');
      writeFileSync(file, [
        '# 学生与学业报告',
        '时间校正和地方视太阳时近似：已检查时辰边界。',
        '报告模板：student_report',
        '方法论：经典规则索引、用神体系、作用优先级、紫微深化、历史经验校准、人生阶段模板均已核对。',
        '现实校准：未校准。',
        '维度：学业、健康、家庭、迁移、关系均有覆盖。',
        '免责声明：仅供参考，不构成专业建议。',
        '2027 年适合投资创业，并可以重点考虑结婚。'
      ].join('\n'));
      try {
        const result = run(this.label, node, ['scripts/report-qa.mjs', '--file', file], 1);
        const json = parseJson(this.label, result.stdout);
        assert(json.ok === false, 'expected report qa failure');
        assert(json.findings.some(item => item.id === 'audience_boundary'), 'expected audience boundary finding');
      } finally {
        rmSync(file, { force: true });
      }
    }
  },
  {
    label: 'bazi match minute boundary',
    run() {
      const result = run(this.label, node, [
        'scripts/bazi-match.mjs',
        '--solar1', '1984-02-29',
        '--hour1', '23',
        '--minute1', '10',
        '--gender1', 'male',
        '--birthplace1', '当涂',
        '--solar2', '1992-08-20',
        '--hour2', '10',
        '--minute2', '30',
        '--gender2', 'female',
        '--birthplace2', '北京'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.input.person1.minute === 10, 'expected minute1 to be preserved');
      assert(json.person1.timeCorrection.original.minute === 10, 'expected chart to receive minute1');
      assert(json.person1.pillars.time.ganZhi === '癸亥', 'expected corrected 亥时 pillar 癸亥');
      assert(json.match.nayin?.elements?.person1, 'expected explicit nayin element mapping');
    }
  },
  {
    label: 'bazi match',
    run() {
      const result = run(this.label, node, [
        'scripts/bazi-match.mjs',
        '--solar1', '1990-05-15',
        '--hour1', '15',
        '--gender1', 'male',
        '--birthplace1', '上海',
        '--solar2', '1992-08-20',
        '--hour2', '10',
        '--gender2', 'female',
        '--birthplace2', '北京'
      ]);
      const json = parseJson(this.label, result.stdout);
      assert(json.match.summary.level === '中性互补', 'expected 中性互补');
      assert(json.match.summary.score === 65, 'expected score 65');
    }
  }
];

for (const check of checks) {
  check.run();
  console.log(`ok - ${check.label}`);
}

console.log(`verified ${checks.length} checks`);
