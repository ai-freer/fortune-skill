// Reject fractional/trailing-junk input instead of silently truncating it.
export function parseInteger(value) {
  if (!/^[+-]?\d+$/.test(String(value))) return NaN;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : NaN;
}
