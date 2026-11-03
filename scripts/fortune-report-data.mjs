#!/usr/bin/env node
/**
 * fortune-report-data.mjs — 报告上下文聚合器
 *
 * 用法:
 * node scripts/fortune-report-data.mjs --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] \
 *   --gender <male|female> --birthplace "城市名" [--from 2026] [--to 2035] [--ziwei-years 2026,2027]
 *
 * 输出: JSON 到 stdout。用于长期流年、逐月报告、贵人线索等报告写作前的数据准备。
 */

import { parseInteger } from './cli-input.mjs';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadMethodologyFramework } from './methodology-framework.mjs';
import { loadReportFramework } from './report-framework.mjs';
import { matchClassicalRules } from './rule-matcher.mjs';
import { attachSchemaValidation, validateFortuneReportDataOutput } from './schema-validators.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const node = process.execPath;
const python = process.env.PYTHON || 'python3';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { minute: 0, from: new Date(Date.now() + 8 * 3600000).getUTCFullYear(), to: new Date(Date.now() + 8 * 3600000).getUTCFullYear() + 9 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--solar' && args[i + 1]) opts.solar = args[++i];
    else if (args[i] === '--hour' && args[i + 1]) opts.hour = parseInteger(args[++i]);
    else if (args[i] === '--minute' && args[i + 1]) opts.minute = parseInteger(args[++i]);
    else if (args[i] === '--gender' && args[i + 1]) opts.gender = args[++i];
    else if (args[i] === '--birthplace' && args[i + 1]) opts.birthplace = args[++i];
    else if (args[i] === '--calibration-file' && args[i + 1]) opts.calibrationFile = args[++i];
    else if (args[i] === '--from' && args[i + 1]) opts.from = parseInteger(args[++i]);
    else if (args[i] === '--to' && args[i + 1]) opts.to = parseInteger(args[++i]);
    else if (args[i] === '--ziwei-years' && args[i + 1]) {
      opts.ziweiYears = args[++i].split(',').map(y => parseInteger(y.trim()));
    }
  }
  if (!opts.ziweiYears) opts.ziweiYears = [opts.from, opts.from + 1].filter(y => y <= opts.to);
  return opts;
}

function fail(error, message, input) {
  process.stdout.write(JSON.stringify({ error, message, input }, null, 2) + '\n');
  process.exit(1);
}

function validate(opts) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.solar || '')) fail('invalid_date', '缺少或无效 --solar，格式 YYYY-MM-DD', opts);
  if (opts.hour === undefined || Number.isNaN(opts.hour) || opts.hour < 0 || opts.hour > 23) fail('invalid_hour', '--hour 必须为 0-23', opts);
  if (opts.minute === undefined || Number.isNaN(opts.minute) || opts.minute < 0 || opts.minute > 59) fail('invalid_minute', '--minute 必须为 0-59', opts);
  if (!['male', 'female'].includes(opts.gender)) fail('invalid_gender', '--gender 必须为 male 或 female', opts);
  if (!opts.birthplace) fail('missing_birthplace', '缺少 --birthplace', opts);
  if (!Number.isInteger(opts.from) || !Number.isInteger(opts.to) || opts.from < 1 || opts.to > 9999 || opts.from > opts.to) fail('invalid_range', '--from/--to 范围无效', opts);
  if (opts.ziweiYears.some(year => !Number.isInteger(year) || year < 1 || year > 9999)) fail('invalid_year', '--ziwei-years 必须为逗号分隔的有效年份', opts);
}

function runJsonCommand(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, NODE: process.execPath },
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) {
    fail('child_process_failed', `${label} 执行失败`, {
      status: result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
      error: result.error?.code || null,
      signal: result.signal || null
    });
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail('invalid_child_json', `${label} 输出不是有效 JSON: ${error.message}`, result.stdout.slice(0, 1000));
  }
}

function runJson(label, args) {
  return runJsonCommand(label, node, args);
}

function runPythonJson(label, args) {
  return runJsonCommand(label, python, args);
}

function loadCalibration(file) {
  if (!file) {
    return {
      status: '未校准',
      source: null,
      events: [],
      note: '用户未提供历史事件，只按命盘先验信号保守分析。'
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('校准数据必须为对象或事件数组');
    const events = Array.isArray(parsed) ? parsed : (parsed.events ?? []);
    for (const [key, value] of Object.entries({ events, falsePositives: parsed.falsePositives ?? [], falseNegatives: parsed.falseNegatives ?? [] })) {
      if (!Array.isArray(value) || value.some(event => !event || typeof event !== 'object' || Array.isArray(event))) throw new Error(`${key} 必须为事件对象数组`);
    }
    return {
      status: events.length >= 5 ? '强校准' : events.length >= 3 ? '中校准' : events.length > 0 ? '弱校准' : '未校准',
      source: file,
      events,
      blindPredictions: parsed.blindPredictions || parsed.predictionsBeforeReveal || null,
      falsePositives: parsed.falsePositives || [],
      falseNegatives: parsed.falseNegatives || [],
      note: events.length
        ? '用户提供的历史事件已进入结构化上下文；后续解释必须同时看同向、反向和未触发样本。'
        : '校准文件存在，但未发现 events。'
    };
  } catch (error) {
    fail('invalid_calibration_file', `无法读取 --calibration-file: ${error.message}`, file);
  }
}

function commonArgs(opts) {
  return [
    '--solar', opts.solar,
    '--hour', String(opts.hour),
    '--minute', String(opts.minute),
    '--gender', opts.gender,
    '--birthplace', opts.birthplace
  ];
}

function main() {
  const opts = parseArgs();
  validate(opts);

  const methodologyFramework = loadMethodologyFramework();
  const reportFramework = loadReportFramework();
  const userCalibration = loadCalibration(opts.calibrationFile);
  const baseBazi = runJson('bazi-chart', ['scripts/bazi-chart.mjs', ...commonArgs(opts)]);
  const baseClassic = runPythonJson('bazi-classic', ['scripts/bazi-classic.py', ...commonArgs(opts)]);
  const baseZiwei = runJson('ziwei-chart', ['scripts/ziwei-chart.mjs', ...commonArgs(opts)]);
  const normalizedTenGods = {
    ...baseBazi.tenGods,
    zhiMain: baseClassic.tenGods?.zhiShens || null,
    zhiFull: baseClassic.tenGods?.zhiShensFull || null,
    _legacy: {
      zhi: '各柱 zhi 字段保留 lunar-javascript 原始输出；地支主气十神请优先读取 zhiMain。',
      zhiShens: 'bazi-classic 的 zhiShens 已映射为 base.tenGods.zhiMain；zhiShensFull 已映射为 zhiFull。'
    }
  };

  const years = [];
  for (let year = opts.from; year <= opts.to; year++) {
    const bazi = runJson(`bazi-chart ${year}`, ['scripts/bazi-chart.mjs', ...commonArgs(opts), '--year', String(year)]);
    years.push({
      year,
      bazi: bazi.yearFortune,
      relationAnalysis: bazi.yearFortune?.relationAnalysis || null,
      formationAnalysis: bazi.yearFortune?.formationAnalysis || null,
      combinationTransformations: bazi.yearFortune?.combinationTransformations || null,
      tendencyAnalysis: bazi.yearFortune?.tendencyAnalysis || null,
      lifeEventSignals: bazi.yearFortune?.lifeEventSignals || null,
      monthlyAnalysis: bazi.yearFortune?.liuYue || []
    });
  }

  const ziweiYears = opts.ziweiYears.map(year => {
    const ziwei = runJson(`ziwei-chart ${year}`, ['scripts/ziwei-chart.mjs', ...commonArgs(opts), '--year', String(year)]);
    return {
      year,
      summary: ziwei.yearFortuneSummary,
      yearFortuneScope: ziwei.yearFortuneScope || ziwei.yearFortuneSummary?.yearFortuneScope || null,
      triadAnalysis: ziwei.triadAnalysis,
      mutagenInteractions: ziwei.mutagenInteractions,
      domainScores: ziwei.domainScores,
      soulPalace: ziwei.soulPalace,
      bodyPalace: ziwei.bodyPalace
    };
  });

  const output = {
    input: {
      solar: opts.solar,
      hour: opts.hour,
      minute: opts.minute,
      gender: opts.gender,
      birthplace: opts.birthplace,
      from: opts.from,
      to: opts.to,
      ziweiYears: opts.ziweiYears
    },
    methodologyFramework,
    reportFramework,
    userCalibration,
    base: {
      pillars: baseBazi.pillars,
      tenGods: normalizedTenGods,
      hiddenStems: baseBazi.hiddenStems,
      nayin: baseBazi.nayin,
      diShi: baseBazi.diShi,
      xunKong: baseBazi.xunKong,
      dayMaster: baseBazi.dayMaster,
      fiveElements: baseBazi.fiveElements,
      majorFortune: baseBazi.majorFortune,
      timeCorrection: baseBazi.timeCorrection,
      classic: {
        strength: baseClassic.strength,
        humidity: baseClassic.humidity,
        xiuqiu: baseClassic.xiuqiu,
        sanming: baseClassic.sanming,
        monthComment: baseClassic.monthComment,
        siling: baseClassic.siling,
        clashes: baseClassic.clashes,
        spirits: baseClassic.spirits,
        tenGods: baseClassic.tenGods
      },
      ziwei: {
        soulPalace: baseZiwei.soulPalace,
        bodyPalace: baseZiwei.bodyPalace,
        fiveElementsClass: baseZiwei.fiveElementsClass,
        horoscopeSummary: baseZiwei.horoscopeSummary,
        triadAnalysis: baseZiwei.triadAnalysis,
        mutagenInteractions: baseZiwei.mutagenInteractions,
        currentDomainScores: baseZiwei.currentDomainScores || baseZiwei.domainScores,
        domainScoreScope: baseZiwei.domainScoreScope || null,
        domainScores: baseZiwei.domainScores
      }
    },
    years,
    ziweiYears
  };

  output.ruleMatches = matchClassicalRules(output);
  attachSchemaValidation(output, validateFortuneReportDataOutput);

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
