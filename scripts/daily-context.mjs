#!/usr/bin/env node
// Query-time calendar context, not a natal chart or a prediction engine.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calendarBasis } from './calendar-basis.mjs';
import { parseInteger } from './cli-input.mjs';
import { isMain } from './cli-entrypoint.mjs';

export function dailyContext(args) {
  const allowed = new Set(['--date', '--hour', '--minute', '--location']);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!allowed.has(key) || opts[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) {
      return { error: 'invalid_arguments', message: 'Use --date YYYY-MM-DD --hour 0-23 [--minute 0-59] --location CITY; no duplicate or unknown options.' };
    }
    opts[key] = args[i + 1];
  }
  if (!opts['--date'] || opts['--hour'] === undefined || !opts['--location']?.trim()) {
    return { error: 'missing_param', message: 'Explicit query date, civil hour and query location are required; do not substitute the birthplace or host date.' };
  }
  const hour = parseInteger(opts['--hour']);
  const minute = parseInteger(opts['--minute'] ?? '0');
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { error: 'invalid_time', message: 'Hour and minute must be integers in 0–23 and 0–59.' };
  }
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./time-normalize.mjs', import.meta.url)),
    '--solar', opts['--date'], '--hour', String(hour), '--minute', String(minute), '--birthplace', opts['--location']],
  { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
  let context;
  try { context = JSON.parse(run.stdout); } catch { /* fail closed below */ }
  if (run.error || run.signal || run.status !== 0 || !context?.instant?.utc) {
    return { error: context?.error || 'time_normalization_failed',
      message: context?.message || 'Query time could not be resolved; no raw-time fallback.' };
  }
  if (context.precisionGuard?.reason) {
    return { error: 'precision_boundary', message: context.precisionGuard.reason, timeContext: context };
  }
  const ec = calendarBasis(context);
  return {
    schemaVersion: 'fortune.dailyContext.v1',
    query: { date: opts['--date'], hour, minute, location: opts['--location'] },
    scope: 'query_instant_not_entire_civil_day',
    pillars: {
      year: { ganZhi: ec.getYear(), wuXing: ec.getYearWuXing() },
      month: { ganZhi: ec.getMonth(), wuXing: ec.getMonthWuXing() },
      day: { ganZhi: ec.getDay(), wuXing: ec.getDayWuXing() }
    },
    solarDateChanged: context.corrected.solar !== opts['--date'],
    timeContext: context,
    limitations: [
      'Calendar context only: no natal strength, useful-god, personalized score, or event prediction.',
      'The query location is not the natal birthplace. Today must first be resolved in the query location.',
      'A reference time does not represent the entire civil day; the solar date or solar-term month may change within it.',
      'Approximation, historical timezone assumptions and precision guards are inherited from time normalization.'
    ]
  };
}

if (isMain(import.meta.url)) {
  let result;
  try { result = dailyContext(process.argv.slice(2)); }
  catch (error) { result = { error: 'daily_context_failed', message: error.message }; }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.error) process.exitCode = 1;
}
