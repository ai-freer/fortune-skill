#!/usr/bin/env node
/**
 * privacy-check.mjs — 检查 staged 内容中是否包含个人报告或明显敏感信息。
 *
 * 用法:
 *   node scripts/privacy-check.mjs [--tracked | --no-git]
 */

import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const policyPath = join(root, 'references', 'privacy-policy.json');

function runGit(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 30000 });
  if (result.error || result.status !== 0) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'git_check_failed', message: result.error?.message || result.stderr?.trim() || 'Git command failed' }, null, 2) + '\n');
    process.exit(1);
  }
  return result.stdout;
}

function loadPolicy() {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

function hasPrivatePath(path, privatePaths) {
  const name = basename(path);
  return privatePaths.some(pattern => {
    if (pattern.endsWith('/')) return (`/${path}`).includes(`/${pattern}`);
    if (pattern.startsWith('*.')) return name.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
    if (pattern.endsWith('.*')) return name === pattern.slice(0, -2) || name.startsWith(pattern.slice(0, -1));
    return name === pattern || path === pattern;
  });
}

function sensitivePatternFindings(diffText) {
  const patterns = [
    { type: 'secret_token_shape', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, message: 'staged diff 中疑似出现 sk- token' },
    { type: 'bearer_token_shape', pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, message: 'staged diff 中疑似出现 Bearer token' },
    { type: 'stripe_live_key_shape', pattern: /\bpk_live_[A-Za-z0-9]{20,}\b/g, message: 'staged diff 中疑似出现 live key' },
    { type: 'pem_private_key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, message: 'staged diff 中疑似出现 PEM 私钥' }
  ];
  return patterns.flatMap(item =>
    [...diffText.matchAll(item.pattern)].map(() => ({
      type: item.type,
      message: item.message
    }))
  );
}

function main() {
  const policy = loadPolicy();
  if (process.argv.includes('--no-git')) {
    process.stdout.write(JSON.stringify({
      ok: true,
      mode: 'policy-only',
      contentScanned: false,
      policy: {
        privatePaths: policy.privatePaths,
        sensitiveKeywordCount: policy.sensitiveKeywords?.length || 0,
        ruleCount: policy.rules?.length || 0
      }
    }, null, 2) + '\n');
    return;
  }

  const trackedMode = process.argv.includes('--tracked');
  const stagedFiles = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
  const trackedFiles = runGit(['ls-files', '-z']).split('\0').filter(Boolean);
  const findings = [];
  const files = trackedMode ? trackedFiles : stagedFiles;
  for (const file of files) {
    if (hasPrivatePath(file, policy.privatePaths || [])) {
      findings.push({ type: trackedMode ? 'private_path_tracked' : 'private_path_staged', file, message: '个人/敏感路径不应提交' });
    }
  }
  // Check index contents, not local files. NUL-delimited names preserve Chinese,
  // spaces and newlines. Deleting a private file must remain possible.
  for (const file of trackedFiles.filter(file => (`/${file}`).includes('/reports/'))) {
    if (!findings.some(item => item.file === file)) findings.push({ type: 'tracked_report', file, message: 'reports/ 中已有文件被 git 跟踪' });
  }
  if (trackedMode) {
    for (const file of trackedFiles) {
      const content = runGit(['show', `:${file}`]);
      findings.push(...sensitivePatternFindings(content).map(item => ({ ...item, file })));
    }
  } else {
    const diff = runGit(['diff', '--cached', '--no-ext-diff', '--no-textconv', '--unified=0', '--', '.', ':(exclude)references/privacy-policy.json', ':(exclude)scripts/privacy-check.mjs']);
    const additions = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n');
    for (const keyword of policy.sensitiveKeywords || []) {
      if (additions.toLowerCase().includes(String(keyword).toLowerCase())) findings.push({ type: 'sensitive_keyword', keyword, message: 'staged 新增内容出现敏感关键词，请人工确认' });
    }
    findings.push(...sensitivePatternFindings(additions));
  }

  const output = {
    ok: findings.length === 0,
    mode: trackedMode ? 'tracked-index' : 'staged-additions',
    contentScanned: true,
    stagedFiles,
    findings,
    policy: {
      privatePaths: policy.privatePaths,
      sensitiveKeywordCount: policy.sensitiveKeywords?.length || 0
    }
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  if (findings.length) process.exit(1);
}

main();
