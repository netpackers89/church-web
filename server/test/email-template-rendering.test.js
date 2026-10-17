import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailHtml, renderTemplateVariables } from '../src/services/notificationStudioService.js';

test('email template variables substitute known placeholders and preserve unknown ones', () => {
  assert.equal(
    renderTemplateVariables('Welcome {{ firstName }} to {{churchName}} {{unknown}}', { firstName: 'Mimi', churchName: 'Church' }),
    'Welcome Mimi to Church {{unknown}}',
  );
});

test('email renderer escapes signature content and accepts the safe banner and CTA', () => {
  const html = renderEmailHtml({
    subject: 'Welcome',
    body: 'Hello <member>',
    signature: 'With care,\nChurch Team <script>',
    bannerUrl: 'https://i.ibb.co/church/banner.jpg',
    ctaUrl: 'https://church.example/programs',
    ctaLabel: 'See programs',
  });

  assert.match(html, /Hello &lt;member&gt;/);
  assert.match(html, /Church Team &lt;script&gt;/);
  assert.match(html, /https:\/\/church\.example\/programs/);
  assert.match(html, /https:\/\/i\.ibb\.co\/church\/banner\.jpg/);
});