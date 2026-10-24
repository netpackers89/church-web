import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPoolOptions } from '../src/config/db.js';

const baseDatabase = {
  url: 'postgresql://church:secret@db.example.test/church?sslmode=require',
  host: 'localhost',
  port: 5432,
  name: 'church',
  user: 'church',
  password: 'secret',
  ssl: null,
  sslRejectUnauthorized: null,
  sslRootCert: undefined,
};

test('honors sslmode=require without rejecting a self-signed server certificate', () => {
  const options = buildPoolOptions(baseDatabase);
  const connection = new URL(options.connectionString);

  assert.equal(options.ssl.rejectUnauthorized, false);
  assert.equal(connection.searchParams.has('sslmode'), false);
  assert.equal(connection.searchParams.get('host'), null);
});

test('keeps certificate validation enabled for sslmode=verify-full', () => {
  const options = buildPoolOptions({
    ...baseDatabase,
    url: 'postgresql://church:secret@db.example.test/church?sslmode=verify-full',
  });

  assert.equal(options.ssl.rejectUnauthorized, true);
});

test('allows an explicit SSL mode override when connecting with DATABASE_URL', () => {
  const options = buildPoolOptions({ ...baseDatabase, ssl: false });

  assert.equal(options.ssl, false);
});

test('allows certificate verification to be explicitly enabled for sslmode=require', () => {
  const options = buildPoolOptions({ ...baseDatabase, sslRejectUnauthorized: true });

  assert.equal(options.ssl.rejectUnauthorized, true);
});

test('requires TLS and certificate verification in production, including sslmode=require', () => {
  const options = buildPoolOptions({ ...baseDatabase, production: true });

  assert.equal(options.ssl.rejectUnauthorized, true);
});

test('allows the explicit self-signed certificate exception only with sslmode=require in production', () => {
  const options = buildPoolOptions({
    ...baseDatabase,
    production: true,
    sslRejectUnauthorized: false,
  });

  assert.equal(options.ssl.rejectUnauthorized, false);
  assert.throws(
    () => buildPoolOptions({
      ...baseDatabase,
      production: true,
      sslRejectUnauthorized: false,
      url: 'postgres://db.example.test/church?sslmode=verify-full',
    }),
    /can only be disabled for an explicit sslmode=require connection/,
  );
});

test('rejects production database configuration that disables TLS', () => {
  assert.throws(
    () => buildPoolOptions({ ...baseDatabase, production: true, url: 'postgres://db.example.test/church?sslmode=disable' }),
    /TLS cannot be disabled in production/,
  );
});

test('keeps local PostgreSQL SSL disabled when no SSL setting is provided', () => {
  const options = buildPoolOptions({ ...baseDatabase, url: undefined });

  assert.equal(options.ssl, false);
  assert.equal(options.host, 'localhost');
});
