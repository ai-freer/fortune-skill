#!/usr/bin/env node
/**
 * hecan-audit.mjs — 审计结构化合参 v2 判断卡片的健康度。
 *
 * 用法:
 *   node scripts/hecan-audit.mjs --file hecan.json
 *   node scripts/hecan-audit.mjs --solar "YYYY-MM-DD" --hour <0-23> --gender <male|female> --birthplace "城市名" --from 2026 --to 2035 --ziwei-years 2026,2027
 */

import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateHecanSummaryOutput } from './schema-validators.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const node = process.execPath;

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const opts = { rawArgs };
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--file' && rawArgs[i + 1]) {
      opts.file = rawArgs[i + 1];
      i += 1;
    }
  }
  return opts;
}

function fail(message, detail = null) {
  process.stdout.write(JSON.stringify({ ok: false, error: message, detail }, null, 2) + '\n');
  process.exit(1);
}

function runHecan(rawArgs) {
  const filteredArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--file') {
      i += 1;
      continue;
    }
    filteredArgs.push(rawArgs[i]);
  }
  const result = spawnSync(node, ['scripts/hecan-summary.mjs', ...filteredArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024
  });
  if (result.status !== 0) fail('hecan-summary 执行失败', { stdout: result.stdout, stderr: result.stderr });
  return parseJson(result.stdout, 'hecan-summary 输出不是 JSON');
}

function parseJson(content, message) {
  try {
    return JSON.parse(content);
  } catch (error) {
    fail(message, { message: error.message, head: content.slice(0, 1000) });
  }
}

function loadInput(opts) {
  if (!opts.file) return runHecan(opts.rawArgs);
  let content;
  try {
    content = readFileSync(opts.file, 'utf8');
  } catch (error) {
    fail('无法读取 hecan 文件', error.message);
  }
  return parseJson(content, 'hecan 文件不是 JSON');
}

function finding(id, severity, message, judgment = null) {
  return {
    id,
    severity,
    domain: judgment?.domain || null,
    message
  };
}

function confidenceLabel(score) {
  if (score >= 0.75) return '高';
  if (score >= 0.55) return '中高';
  if (score >= 0.35) return '中';
  return '低';
}

function nearlyEqual(a, b, epsilon = 0.0002) {
  return Math.abs(Number(a) - Number(b)) <= epsilon;
}

function auditSummary(output, findings) {
  const schema = validateHecanSummaryOutput(output);
  for (const error of schema.errors) {
    findings.push(finding('schema_validation', 'error', error));
  }
  if (!output.timeBasis?.principle?.includes('地方视太阳时近似') ||
      output.timeBasis?.method !== 'local_apparent_solar_time_approximation' ||
      output.timeBasis?.equationOfTimeApplied !== true) {
    findings.push(finding('time_basis_principle', 'error', '合参输出必须明确地方视太阳时近似方法及已加入 NOAA 均时差近似，不得将近似算法宣称为高精度天文解。'));
  }
  if (!output.timeBasis?.corrected) {
    findings.push(finding('time_basis_corrected', 'warn', '未见校正后时间，时柱和紫微宫位应保守解释。'));
  }
  if (!output.summary?.coveredDomains?.length) {
    findings.push(finding('domain_coverage', 'error', 'summary.coveredDomains 为空。'));
  }
  if (!Array.isArray(output.summary?.domainCoverage)) {
    findings.push(finding('domain_coverage_summary', 'error', 'summary.domainCoverage 缺失。'));
  }
}

function auditJudgment(judgment, output, findings) {
  const nodes = judgment.evidenceNodes || [];
  const counters = judgment.counterEvidence || [];
  const supportNodes = nodes.filter(node => node.polarity === 'support');
  const sources = new Set(supportNodes.map(node => node.source));
  const layers = new Set(supportNodes.map(node => node.layer).filter(Boolean));

  if (!judgment.timeScope) {
    findings.push(finding('judgment_time_scope', 'error', '判断卡片缺少 timeScope。', judgment));
  }
  if (!nodes.length) {
    findings.push(finding('evidence_nodes_empty', 'error', '判断卡片缺少 evidenceNodes。', judgment));
  }
  if (!judgment.coverage) {
    findings.push(finding('coverage_missing', 'error', '判断卡片缺少 coverage。', judgment));
  } else {
    if (judgment.coverage.status !== 'pass') {
      findings.push(finding('coverage_not_pass', judgment.confidence >= 0.55 ? 'error' : 'warn', `领域覆盖状态为 ${judgment.coverage.status}，缺少来源：${judgment.coverage.missingSources?.join('、') || '无'}。`, judgment));
    }
    if ((judgment.coverage.requiredReportBoundaries || []).length === 0) {
      findings.push(finding('coverage_boundaries_missing', 'warn', 'coverage 未声明报告边界要求。', judgment));
    }
  }
  if (!judgment.riskBoundary) {
    findings.push(finding('risk_boundary_missing', 'error', '判断卡片缺少 riskBoundary。', judgment));
  }
  if (!sources.has('bazi')) {
    findings.push(finding('bazi_evidence_missing', 'warn', '缺少八字证据节点。', judgment));
  }
  if (!sources.has('ziwei')) {
    findings.push(finding('ziwei_evidence_missing', 'warn', '缺少紫微证据节点。', judgment));
  }
  if (!sources.has('rule')) {
    findings.push(finding('rule_evidence_missing', 'warn', '缺少经典规则证据节点，写报告时不得把单项评分写成结论。', judgment));
  }
  if (sources.size < 2) {
    findings.push(finding('source_diversity_low', 'warn', '证据来源少于两个系统，结论应显著降级。', judgment));
  }
  if (layers.size < 2 && supportNodes.length >= 2) {
    findings.push(finding('layer_diversity_low', 'warn', '证据层级过于单一，建议补充原局/岁运/紫微/规则或校准层。', judgment));
  }

  for (const node of supportNodes) {
    if (!node.fieldPath) {
      findings.push(finding('evidence_field_path_missing', 'error', `${node.id || node.type} 缺少 fieldPath。`, judgment));
    }
    if (!node.summary || node.summary.length < 8) {
      findings.push(finding('evidence_summary_too_short', 'warn', `${node.id || node.type} 摘要过短。`, judgment));
    }
    if (!node.system || !node.layer) {
      findings.push(finding('evidence_taxonomy_missing', 'error', `${node.id || node.type} 缺少 system/layer 分类。`, judgment));
    }
  }

  if (output.calibration?.status === '未校准' && !counters.some(node => node.type === 'uncalibrated')) {
    findings.push(finding('uncalibrated_counter_missing', 'error', '未校准输出必须在 counterEvidence 中记录现实校准约束。', judgment));
  }
  if (judgment.conflicts?.length && !counters.length) {
    findings.push(finding('conflict_without_counter', 'warn', '存在 conflicts 但 counterEvidence 为空。', judgment));
  }

  const breakdown = judgment.confidenceBreakdown || {};
  if (!breakdown.calibrationSample) {
    findings.push(finding('calibration_sample_missing', 'error', 'confidenceBreakdown 缺少 calibrationSample。', judgment));
  }
  if (!nearlyEqual(judgment.confidence, breakdown.final)) {
    findings.push(finding('confidence_final_mismatch', 'error', 'confidence 与 confidenceBreakdown.final 不一致。', judgment));
  }
  if (judgment.confidenceLabel !== confidenceLabel(judgment.confidence)) {
    findings.push(finding('confidence_label_mismatch', 'error', 'confidenceLabel 与 confidence 数值区间不一致。', judgment));
  }
  if (output.calibration?.status === '未校准' && judgment.confidence > 0.7402) {
    findings.push(finding('uncalibrated_confidence_cap', 'error', '未校准状态下置信度不得超过 0.74。', judgment));
  }
  if (breakdown.rawConfidence > breakdown.calibrationCap && !nearlyEqual(breakdown.final, breakdown.calibrationCap)) {
    findings.push(finding('calibration_cap_not_applied', 'error', 'rawConfidence 超过校准上限但 final 未按上限截断。', judgment));
  }
  if (!judgment.recommendationBoundary?.includes('不写成确定事件')) {
    findings.push(finding('recommendation_boundary_missing', 'error', '判断卡片缺少“不写成确定事件”的建议边界。', judgment));
  }
  if (judgment.domain === 'health' && !/医学|医生|诊断/.test(judgment.riskBoundary || '')) {
    findings.push(finding('health_professional_boundary_missing', 'error', '健康领域必须声明医学/医生/诊断边界。', judgment));
  }
  if (judgment.domain === 'wealth' && !/财务|投资建议|现金流/.test(judgment.riskBoundary || '')) {
    findings.push(finding('wealth_professional_boundary_missing', 'error', '财务领域必须声明财务/现金流/投资建议边界。', judgment));
  }
}

function audit(output) {
  const findings = [];
  auditSummary(output, findings);
  for (const judgment of output.judgments || []) {
    auditJudgment(judgment, output, findings);
  }
  const errors = findings.filter(item => item.severity === 'error').length;
  const warnings = findings.filter(item => item.severity === 'warn').length;
  return {
    ok: errors === 0,
    summary: {
      schemaVersion: output.schemaVersion || null,
      judgmentCount: output.judgments?.length || 0,
      coveredDomains: output.summary?.coveredDomains || [],
      evidenceNodeCount: output.summary?.evidenceNodeCount || 0,
      counterEvidenceCount: output.summary?.counterEvidenceCount || 0,
      coveragePassCount: output.summary?.coveragePassCount || 0,
      thinCoverageCount: output.summary?.thinCoverageCount || 0,
      errors,
      warnings
    },
    findings
  };
}

function main() {
  const opts = parseArgs();
  const output = loadInput(opts);
  const result = audit(output);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exit(1);
}

main();
