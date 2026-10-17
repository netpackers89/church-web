import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { loadWelcomeEmailTemplate } from '../src/services/memberWelcomeService.js';

test('saved welcome email templates personalize placeholders and render escaped HTML', async (context) => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rowCount: 1,
    rows: [{
      subjectTemplate: 'Welcome {{firstName}} to {{churchName}}',
      bodyTemplate: 'We are glad you are here, {{name}} <script>.',
      title: 'Welcome {{firstName}}',
      greeting: 'Dear {{firstName}},',
      signature: 'With care, {{churchName}}',
      bannerUrl: null,
      ctaUrl: null,
      ctaLabel: null,
    }],
  });
  context.after(() => { pool.query = originalQuery; });

  const email = await loadWelcomeEmailTemplate({ id: '7', name: 'Mimi Desta', email: 'mimi@example.test' });

  assert.match(email.subject, /^Welcome Mimi to /);
  assert.match(email.text, /Dear Mimi/);
  assert.match(email.text, /Mimi Desta <script>/);
  assert.match(email.html, /Mimi Desta &lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
});
