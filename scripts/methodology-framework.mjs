#!/usr/bin/env node
/**
 * methodology-framework.mjs — 输出并校验深度报告方法论框架。
 *
 * 用法:
 *   node scripts/methodology-framework.mjs
 *   node scripts/methodology-framework.mjs --summary
 */

import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const frameworkPath = join(root, 'references', 'methodology-framework.json');

function fail(error, message, detail) {
  process.stdout.write(JSON.stringify({ error, message, detail }, null, 2) + '\n');
  process.exit(1);
}

export function loadMethodologyFramework() {
  let framework;
  try {
    framework = JSON.parse(readFileSync(frameworkPath, 'utf8'));
  } catch (error) {
    fail('invalid_framework', `无法读取方法论框架: ${error.message}`, frameworkPath);
  }

  const categories = framework.sixCategories || [];
  const keyPoints = categories.flatMap(category => category.keyPoints || []);
  const errors = [];

  if (categories.length !== 6) errors.push(`expected 6 categories, got ${categories.length}`);
  if (keyPoints.length < 20) errors.push(`expected at least 20 key points, got ${keyPoints.length}`);

  const ids = new Set();
  for (const category of categories) {
    if (!category.id || !category.name || !category.goal) errors.push(`category missing required fields: ${category.id || category.name || 'unknown'}`);
    for (const point of category.keyPoints || []) {
      if (!point.id || !point.name || !point.reportQuestion) errors.push(`key point missing required fields: ${point.id || point.name || 'unknown'}`);
      if (ids.has(point.id)) errors.push(`duplicate key point id: ${point.id}`);
      ids.add(point.id);
    }
  }

  if (errors.length) fail('framework_validation_failed', '方法论框架校验失败', errors);

  return {
    ...framework,
    summary: {
      categoryCount: categories.length,
      keyPointCount: keyPoints.length,
      categoryIds: categories.map(category => category.id)
    }
  };
}

function parseArgs() {
  return {
    summary: process.argv.includes('--summary')
  };
}

function main() {
  const opts = parseArgs();
  const framework = loadMethodologyFramework();
  const output = opts.summary ? framework.summary : framework;
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
