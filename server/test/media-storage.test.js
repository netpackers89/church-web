import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeImageUrl, validateImageFile } from '../src/services/imgbbService.js';

test('image URL validation requires HTTPS and an approved media host', () => {
	assert.equal(isSafeImageUrl('https://i.ibb.co/abc/photo.webp'), true);
	assert.equal(isSafeImageUrl('http://i.ibb.co/abc/photo.webp'), false);
	assert.equal(isSafeImageUrl('https://i.ibb.co.attacker.example/photo.webp'), false);
	assert.equal(isSafeImageUrl('https://example.com/photo.webp'), false);
	assert.equal(isSafeImageUrl('https://media.example.org/photo.webp', ['media.example.org']), true);
});

test('image validation rejects mismatched MIME signatures and accepts PNG bytes', () => {
	assert.throws(() => validateImageFile({
		mimetype: 'image/png',
		size: 4,
		buffer: Buffer.from('not an image'),
	}), /contents do not match/);
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	assert.equal(validateImageFile({ mimetype: 'image/png', size: png.length, buffer: png }).size, png.length);
});