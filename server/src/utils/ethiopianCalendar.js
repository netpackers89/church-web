const ETHIOPIAN_EPOCH_JDN = 1724221;
const MILLISECONDS_PER_DAY = 86400000;

export const ETHIOPIAN_MONTHS = [
	'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
	'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
];

export function isEthiopianLeapYear(year) {
	return Number.isInteger(year) && year > 0 && (year + 1) % 4 === 0;
}

export function ethiopianMonthLength(year, month) {
	if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 13) return 0;
	if (month <= 12) return 30;
	return isEthiopianLeapYear(year) ? 6 : 5;
}

export function validateEthiopianDate({ year, month, day }) {
	if (![year, month, day].every(Number.isInteger)) return false;
	return year >= 1 && month >= 1 && month <= 13 && day >= 1 && day <= ethiopianMonthLength(year, month);
}

export function ethiopianDateToGregorian({ year, month, day }) {
	if (!validateEthiopianDate({ year, month, day })) {
		throw new RangeError('Invalid Ethiopian calendar date.');
	}
	const julianDay = ETHIOPIAN_EPOCH_JDN
		+ (year - 1) * 365
		+ Math.floor(year / 4)
		+ (month - 1) * 30
		+ day - 1;
	const date = new Date((julianDay - 2440588) * MILLISECONDS_PER_DAY);
	return date.toISOString().slice(0, 10);
}

function ethiopianYearStartJulianDay(year) {
	return ETHIOPIAN_EPOCH_JDN + (year - 1) * 365 + Math.floor(year / 4);
}

export function gregorianDateToEthiopian(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new RangeError('birthDateGregorian must use YYYY-MM-DD format.');
	}
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		throw new RangeError('birthDateGregorian is not a valid Gregorian date.');
	}
	const julianDay = Math.floor(date.getTime() / MILLISECONDS_PER_DAY) + 2440588;
	let ethiopianYear = Math.floor(((julianDay - ETHIOPIAN_EPOCH_JDN) * 4) / 1461) + 1;
	while (ethiopianYearStartJulianDay(ethiopianYear + 1) <= julianDay) ethiopianYear += 1;
	while (ethiopianYearStartJulianDay(ethiopianYear) > julianDay) ethiopianYear -= 1;
	const dayOfYear = julianDay - ethiopianYearStartJulianDay(ethiopianYear);
	return {
		year: ethiopianYear,
		month: Math.floor(dayOfYear / 30) + 1,
		day: (dayOfYear % 30) + 1,
	};
}

export function parseEthiopianDate(value) {
	let dateParts;
	if (typeof value === 'string') {
		const match = /^(\d{1,6})-(\d{1,2})-(\d{1,2})$/.exec(value);
		if (!match) throw new RangeError('birthDateEc must use YYYY-MM-DD Ethiopian format.');
		dateParts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
	} else if (value && typeof value === 'object') {
		dateParts = { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
	} else {
		throw new RangeError('birthDateEc is required as a date or year/month/day object.');
	}
	if (!validateEthiopianDate(dateParts)) throw new RangeError('birthDateEc is not a valid Ethiopian calendar date.');
	return dateParts;
}

export function currentGregorianDate(timeZone = 'Africa/Addis_Ababa', now = new Date()) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now);
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

export function calculateAge(birthDateGregorian, today = currentGregorianDate()) {
	const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateGregorian ?? '');
	const current = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
	if (!birth || !current) throw new RangeError('Birth date and current date must be valid YYYY-MM-DD dates.');
	const [, birthYear, birthMonth, birthDay] = birth.map(Number);
	const [, currentYear, currentMonth, currentDay] = current.map(Number);
	let age = currentYear - birthYear;
	if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) age -= 1;
	return age;
}

export function getEthiopianBirthDetails(value, timeZone = 'Africa/Addis_Ababa') {
	const date = parseEthiopianDate(value);
	const gregorianDate = ethiopianDateToGregorian(date);
	const today = currentGregorianDate(timeZone);
	if (gregorianDate > today) throw new RangeError('Date of birth cannot be in the future.');
	return {
		ethiopian: `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`,
		gregorian: gregorianDate,
		age: calculateAge(gregorianDate, today),
	};
}

export function getGregorianBirthDetails(value, timeZone = 'Africa/Addis_Ababa') {
	const ethiopianDate = gregorianDateToEthiopian(value);
	const today = currentGregorianDate(timeZone);
	if (value > today) throw new RangeError('Date of birth cannot be in the future.');
	return {
		ethiopian: `${ethiopianDate.year}-${String(ethiopianDate.month).padStart(2, '0')}-${String(ethiopianDate.day).padStart(2, '0')}`,
		gregorian: value,
		age: calculateAge(value, today),
	};
}