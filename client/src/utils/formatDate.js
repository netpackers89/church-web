/**
 * Date utilities re-exported from the tested Ethiopian/Gregorian conversion
 * module. Central import path so components don't reach into ethiopianDate.js
 * directly. All conversions are Julian-Day-Number based (leap-year aware),
 * never a fixed-day offset.
 */
export {
  currentEthiopianDate,
  currentGregorianDate,
  ethiopianToGregorian,
  gregorianToEthiopian,
  formatEthiopian,
  formatGregorian,
  formatEventDate,
  eventYearMonth,
  weekdayName,
  dateBadge,
  toIsoDate,
  ETHIOPIAN_MONTHS,
} from '../ethiopianDate.js';
