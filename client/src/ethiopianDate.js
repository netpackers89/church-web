const ETHIOPIAN_EPOCH_JDN = 1724221
const DAY_MS = 86400000

export const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
]

export function isEthiopianLeapYear(year) {
  return Number.isInteger(year) && year > 0 && (year + 1) % 4 === 0
}

export function ethiopianMonthLength(year, month) {
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 13) return 0
  if (month < 13) return 30
  return isEthiopianLeapYear(year) ? 6 : 5
}

export function ethiopianToGregorian({ year, month, day }) {
  const maxDay = ethiopianMonthLength(year, month)
  if (!maxDay || !Number.isInteger(day) || day < 1 || day > maxDay) return null
  const julianDay = ETHIOPIAN_EPOCH_JDN + (year - 1) * 365 + Math.floor(year / 4) + (month - 1) * 30 + day - 1
  return new Date((julianDay - 2440588) * DAY_MS).toISOString().slice(0, 10)
}

export function currentGregorianDate(timeZone = 'Africa/Addis_Ababa') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function calculateAge(birthDate, today = currentGregorianDate()) {
  if (!birthDate) return -1
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number)
  let age = currentYear - birthYear
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) age -= 1
  return age
}

export function currentEthiopianDate() {
  const today = currentGregorianDate()
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  const estimate = Number(today.slice(0, 4)) - 7
  for (let year = estimate - 1; year <= estimate + 1; year += 1) {
    const start = Date.parse(`${ethiopianToGregorian({ year, month: 1, day: 1 })}T00:00:00Z`)
    const nextStart = Date.parse(`${ethiopianToGregorian({ year: year + 1, month: 1, day: 1 })}T00:00:00Z`)
    if (todayTime >= start && todayTime < nextStart) {
      const dayOfYear = Math.floor((todayTime - start) / DAY_MS)
      return { year, month: Math.floor(dayOfYear / 30) + 1, day: (dayOfYear % 30) + 1 }
    }
  }
  return { year: estimate, month: 13, day: 5 }
}

/* Convert a Gregorian calendar date (Date or 'YYYY-MM-DD' string) to Ethiopian. */
export function toIsoDate(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function gregorianToEthiopian(input) {
	const iso = typeof input === 'string' ? input.slice(0, 10) : toIsoDate(input);
	const [gy, gm, gd] = iso.split('-').map(Number);
	// Julian Day Number for the proleptic Gregorian date.
	const a = Math.floor((14 - gm) / 12);
	const y = gy + 4800 - a;
	const m = gm + 12 * a - 3;
	const jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

	const daysSinceEpoch = jdn - ETHIOPIAN_EPOCH_JDN;
	const era = Math.floor(daysSinceEpoch / 1461);
	const dayOfEra = daysSinceEpoch % 1461;
	const year = 4 * era + Math.floor(dayOfEra / 1461) + 1;
	const dayOfYear = dayOfEra % 1461;
	const month = Math.floor(dayOfYear / 365) + 1;
	const day = (dayOfYear % 365) + 1;
	return { year, month, day };
}

/* Format an Ethiopian {year, month, day} object, e.g. "12 Tikimt 2018 E.C." */
export function formatEthiopian({ year, month, day }, { includeEc = true } = {}) {
	if (!year || !month || !day) return '';
	const monthName = ETHIOPIAN_MONTHS[month - 1] ?? '';
	return `${day} ${monthName} ${year}${includeEc ? ' E.C.' : ''}`;
}

/* Format a Gregorian ISO date string, e.g. "January 20, 2026". */
export function formatGregorian(iso, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
	if (!iso) return '';
	const date = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return String(iso);
	return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(iso) {
	if (!iso) return '';
	return WEEKDAYS[new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getUTCDay()];
}

/* Returns { day, month } for the small event date badge. */
export function dateBadge(iso) {
	if (!iso) return { day: '', month: '' };
	const date = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
	return { day: String(date.getUTCDate()), month: MONTHS_SHORT[date.getUTCMonth()] };
}

/* Combined display honoring the user's calendar preference. */
export function formatEventDate(iso, calendar = 'gregorian') {
	if (!iso) return '';
	if (calendar === 'ethiopian') {
		return formatEthiopian(gregorianToEthiopian(iso));
	}
	return formatGregorian(iso);
}

export function eventYearMonth(iso, calendar = 'gregorian') {
	if (!iso) return { day: '', month: '' };
	if (calendar === 'ethiopian') {
		const { day, month } = gregorianToEthiopian(iso);
		return { day: String(day), month: (ETHIOPIAN_MONTHS[month - 1] ?? '').slice(0, 3) };
	}
	return dateBadge(iso);
}

