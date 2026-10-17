import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';

export function requireAdminApiKey(request, response, next) {
	if (!config.adminApiKey) {
		return response.status(503).json({
			error: 'Admin messaging is disabled. Configure ADMIN_API_KEY in server/.env.',
		});
	}

	const authorization = request.get('authorization') ?? '';
	const suppliedKey = authorization.startsWith('Bearer ')
		? Buffer.from(authorization.slice(7))
		: Buffer.alloc(0);
	const expectedKey = Buffer.from(config.adminApiKey);
	const isValid = suppliedKey.length === expectedKey.length
		&& timingSafeEqual(suppliedKey, expectedKey);

	if (!isValid) {
		return response.status(401).json({ error: 'A valid bearer admin API key is required.' });
	}

	return next();
}