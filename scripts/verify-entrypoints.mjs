#!/usr/bin/env node
// Exercise real copies: symlinked scripts would resolve back to the original path.
import { pythonExecutable } from './python-runtime.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const birthArgs = ['--solar', '1990-05-15', '--hour', '15', '--gender', 'male', '--birthplace', '上海', '--from', '2026', '--to', '2027', '--ziwei-years', '2026'];
const entries = [
  ['time-normalize', birthArgs, data => {
    assert.equal(data.corrected.hour, 14);
    assert.equal(data.corrected.minute, 9);
    assert.equal(data.shichenChanged, true);
  }],
  ['solar-term-boundary', ['--solar', '2023-04-05', '--hour', '9', '--minute', '10'], data => {
    assert.equal(data.near, true);
    assert.equal(data.nearest.name, '清明');
  }],
  ['methodology-framework', ['--summary'], data => assert.equal(data.categoryCount, 6)],
  ['report-framework', ['--summary'], data => assert.ok(data.reportTemplateCount >= 8)],
  ['rule-matcher', birthArgs, data => assert.equal(data.summary.categoryCount, 10)],
  ['hecan-summary', [...birthArgs, '--focus', 'career,migration,health'], data => {
    assert.equal(data.schemaValidation.ok, true);
    assert.equal(data.summary.judgmentCount, 3);
    assert.equal(data.timeBasis.corrected.hour, 14);
    assert.equal(data.timeBasis.corrected.minute, 9);
  }]
];

function run(cwd, args) {
  const result = spawnSync(process.execPath, args, { cwd, env: { ...process.env, NODE: process.execPath, PYTHON: pythonExecutable() }, encoding: 'utf8', maxBuffer: 80 * 1024 * 1024, timeout: 120000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args[0]}: ${result.stdout}\n${result.stderr}`);
  return result;
}

const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'fortune-entrypoints-'));
let checks = 0;
try {
  for (const directory of ['ascii', '中文目录', 'space directory', '编码 space #%']) {
    const fixture = join(temporary, directory);
    mkdirSync(fixture);
    const alias = `${fixture}-link`;
    symlinkSync(fixture, alias, 'dir');
    for (const name of ['scripts', 'references', 'data']) cpSync(join(root, name), join(fixture, name), { recursive: true });
    for (const name of ['node_modules', 'vendor']) symlinkSync(join(root, name), join(fixture, name), 'dir');
    for (const [name, args, validate] of entries) {
      const script = join(fixture, 'scripts', `${name}.mjs`);
      for (const entry of [script, `./scripts/${name}.mjs`, join(alias, 'scripts', `${name}.mjs`)]) {
        validate(JSON.parse(run(fixture, [entry, ...args]).stdout));
        checks++;
      }
      const imported = run(fixture, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        assert.equal(process.argv[1], undefined);
        await import(${JSON.stringify(pathToFileURL(script).href)});
        console.log('import-only');
      `]);
      assert.equal(imported.stdout, 'import-only\n', `${name} must not run its CLI on import`);
      assert.equal(imported.stderr, '');
      checks++;
    }
    console.log(`ok - entrypoints in ${directory}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(`verified ${checks} entrypoint checks`);
