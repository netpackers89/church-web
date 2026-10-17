import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { sendEmailNotification } from './emailService.js';
import { sendTelegramNotification } from './telegramService.js';
import { audit } from './auditService.js';

// Brand palette from the platform specification. Kept here (not in delivery
// logic) so the email layout matches the site identity and can be retuned in one
// place without touching routing or authorization code.
const PALETTE = {
  primary: '#1664B0', // Aegean Sky
  accent: '#D21624', // Scarlet Bikini
  linen: '#EFE8DE', // Sandy Linen
  ink: '#0F172A', // dark text
  muted: '#64748B', // secondary text
  success: '#15966B',
  white: '#FFFFFF',
};

// The live notification_deliveries.channel CHECK constraint only permits these
// two values. In-app notifications are stored separately in user_notifications
// and are never written as deliveries, so a channel failure can never remove the
// in-app copy (per the platform brief).
const EXTERNAL_CHANNELS = ['EMAIL', 'TELEGRAM'];
const AUDIENCE_TYPES = ['USER', 'USERS', 'DEPARTMENT', 'ORGANIZATION', 'BIBLE_STUDY_GROUP', 'ROLE', 'ALL'];
const MAX_AUDIENCE = 5000;

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

// ---------------------------------------------------------------------------
// Pure, dependency-free validators (unit-tested without a database).
// ---------------------------------------------------------------------------

export function normalizeChannels(channels) {
  if (channels === undefined || channels === null) return [];
  if (!Array.isArray(channels)) throw fail('channels must be an array.');
  const normalized = channels
    .map((channel) => (typeof channel === 'string' ? channel.trim().toUpperCase() : ''))
    .filter((channel) => channel.length > 0);
  for (const channel of normalized) {
    if (!EXTERNAL_CHANNELS.includes(channel)) {
      throw fail(`Unsupported channel "${channel}". Use EMAIL or TELEGRAM.`);
    }
  }
  return [...new Set(normalized)];
}

export function validateAudience(audience) {
  if (!audience || typeof audience !== 'object') throw fail('audience is required.');
  const type = typeof audience.type === 'string' ? audience.type.trim().toUpperCase() : '';
  if (!AUDIENCE_TYPES.includes(type)) {
    throw fail(`audience.type must be one of: ${AUDIENCE_TYPES.join(', ')}.`);
  }
  const ref = audience.ref;
  if (type === 'ALL') return { type, ref: null };
  if (type === 'USER') {
    if (!/^\d+$/.test(String(ref)) || Number(ref) < 1) throw fail('audience.ref must be a positive user id for USER.');
    return { type, ref: String(ref) };
  }
  if (type === 'USERS') {
    if (!Array.isArray(ref) || ref.length === 0) throw fail('audience.ref must be a non-empty array of user ids for USERS.');
    const ids = [...new Set(ref.map(String))];
    if (ids.length > MAX_AUDIENCE || ids.some((id) => !/^\d+$/.test(id) || Number(id) < 1)) {
      throw fail('audience.ref must contain 1..5000 positive user ids.');
    }
    return { type, ref: ids };
  }
  if (type === 'DEPARTMENT' || type === 'ORGANIZATION' || type === 'BIBLE_STUDY_GROUP') {
    const label = type === 'DEPARTMENT' ? 'department' : type === 'ORGANIZATION' ? 'organization' : 'Bible study group';
    if (!/^\d+$/.test(String(ref)) || Number(ref) < 1) throw fail(`audience.ref must be a positive ${label} id.`);
    return { type, ref: String(ref) };
  }
  // ROLE
  if (typeof ref !== 'string' || !ref.trim()) throw fail('audience.ref must be a role code for ROLE.');
  return { type, ref: ref.trim().toUpperCase() };
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw fail(`${field} must be text no longer than ${maxLength} characters.`);
  }
  return value.trim();
}

function requiredText(value, field, maxLength) {
  const text = optionalText(value, field, maxLength);
  if (!text) throw fail(`${field} is required.`);
  return text;
}

export function validateDispatchBody(body) {
  const b = body ?? {};
  const title = optionalText(b.title, 'title', 200);
  const subject = optionalText(b.subject, 'subject', 200);
  const message = requiredText(b.message, 'message', 8000);
  const linkUrl = optionalText(b.linkUrl, 'linkUrl', 500);
  const channels = normalizeChannels(b.channels);
  if (channels.length === 0) throw fail('Select at least one channel (EMAIL or TELEGRAM). In-app is always included.');
  const mode = b.mode === undefined || b.mode === null ? 'LIVE' : String(b.mode).trim().toUpperCase();
  if (!['TEST', 'LIVE'].includes(mode)) throw fail('mode must be TEST or LIVE.');
  const templateId = b.templateId === undefined || b.templateId === null || b.templateId === '' ? null : Number(b.templateId);
  if (templateId !== null && (!Number.isInteger(templateId) || templateId < 1)) throw fail('templateId must be a positive integer.');
  const idempotencyKey = optionalText(b.idempotencyKey, 'idempotencyKey', 80);
  const bannerUrl = optionalText(b.bannerUrl, 'bannerUrl', 500);
  const ctaLabel = optionalText(b.ctaLabel, 'ctaLabel', 60);
  const greeting = optionalText(b.greeting, 'greeting', 200);
  const category = (optionalText(b.category, 'category', 40) ?? 'BROADCAST').toUpperCase();
  const audience = validateAudience(b.audience);
  return { title, subject: subject ?? title, message, linkUrl, channels, mode, templateId, idempotencyKey, bannerUrl, ctaLabel, greeting, category, audience };
}

// ---------------------------------------------------------------------------
// Rendering — placeholders, plain text, branded HTML, and Telegram text.
// All dynamic content is escaped; admin-authored message text is always
// treated as plain text (never raw HTML) so no unsanitized markup executes.
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Supported dynamic placeholders. Values are substituted from this context;
// anything not present is left untouched so typos are visible in previews.
function buildContext(recipient, payload) {
  const name = recipient?.name ?? 'friend';
  return {
    name,
    firstName: String(name).trim().split(/\s+/)[0] || 'friend',
    title: payload.title ?? '',
    subject: payload.subject ?? '',
    message: payload.message ?? '',
    linkUrl: payload.linkUrl ?? '',
    churchName: config.branding.churchName,
    email: recipient?.email ?? '',
    date: new Date().toISOString().slice(0, 10),
  };
}

function renderText(template, context) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(context, key) ? String(context[key]) : match
  ));
}

export function renderTemplateVariables(template, variables = {}) {
  return renderText(template ?? '', variables);
}


// A circular church logo (real logo when configured, otherwise a tasteful
// initials monogram) keeps brand identity even before a logo URL is provided.
function renderLogoCircle(size = 64) {
  const logo = safeUrl(config.branding.logoUrl);
  const initials = escapeHtml(String(config.branding.churchName || 'C').trim().charAt(0).toUpperCase());
  const inner = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(config.branding.churchName)}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:0;" />`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${PALETTE.primary};color:${PALETTE.white};font-family:Georgia,'Times New Roman',serif;font-size:${Math.round(size / 2)}px;line-height:${size}px;text-align:center;">${initials}</div>`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;">${inner}</div>`;
}

function renderBrandHeader(bannerUrl) {
  const banner = safeUrl(bannerUrl ?? config.branding.bannerUrl);
  if (banner) {
    // Banner-present layout: full-width image with the circular logo overlapping.
    return `<tr><td style="position:relative;padding:0;line-height:0;">
        <img src="${escapeHtml(banner)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
      </td></tr>
      <tr><td style="padding:0 28px;"><div style="margin-top:-26px;">${renderLogoCircle(56)}</div></td></tr>`;
  }
  // Graceful fallback layout when no banner exists.
  return `<tr><td style="background:${PALETTE.linen};padding:26px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:16px;">${renderLogoCircle(60)}</td>
        <td style="vertical-align:middle;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:${PALETTE.ink};font-weight:700;">${escapeHtml(config.branding.churchName)}</div>
        </td>
      </tr></table>
    </td></tr>`;
}

function renderBrandFooter() {
  const social = [
    ['Telegram', config.branding.telegramUrl],
    ['YouTube', config.branding.youtubeUrl],
    ['Instagram', config.branding.instagramUrl],
    ['Facebook', config.branding.facebookUrl],
  ].filter(([, url]) => url);
  const socialHtml = social
    .map(([label, url]) => {
      const href = safeUrl(url);
      return href
        ? `<a href="${escapeHtml(href)}" style="color:${PALETTE.white};text-decoration:underline;margin:0 6px;font-size:12px;">${escapeHtml(label)}</a>`
        : '';
    })
    .join('');
  const contact = config.branding.email
    ? `<a href="mailto:${escapeHtml(config.branding.email)}" style="color:${PALETTE.white};text-decoration:none;font-size:12px;">${escapeHtml(config.branding.email)}</a>`
    : '';
  const separator = socialHtml && contact ? ' &middot; ' : '';
  return `<tr><td style="background:${PALETTE.primary};padding:20px 28px;text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:${PALETTE.white};font-weight:700;">${escapeHtml(config.branding.churchName)}</div>
      <div style="font-size:12px;color:#cfe0ef;margin-top:8px;">${socialHtml}${separator}${contact}</div>
    </td></tr>`;
}

// Branded, table-based, email-client-friendly HTML. Admin message text is always
// plain text: escaped and newline-broken, so no unsanitized markup can execute.
export function renderEmailHtml({ greeting, subject, body, ctaUrl, ctaLabel, bannerUrl, signature }) {
  const cta = safeUrl(ctaUrl);
  const bodyHtml = escapeHtml(body ?? '').replace(/\n/g, '<br />');
  const greetHtml = greeting && greeting.trim()
    ? `<p style="margin:0 0 14px;font-size:15px;color:${PALETTE.ink};">${escapeHtml(greeting.trim())}</p>`
    : '';
  const subjectHtml = subject
    ? `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${PALETTE.ink};line-height:1.25;">${escapeHtml(subject)}</h1>`
    : '';
  const ctaHtml = cta
    ? `<div style="margin:22px 0 4px;"><a href="${escapeHtml(cta)}" style="display:inline-block;background:${PALETTE.accent};color:${PALETTE.white};text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;font-size:15px;">${escapeHtml(ctaLabel || 'Learn more')}</a></div>`
    : '';
  const signatureHtml = signature?.trim()
    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${PALETTE.muted};">${escapeHtml(signature.trim()).replace(/\n/g, '<br />')}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject || config.branding.churchName)}</title></head>
<body style="margin:0;padding:0;background:${PALETTE.linen};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject || '')}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETTE.linen};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${PALETTE.white};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        ${renderBrandHeader(bannerUrl)}
        <tr><td style="padding:8px 28px 4px;">
          ${greetHtml}${subjectHtml}
          <div style="font-size:15px;line-height:1.7;color:${PALETTE.ink};">${bodyHtml}</div>
          ${ctaHtml}
          ${signatureHtml}
        </td></tr>
        ${renderBrandFooter()}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Telegram text. Plain text with the church name, personalized greeting, body,
// and any link appended. Inline buttons are attached at dispatch time.
export function renderTelegramText({ greeting, body, ctaUrl }) {
  const header = greeting && greeting.trim() ? greeting.trim() : `*${config.branding.churchName}*`;
  const lines = [header, '', String(body ?? '').trim()];
  const cta = safeUrl(ctaUrl);
  if (cta) {
    lines.push('', cta);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

