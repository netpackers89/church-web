export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'am', 'om']);
export const MENU_ACTIONS = Object.freeze(['TEXT', 'URL', 'PROFILE', 'GROUPS', 'PROGRAMS', 'GIVING', 'CAMPAIGNS', 'LOCATION', 'CONTACT', 'HELP']);

export function normalizeTelegramText(value) {
	return String(value ?? '')
		.normalize('NFC')
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function localizedValue(values, language = 'en') {
	if (!values || typeof values !== 'object') return '';
	return values[language] || values.en || values.am || values.om || '';
}

export function findAutoReplyRule(rules, message) {
	const input = normalizeTelegramText(message);
	if (!input) return null;
	return [...rules]
		.sort((left, right) => Number(left.priority) - Number(right.priority) || Number(left.id) - Number(right.id))
		.find((rule) => {
			const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
			return keywords.some((keyword) => {
				const normalized = normalizeTelegramText(keyword);
				if (!normalized) return false;
				return rule.matchType === 'EXACT'
					? input === normalized
					: ` ${input} `.includes(` ${normalized} `);
			});
		}) ?? null;
}

export function validateLocalized(values, fieldName, maxLength) {
	if (!values || typeof values !== 'object' || Array.isArray(values)) {
		throw Object.assign(new Error(`${fieldName} must include English, Amharic, and Afaan Oromo text.`), { status: 400 });
	}
	const normalized = {};
	for (const language of SUPPORTED_LANGUAGES) {
		const value = values[language];
		if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
			throw Object.assign(new Error(`${fieldName} must contain valid ${language} text (maximum ${maxLength} characters).`), { status: 400 });
		}
		normalized[language] = value.trim();
	}
	return normalized;
}
