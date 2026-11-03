// NOAA fractional-year approximation, not a precision solar ephemeris.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// This implementation uses UTC for a unique fractional-year argument.
export function equationOfTimeMinutes(instant) {
  const d = new Date(instant);
  const year = d.getUTCFullYear();
  if (!Number.isFinite(d.getTime()) || year < 1900 || year > 2100) {
    throw new Error('太阳时近似的项目支持范围为 1900–2100 年；这不是精度保证');
  }
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  const gamma = 2 * Math.PI / days * ((d.getTime() - start) / 86400000 - 0.5);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma));
}

export function clockParts(milliseconds) {
  const date = new Date(milliseconds);
  return { solar: date.toISOString().slice(0, 10), hour: date.getUTCHours(),
    minute: date.getUTCMinutes(), second: date.getUTCSeconds() };
}

export function solarClock(instant, longitude) {
  const utc = new Date(instant).getTime();
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('invalid_longitude');
  const equationOfTime = equationOfTimeMinutes(utc);
  const mean = utc + longitude * 4 * 60000;
  return { mean: clockParts(mean), apparent: clockParts(mean + equationOfTime * 60000),
    equationOfTimeMinutes: equationOfTime, method: 'noaa_fractional_year_approximation',
    source: 'https://gml.noaa.gov/grad/solcalc/solareqns.PDF',
    precision: '近似算法；未证明最坏误差界，不提供秒级天文精度保证',
    supportedYears: [1900, 2100] };
}
