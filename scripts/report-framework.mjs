#!/usr/bin/env node
/**
 * report-framework.mjs — 输出并校验报告规则、校准模板和报告骨架。
 *
 * 用法:
 *   node scripts/report-framework.mjs
 *   node scripts/report-framework.mjs --summary
 */

import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

function fail(error, message, detail) {
  process.stdout.write(JSON.stringify({ error, message, detail }, null, 2) + '\n');
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail('invalid_json', `无法读取 JSON: ${error.message}`, path);
  }
}

export function loadReportFramework() {
  const classicalRules = readJson(join(root, 'references', 'classical-rules.json'));
  const calibrationTemplate = readJson(join(root, 'references', 'calibration-template.json'));
  const reportTemplates = readJson(join(root, 'references', 'report-templates.json'));
  const privacyPolicy = readJson(join(root, 'references', 'privacy-policy.json'));

  const errors = [];
  if ((classicalRules.ruleSets || []).length < 4) errors.push('classical rules should include at least 4 rule sets');
  if ((calibrationTemplate.eventFields || []).length < 5) errors.push('calibration template should include event fields');
  if ((reportTemplates.templates || []).length < 5) errors.push('report templates should include at least 5 templates');
  if (!(privacyPolicy.privatePaths || []).includes('reports/')) errors.push('privacy policy should protect reports/');

  for (const template of reportTemplates.templates || []) {
    if (!template.id || !template.sections?.length) errors.push(`invalid report template: ${template.id || 'unknown'}`);
  }

  if (errors.length) fail('report_framework_validation_failed', '报告框架校验失败', errors);

  return {
    classicalRules,
    calibrationTemplate,
    reportTemplates,
    privacyPolicy,
    summary: {
      classicalRuleSetCount: classicalRules.ruleSets.length,
      calibrationFieldCount: calibrationTemplate.eventFields.length,
      reportTemplateCount: reportTemplates.templates.length,
      reportTemplateIds: reportTemplates.templates.map(template => template.id),
      privacyPrivatePathCount: privacyPolicy.privatePaths.length
    }
  };
}

function main() {
  const framework = loadReportFramework();
  const output = process.argv.includes('--summary') ? framework.summary : framework;
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
