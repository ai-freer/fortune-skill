import { createRequire } from 'node:module';
const { Solar, EightChar } = createRequire(import.meta.url)('lunar-javascript');

function lunarAt(clock) {
  const [year, month, day] = clock.solar.split('-').map(Number);
  return Solar.fromYmdHms(year, month, day, clock.hour, clock.minute, clock.second || 0).getLunar();
}

// Adapt only the library's exact solar-term year/month accessors. All dependent
// ten-gods, hidden stems, TaiYuan and palace calculations then see those pillars.
// Day/hour accessors retain the local solar clock. Do not mutate vendor objects.
export function calendarBasis(context) {
  const apparent = lunarAt(context.corrected);
  const physical = lunarAt(context.calendarReference);
  const mixed = new Proxy(apparent, { get(target, property) {
    const source = /^get(?:Year|Month).*Exact/.test(String(property)) ? physical : target;
    const value = source[property];
    return typeof value === 'function' ? value.bind(source) : value;
  } });
  const ec = EightChar.fromLunar(mixed);
  ec.setSect(2);
  // Yun includes birth-to-Jie intervals, so it must use the physical instant.
  ec.getYun = gender => physical.getEightChar().getYun(gender, 1);
  return ec;
}
