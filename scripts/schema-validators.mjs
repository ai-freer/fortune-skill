import { PILLAR_KEYS, SIGNAL_LEVELS, isSignalLevel } from './constants.mjs';

function ensure(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validatePillars(pillars, errors, path = 'pillars') {
  ensure(pillars && typeof pillars === 'object', `${path} missing`, errors);
  for (const key of PILLAR_KEYS) {
    ensure(Boolean(pillars?.[key]?.ganZhi), `${path}.${key}.ganZhi missing`, errors);
  }
}

function validateLifeEventSignals(lifeEventSignals, errors, path = 'lifeEventSignals') {
  if (!lifeEventSignals) return;
  for (const [name, signal] of Object.entries(lifeEventSignals)) {
    ensure(isSignalLevel(signal?.signalIntensity), `${path}.${name}.signalIntensity must be one of ${SIGNAL_LEVELS.join('/')}`, errors);
    ensure(signal?.level === signal?.signalIntensity, `${path}.${name}.level should mirror signalIntensity`, errors);
  }
}

function validateTimeCorrection(timeCorrection, errors, path = 'timeCorrection') {
  ensure(timeCorrection?.applied === true, `${path}.applied must be true`, errors);
  if (!timeCorrection?.applied) return;
  ensure(Number.isFinite(Date.parse(timeCorrection.instant?.utc)), `${path}.instant.utc missing or invalid`, errors);
  ensure(Boolean(timeCorrection.instant?.tzdbVersion && timeCorrection.instant?.tzifSha256), `${path}.instant timezone provenance missing`, errors);
  ensure(timeCorrection.calendarPolicy?.version === 'utc-instant-v1', `${path}.calendarPolicy missing`, errors);
  ensure(timeCorrection.trueSolarTime?.method === 'local_apparent_solar_time_approximation' && timeCorrection.trueSolarTime?.equationOfTimeApplied === true, `${path}.solar method inconsistent`, errors);
  ensure(timeCorrection.precisionGuard?.reason === null, `${path}.precision guard must pass`, errors);
  ensure(Boolean(timeCorrection.boundary?.corrected), `${path}.boundary.corrected missing`, errors);
  ensure(Boolean(timeCorrection.solarTermBoundary?.checked), `${path}.solarTermBoundary missing`, errors);
}

function validateYearFortune(yearFortune, errors, path = 'yearFortune') {
  if (!yearFortune) return;
  ensure(Number.isInteger(yearFortune.year), `${path}.year missing`, errors);
  ensure(Boolean(yearFortune.ganZhi), `${path}.ganZhi missing`, errors);
  ensure(Array.isArray(yearFortune.formationAnalysis), `${path}.formationAnalysis must be array`, errors);
  ensure(Array.isArray(yearFortune.combinationTransformations), `${path}.combinationTransformations must be array`, errors);
  ensure(Array.isArray(yearFortune.tendencyAnalysis?.primaryTriggerLabels), `${path}.tendencyAnalysis.primaryTriggerLabels must be array`, errors);
  ensure(Boolean(yearFortune.tendencyAnalysis?._legacy?.triggerLabels), `${path}.tendencyAnalysis._legacy.triggerLabels missing`, errors);
  validateLifeEventSignals(yearFortune.lifeEventSignals, errors, `${path}.lifeEventSignals`);
  for (const [index, month] of (yearFortune.liuYue || []).entries()) {
    validateLifeEventSignals(month.lifeEventSignals, errors, `${path}.liuYue[${index}].lifeEventSignals`);
  }
}

export function validateBaziOutput(output) {
  const errors = [];
  validatePillars(output.pillars, errors);
  ensure(Boolean(output.dayMaster?.gan), 'dayMaster.gan missing', errors);
  ensure(Boolean(output.fiveElements?.scores), 'fiveElements.scores missing', errors);
  validateTimeCorrection(output.timeCorrection, errors);
  if (output.mode === 'yearFortune') {
    ensure(Boolean(output.yearFortune), 'yearFortune missing in yearFortune mode', errors);
    validateYearFortune(output.yearFortune, errors);
  } else {
    validateYearFortune(output.annualFortune, errors, 'annualFortune');
    ensure(Boolean(output.tenGods), 'tenGods missing', errors);
    ensure(Boolean(output.hiddenStems), 'hiddenStems missing', errors);
    ensure(Boolean(output.nayin), 'nayin missing', errors);
  }
  return {
    ok: errors.length === 0,
    schema: 'fortune.bazi.v1',
    errors
  };
}

export function validateZiweiOutput(output) {
  const errors = [];
  ensure(Boolean(output.soulPalace?.name), 'soulPalace.name missing', errors);
  ensure(Boolean(output.bodyPalace?.name), 'bodyPalace.name missing', errors);
  ensure(Array.isArray(output.triadAnalysis), 'triadAnalysis must be array', errors);
  validateTimeCorrection(output.timeCorrection, errors);
  if (output.mode === 'yearFortune') {
    ensure(Boolean(output.yearFortuneScope?.sampleDate), 'yearFortuneScope.sampleDate missing', errors);
    ensure(Boolean(output.yearFortuneSummary?.yearly?.mutagen), 'yearFortuneSummary.yearly.mutagen missing', errors);
  } else {
    ensure(Boolean(output.domainScoreScope), 'domainScoreScope missing', errors);
  }
  return {
    ok: errors.length === 0,
    schema: 'fortune.ziwei.v1',
    errors
  };
}

export function validateFortuneReportDataOutput(output) {
  const errors = [];
  validatePillars(output.base?.pillars, errors, 'base.pillars');
  validateTimeCorrection(output.base?.timeCorrection, errors, 'base.timeCorrection');
  ensure(Boolean(output.base?.tenGods?.zhiMain), 'base.tenGods.zhiMain missing', errors);
  ensure(Boolean(output.base?.tenGods?.zhiFull), 'base.tenGods.zhiFull missing', errors);
  ensure(Array.isArray(output.years), 'years must be array', errors);
  for (const [index, year] of (output.years || []).entries()) {
    validateLifeEventSignals(year.lifeEventSignals, errors, `years[${index}].lifeEventSignals`);
  }
  ensure(Boolean(output.ruleMatches?.summary), 'ruleMatches.summary missing', errors);
  return {
    ok: errors.length === 0,
    schema: 'fortune.reportData.v1',
    errors
  };
}

export function validateHecanSummaryOutput(output) {
  const errors = [];
  const evidenceNodeTotal = (output.judgments || []).reduce((sum, item) => sum + (item.evidenceNodes?.length || 0), 0);
  const counterEvidenceTotal = (output.judgments || []).reduce((sum, item) => sum + (item.counterEvidence?.length || 0), 0);
  ensure(output.schemaVersion === 'fortune.hecanSummary.v2', 'schemaVersion must be fortune.hecanSummary.v2', errors);
  ensure(Boolean(output.timeBasis?.principle), 'timeBasis.principle missing', errors);
  ensure(Number.isInteger(output.summary?.judgmentCount), 'summary.judgmentCount missing', errors);
  ensure(output.summary?.cardVersion === 'v2', 'summary.cardVersion must be v2', errors);
  ensure(Number.isInteger(output.summary?.evidenceNodeCount), 'summary.evidenceNodeCount missing', errors);
  ensure(output.summary?.evidenceNodeCount === evidenceNodeTotal, 'summary.evidenceNodeCount should equal evidenceNodes total', errors);
  ensure(Number.isInteger(output.summary?.counterEvidenceCount), 'summary.counterEvidenceCount missing', errors);
  ensure(output.summary?.counterEvidenceCount === counterEvidenceTotal, 'summary.counterEvidenceCount should equal counterEvidence total', errors);
  ensure(Array.isArray(output.summary?.coveredDomains), 'summary.coveredDomains must be array', errors);
  ensure(Number.isInteger(output.summary?.coveragePassCount), 'summary.coveragePassCount missing', errors);
  ensure(Number.isInteger(output.summary?.thinCoverageCount), 'summary.thinCoverageCount missing', errors);
  ensure(Array.isArray(output.summary?.domainCoverage), 'summary.domainCoverage must be array', errors);
  ensure(Array.isArray(output.judgments), 'judgments must be array', errors);
  ensure(output.summary?.judgmentCount === output.judgments?.length, 'summary.judgmentCount should equal judgments.length', errors);
  for (const [index, judgment] of (output.judgments || []).entries()) {
    ensure(judgment.cardVersion === 'v2', `judgments[${index}].cardVersion must be v2`, errors);
    ensure(Boolean(judgment.domain), `judgments[${index}].domain missing`, errors);
    ensure(Boolean(judgment.timeScope), `judgments[${index}].timeScope missing`, errors);
    ensure(Boolean(judgment.claim), `judgments[${index}].claim missing`, errors);
    ensure(typeof judgment.confidence === 'number' && judgment.confidence >= 0 && judgment.confidence <= 1, `judgments[${index}].confidence must be 0..1`, errors);
    ensure(['低', '中', '中高', '高'].includes(judgment.confidenceLabel), `judgments[${index}].confidenceLabel invalid`, errors);
    ensure(Boolean(judgment.confidenceBreakdown), `judgments[${index}].confidenceBreakdown missing`, errors);
    ensure(typeof judgment.confidenceBreakdown?.final === 'number', `judgments[${index}].confidenceBreakdown.final missing`, errors);
    ensure(Boolean(judgment.confidenceBreakdown?.calibrationSample), `judgments[${index}].confidenceBreakdown.calibrationSample missing`, errors);
    ensure(Boolean(judgment.coverage), `judgments[${index}].coverage missing`, errors);
    ensure(['pass', 'thin', 'missing_required_source'].includes(judgment.coverage?.status), `judgments[${index}].coverage.status invalid`, errors);
    ensure(Array.isArray(judgment.coverage?.requiredSources), `judgments[${index}].coverage.requiredSources must be array`, errors);
    ensure(Array.isArray(judgment.coverage?.presentSources), `judgments[${index}].coverage.presentSources must be array`, errors);
    ensure(Array.isArray(judgment.coverage?.missingSources), `judgments[${index}].coverage.missingSources must be array`, errors);
    ensure(Array.isArray(judgment.coverage?.requiredReportBoundaries), `judgments[${index}].coverage.requiredReportBoundaries must be array`, errors);
    ensure(Boolean(judgment.riskBoundary), `judgments[${index}].riskBoundary missing`, errors);
    ensure(Boolean(judgment.evidence), `judgments[${index}].evidence missing`, errors);
    ensure(Array.isArray(judgment.evidence?.bazi), `judgments[${index}].evidence.bazi must be array`, errors);
    ensure(Array.isArray(judgment.evidence?.ziwei), `judgments[${index}].evidence.ziwei must be array`, errors);
    ensure(Array.isArray(judgment.evidence?.rules), `judgments[${index}].evidence.rules must be array`, errors);
    if (judgment.evidence?.calibration) ensure(Array.isArray(judgment.evidence.calibration), `judgments[${index}].evidence.calibration must be array`, errors);
    ensure(Array.isArray(judgment.evidenceNodes), `judgments[${index}].evidenceNodes must be array`, errors);
    for (const [nodeIndex, node] of (judgment.evidenceNodes || []).entries()) {
      ensure(Boolean(node.id), `judgments[${index}].evidenceNodes[${nodeIndex}].id missing`, errors);
      ensure(Boolean(node.source), `judgments[${index}].evidenceNodes[${nodeIndex}].source missing`, errors);
      ensure(Boolean(node.type), `judgments[${index}].evidenceNodes[${nodeIndex}].type missing`, errors);
      ensure(Boolean(node.system), `judgments[${index}].evidenceNodes[${nodeIndex}].system missing`, errors);
      ensure(Boolean(node.layer), `judgments[${index}].evidenceNodes[${nodeIndex}].layer missing`, errors);
      ensure(Boolean(node.summary), `judgments[${index}].evidenceNodes[${nodeIndex}].summary missing`, errors);
      ensure(typeof node.weight === 'number' && node.weight >= 0 && node.weight <= 1, `judgments[${index}].evidenceNodes[${nodeIndex}].weight must be 0..1`, errors);
      ensure(['support', 'counter', 'constraint'].includes(node.polarity), `judgments[${index}].evidenceNodes[${nodeIndex}].polarity invalid`, errors);
    }
    ensure(Array.isArray(judgment.counterEvidence), `judgments[${index}].counterEvidence must be array`, errors);
    for (const [nodeIndex, node] of (judgment.counterEvidence || []).entries()) {
      ensure(Boolean(node.id), `judgments[${index}].counterEvidence[${nodeIndex}].id missing`, errors);
      ensure(Boolean(node.source), `judgments[${index}].counterEvidence[${nodeIndex}].source missing`, errors);
      ensure(Boolean(node.type), `judgments[${index}].counterEvidence[${nodeIndex}].type missing`, errors);
      ensure(Boolean(node.layer), `judgments[${index}].counterEvidence[${nodeIndex}].layer missing`, errors);
      ensure(Boolean(node.summary), `judgments[${index}].counterEvidence[${nodeIndex}].summary missing`, errors);
      ensure(typeof node.weight === 'number' && node.weight >= 0 && node.weight <= 1, `judgments[${index}].counterEvidence[${nodeIndex}].weight must be 0..1`, errors);
      ensure(['support', 'counter', 'constraint'].includes(node.polarity), `judgments[${index}].counterEvidence[${nodeIndex}].polarity invalid`, errors);
    }
    ensure(Array.isArray(judgment.conflicts), `judgments[${index}].conflicts must be array`, errors);
    ensure(Array.isArray(judgment.assumptions), `judgments[${index}].assumptions must be array`, errors);
  }
  return {
    ok: errors.length === 0,
    schema: 'fortune.hecanSummary.v2',
    errors
  };
}

export function attachSchemaValidation(output, validator) {
  const validation = validator(output);
  output.schemaValidation = validation.errors.length
    ? validation
    : { ok: true, schema: validation.schema };
  if (!validation.ok) {
    throw new Error(`schema validation failed: ${validation.errors.join('; ')}`);
  }
  return output;
}
