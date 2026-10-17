export function pageParams(query) {
	const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
	const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 24));
	return { page, limit, offset: (page - 1) * limit };
}

export function paged(response, rows, { page, limit }, total = rows.length) {
	return response.json({ success: true, data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export function requestError(error, response) {
	if (error.status) return response.status(error.status).json({ error: error.message });
	if (error.code === '23505') return response.status(409).json({ error: 'A record with those unique values already exists.' });
	if (error.code === '23503') return response.status(409).json({ error: 'This record is still referenced by another record.' });
	if (error.code === '23514' || error.code === '22P02') return response.status(400).json({ error: 'One or more values are invalid.' });
	console.error('[api] request failed:', error.message);
	return response.status(500).json({ error: 'The request could not be completed.' });
}

export function requiredString(value, name, max = 10000) {
	if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
		throw Object.assign(new Error(`${name} is required and is too long or empty.`), { status: 400 });
	}
	return value.trim();
}
