
import { Bot } from 'node-telegram-bot-api';
import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { completeTelegramLink } from '../controllers/userController.js';
import { listEvents } from '../controllers/publicController.js';
import { createTelegramRecoveryToken, pool } from '../config/db.js';
import { config } from '../config/env.js';
import { normalizePaymentMethods } from '../services/paymentMethods.js';
import {
  TELEGRAM_LANGUAGES,
  telegramLanguageKeyboard,
  telegramLocale,
  telegramText,
} from './templates/localization.js';
import {
  calculateAge,
  getEthiopianBirthDetails,
} from '../utils/ethiopianCalendar.js';
import { findAutoReplyRule, localizedValue } from './services/configuration.js';

let bot;
let botStarted = false;
let pollingStarting = false;
let stopping = false;
let pollingClient;
const sessionLanguages = new Map();
let warnedMissingLanguageMigration = false;
const TELEGRAM_POLLING_LOCK_ID = 731904251;

function missingLanguageSchema(error) {
  return error?.code === '42703'
    && /language_code|pending_action/.test(error.message || '');
}

function warnMissingLanguageMigration() {
  if (warnedMissingLanguageMigration) return;

  warnedMissingLanguageMigration = true;
  console.warn(
    '[telegram-bot] Language preference migration 045 is not applied; using English by default and keeping language changes for this server session only.',
  );
}

/*
 * Church Telegram Assistant
 *
 * Principles:
 * 1. English is the default language.
 * 2. Language selection is optional.
 * 3. Registration and account connection happen on the website.
 * 4. Personalized data is only shown to linked members.
 * 5. Menus are short and easy to understand.
 * 6. Existing PostgreSQL data remains the source of truth.
 */

const IMAGES = {
  start: 'https://i.pinimg.com/1200x/4a/ae/c9/4aaec9a7dc2143554b3d6723966a0c97.jpg',
  giving: 'https://i.pinimg.com/1200x/c4/ae/9f/c4ae9f33d7b23bdfa128c12bfdf140d5.jpg',
  programs: 'https://i.pinimg.com/1200x/c0/cc/f8/c0ccf82c3dcd29efaa34f77f286de3e5.jpg',
  fundraising: 'https://i.pinimg.com/736x/d6/a9/e6/d6a9e6a046dfe2d81edbd43e8cb621b9.jpg',
  newChristian: 'https://i.pinimg.com/1200x/9c/a4/17/9ca417a56deb76c63b9ca41ad3762f90.jpg',
};

const MENU_ITEMS = [
  ['menuPrograms', 'programs'],
  ['menuGiving', 'giving'],
  ['menuCampaigns', 'campaigns'],
  ['menuLocation', 'location'],
  ['menuProfile', 'profile'],
  ['menuHelp', 'help'],
  ['menuContact', 'contact'],
];

const CONTACT_CATEGORIES = [
  ['SUGGESTION', 'contactCategorySuggestion'],
  ['PROBLEM_REPORT', 'contactCategoryProblem'],
  ['PRAYER_REQUEST', 'contactCategoryPrayer'],
  ['APPRECIATION', 'contactCategoryAppreciation'],
  ['GENERAL_QUESTION', 'contactCategoryQuestion'],
  ['PASTORAL_SUPPORT', 'contactCategoryPastoral'],
  ['TECHNICAL_ISSUE', 'contactCategoryTechnical'],
  ['OTHER', 'contactCategoryOther'],
];

function t(context, key, values) {
  return telegramText(context.language || 'en', key, values);
}

function isPrivate(context) {
  const chatType = context.chat?.type ?? context.message?.chat?.type ?? context.msg?.chat?.type;
  if (chatType) return chatType === 'private';
  return context.chatId != null
    && context.from?.id != null
    && String(context.chatId) === String(context.from.id);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function safeUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function websiteUrl(path) {
  const base = safeUrl(config.branding.websiteUrl);

  if (!base) return null;

  try {
    const url = new URL(base);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 = isIP(hostname) === 4 && (
      /^10\./.test(hostname)
      || /^127\./.test(hostname)
      || /^169\.254\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );

    if (
      url.protocol !== 'https:'
      || hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '::1'
      || hostname === '[::1]'
      || privateIpv4
      || isIP(hostname) === 6
    ) return null;

    return new URL(path, url).href;
  } catch {
    return null;
  }
}

function inlineKeyboard(rows) {
  const validRows = rows
    .map((row) => row.filter(Boolean))
    .filter((row) => row.length);

  return validRows.length
    ? { inline_keyboard: validRows }
    : undefined;
}

function urlButton(label, pathOrUrl, isAbsolute = false) {
  const url = isAbsolute
    ? safeUrl(pathOrUrl)
    : websiteUrl(pathOrUrl);

  return url ? { text: label, url } : null;
}

function staticMenu(language = 'en') {
  const buttons = Object.fromEntries(
    MENU_ITEMS.map(([key, action]) => [
      action,
      { text: telegramText(language, key) },
    ]),
  );

  return {
    keyboard: [
      [buttons.programs, buttons.giving],
      [buttons.campaigns, buttons.location],
      [buttons.profile, buttons.help],
      [buttons.contact],
      [{ text: telegramText(language, 'changeLanguage') }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function persistentMenu(context) {
  const language = context?.language || 'en';
  if (!isPrivate(context)) return staticMenu(language);
  const configuredItems = await pool.query(`SELECT id,label_i18n AS labels,action_type AS "actionType",
    target_url AS "targetUrl",visibility FROM telegram_menu_items WHERE is_active=TRUE
    ORDER BY sort_order,id LIMIT 100`);
  const catalogExists = await pool.query(`SELECT EXISTS(SELECT 1 FROM telegram_menu_items WHERE is_builtin=TRUE) AS managed`);
  const member = await linkedMember(context);
  const visibleItems = configuredItems.rows
    .filter((item) => item.visibility !== 'LINKED_MEMBER' || member)
    .map((item) => ({ text: localizedValue(item.labels, language) }))
    .filter((item) => item.text);
  if (!catalogExists.rows[0]?.managed && !configuredItems.rowCount) return staticMenu(language);
  const keyboard = [];
  for (let index = 0; index < visibleItems.length; index += 2) {
    keyboard.push(visibleItems.slice(index, index + 2));
  }
  keyboard.push([{ text: telegramText(language, 'changeLanguage') }]);
  return { keyboard, resize_keyboard: true, is_persistent: true };
}

async function preferenceFor(context) {
  const telegramUserId = Number(context.from?.id);

  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    context.language = 'en';
    return { language: 'en', pendingAction: null };
  }

  const chatId = String(context.chatId ?? context.chat?.id ?? telegramUserId);

  const displayName = [
    context.from?.first_name,
    context.from?.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 160) || null;

  let account;
  try {
    const result = await pool.query(
      `INSERT INTO telegram_accounts
         (telegram_user_id, chat_id, username, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_user_id)
       DO UPDATE SET
         chat_id = EXCLUDED.chat_id,
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         updated_at = NOW()
       RETURNING
         language_code AS language,
         pending_action AS "pendingAction"`,
      [
        telegramUserId,
        chatId,
        context.from?.username || null,
        displayName,
      ],
    );
    account = result.rows[0] ?? {};
    if (account.language) sessionLanguages.set(telegramUserId, account.language);
  } catch (error) {
    if (!missingLanguageSchema(error)) throw error;
    warnMissingLanguageMigration();

    await pool.query(
      `INSERT INTO telegram_accounts
         (telegram_user_id, chat_id, username, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_user_id)
       DO UPDATE SET
         chat_id = EXCLUDED.chat_id,
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         updated_at = NOW()`,
      [
        telegramUserId,
        chatId,
        context.from?.username || null,
        displayName,
      ],
    );
    account = { language: sessionLanguages.get(telegramUserId) ?? 'en' };
  }

  // English is the default. Never force a language-selection screen.
  context.language = account.language || sessionLanguages.get(telegramUserId) || 'en';

  return {
    language: context.language,
    pendingAction: account.pendingAction ?? null,
  };
}

async function requireLanguage(context, pendingAction) {
  // Kept as a compatibility wrapper for existing handler calls.
  // Language selection is optional, so actions always remain accessible.
  await preferenceFor(context);

  if (pendingAction) {
    context.pendingAction = pendingAction;
  }

  return true;
}

async function sendMainMenu(context) {
  await context.reply(t(context, 'menuPrompt'), {
    reply_markup: await persistentMenu(context),
  });
}

async function beginContact(context) {
  if (isPrivate(context)) {
    await pool.query(`UPDATE telegram_messages SET status='CANCELLED'
      WHERE chat_id=$1 AND status='DRAFT'`, [String(context.chatId)]);
    await pool.query(`UPDATE telegram_accounts SET pending_action=NULL,updated_at=NOW()
      WHERE telegram_user_id=$1`, [Number(context.from.id)]);
  }
  const keyboard = [];
  for (let index = 0; index < CONTACT_CATEGORIES.length; index += 2) {
    keyboard.push(CONTACT_CATEGORIES.slice(index, index + 2).map(([code, key]) => ({
      text: t(context, key),
      callback_data: `contact:category:${code}`,
    })));
  }
  keyboard.push([{ text: t(context, 'contactCancel'), callback_data: 'contact:cancel' }]);
  await context.reply(t(context, 'contactChooseCategory'), { reply_markup: inlineKeyboard(keyboard) });
}

async function sendCancel(context) {
  if (context.from?.id) {
    await pool.query(`UPDATE telegram_accounts SET pending_action=NULL,updated_at=NOW() WHERE telegram_user_id=$1`, [Number(context.from.id)]);
    await pool.query(`UPDATE telegram_messages SET status='CLOSED' WHERE chat_id=$1 AND status='DRAFT'`, [String(context.chatId)]);
  }
  await context.reply(t(context, 'cancelled'), {
    reply_markup: await persistentMenu(context),
  });
}

async function linkedMember(context) {
  if (!isPrivate(context)) return null;

  const telegramUserId = Number(context.from?.id);

  if (!Number.isSafeInteger(telegramUserId)) return null;

  const result = await pool.query(
    `SELECT u.id, u.name, ta.username
     FROM telegram_accounts ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.telegram_user_id = $1
       AND ta.user_id IS NOT NULL
     LIMIT 1`,
    [telegramUserId],
  );

  return result.rows[0] ?? null;
}

function formatDate(value, timezone = config.churchTimezone, language = 'en') {
  if (!value) return t({ language }, 'toBeAnnounced');

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t({ language }, 'toBeAnnounced');
  }

  try {
    return new Intl.DateTimeFormat(telegramLocale(language), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleString('en');
  }
}

function formatAmount(value, currency = 'ETB') {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `— ${escapeHtml(currency)}`;
  }

  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${escapeHtml(currency)}`;
}

export function formatPrograms(events, language = 'en') {
  if (!events.length) {
    return `<b>${escapeHtml(telegramText(language, 'programsTitle'))}</b>\n\n${telegramText(language, 'noPrograms')}`;
  }

  const entries = events.map((event) => {
    const title = escapeHtml(event.title);
    const date = escapeHtml(
      formatDate(event.startAt, event.timezone, language),
    );

    const location = event.location
      ? `\n📍 ${escapeHtml(event.location)}`
      : '';

    return `📅 <b>${title}</b>\n🕒 ${date}${location}`;
  });

  return `<b>${escapeHtml(telegramText(language, 'upcomingPrograms'))}</b>\n\n${entries.join('\n\n')}`;
}

export function formatPaymentMethods(methods, language = 'en') {
  if (!methods.length) {
    return `<b>${telegramText(language, 'givingTitle')}</b>\n\n${telegramText(language, 'noGiving')}`;
  }

  const entries = methods.map((method) => {
    const accountLine = method.type === 'TELEBIRR'
      ? `📱 ${escapeHtml(method.phoneNumber)}`
      : `🔢 <code>${escapeHtml(method.accountNumber)}</code>`;

    const holder = method.accountHolder
      ? `\n👤 ${escapeHtml(method.accountHolder)}`
      : '';

    const branch = method.branch
      ? `\n📍 ${escapeHtml(method.branch)}`
      : '';

    const instructions = method.instructions
      ? `\n${escapeHtml(method.instructions)}`
      : '';

    return `<b>${escapeHtml(method.name)}</b>\n${accountLine}${holder}${branch}${instructions}`;
  });

  return `<b>${telegramText(language, 'officialGiving')}</b>\n\n${entries.join('\n\n')}\n\n${telegramText(language, 'givingHandoff')}`;
}

export function formatCampaigns(campaigns, language = 'en') {
  if (!campaigns.length) {
    return `<b>${telegramText(language, 'campaignsTitle')}</b>\n\n${telegramText(language, 'noCampaigns')}`;
  }

  const entries = campaigns.map((campaign) => {
    const category = campaign.category
      ? `\n${telegramText(language, 'category')}: ${escapeHtml(campaign.category)}`
      : '';

    const goal = campaign.goalAmount == null
      ? ''
      : `\n${telegramText(language, 'goal')}: ${formatAmount(campaign.goalAmount, campaign.currency)}`;

    const raised = `\n${telegramText(language, 'raised')}: ${formatAmount(campaign.raisedAmount, campaign.currency)}`;

    const end = campaign.endsAt
      ? `\n${telegramText(language, 'ends')}: ${escapeHtml(formatDate(campaign.endsAt, config.churchTimezone, language))}`
      : '';

    return `💛 <b>${escapeHtml(campaign.title)}</b>${category}${goal}${raised}${end}`;
  });

  return `<b>${telegramText(language, 'activeCampaigns')}</b>\n\n${entries.join('\n\n')}`;
}

export function formatReceipts(receipts, language = 'en') {
  if (!receipts.length) {
    return `<b>${telegramText(language, 'receiptsTitle')}</b>\n\n${telegramText(language, 'noReceipts')}`;
  }

  const entries = receipts.map((receipt) => {
    const amount = formatAmount(receipt.amount, receipt.currency);
    const date = escapeHtml(formatDate(
      receipt.verifiedAt ?? receipt.receivedAt ?? receipt.createdAt,
      config.churchTimezone,
      language,
    ));
    const category = receipt.category
      ? `\n${telegramText(language, 'receiptCategory')}: ${escapeHtml(receipt.category)}`
      : '';
    const reference = receipt.paymentReference
      ? `\n${telegramText(language, 'reference')}: <code>${escapeHtml(receipt.paymentReference)}</code>`
      : '';

    return `✅ <b>${amount}</b>${category}\n${telegramText(language, 'verified')}: ${date}${reference}`;
  });

  return `<b>${telegramText(language, 'yourReceipts')}</b>\n\n${entries.join('\n\n')}\n\n${telegramText(language, 'receiptsFooter')}`;
}

async function sendPhotoOrText(context, imageUrl, message, markup) {
  const options = {
    parse_mode: 'HTML',
    ...(markup ? { reply_markup: markup } : {}),
  };

  if (imageUrl && message.length <= 1000) {
    try {
      await context.api.sendPhoto({
        chat_id: context.chatId,
        photo: imageUrl,
        caption: message,
        ...options,
      });
      return;
    } catch (error) {
      console.warn('[telegram-bot] Photo unavailable:', error.message);
    }
  }

  // Telegram photo captions have a smaller limit than text messages.
  await context.reply(message, options);
}

async function sendWelcomeCard(context, linked = false) {
  const member = linked ? await linkedMember(context) : null;

  const heading = linked && member
    ? `Welcome back, ${escapeHtml(member.name || 'friend')}! 👋`
    : escapeHtml(telegramText(context.language, 'welcome', {
        church: config.branding.churchName,
      }));

  const body = linked && member
    ? escapeHtml(telegramText(context.language, 'linkedNote'))
    : escapeHtml(telegramText(context.language, 'welcomeBody'));

  const verse = config.branding.bibleVerse
    ? `\n\n<i>“${escapeHtml(config.branding.bibleVerse)}”</i>\n${escapeHtml(config.branding.bibleReference || '')}`
    : '';

  const message = `<b>${heading}</b>\n\n${body}${verse}`;

  const markup = inlineKeyboard([
    [
      urlButton(telegramText(context.language, 'website'), '/', false),
      urlButton(telegramText(context.language, 'programsTitle'), '/programs'),
    ],
  ]);

  await sendPhotoOrText(
    context,
    safeUrl(IMAGES.start) || safeUrl(config.branding.bannerUrl),
    message,
    markup,
  );

  await sendMainMenu(context);
}

async function sendPrograms(context) {
  const response = {
    json(body) {
      this.body = body;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };

  await listEvents(
    { query: { upcoming: 'true', page: '1', limit: '5' } },
    response,
  );

  if (response.statusCode >= 400) {
    console.error('[telegram-bot] listEvents API failure:', {
      status: response.statusCode,
      body: response.body,
    });
    throw Object.assign(
      new Error(response.body?.error || 'Upcoming programs could not be loaded.'),
      { status: response.statusCode },
    );
  }

  const events = response.body?.data ?? [];
  const markup = inlineKeyboard([
    [
      urlButton(t(context, 'viewPrograms'), '/programs'),
      urlButton(t(context, 'viewEvents'), '/programs'),
    ],
  ]);

  await sendPhotoOrText(
    context,
    IMAGES.programs,
    formatPrograms(events, context.language),
    markup,
  );
}

async function sendGiving(context) {
  const result = await pool.query(
    `SELECT key, value
     FROM system_settings
     WHERE key IN (
       'paymentMethods', 'bank_account', 'bankName',
       'accountHolder', 'accountNumber', 'bankBranch',
       'transferInstructions', 'currency'
     )`,
  );

  const settings = Object.fromEntries(
    result.rows.map((row) => [row.key, row.value]),
  );

  const methods = normalizePaymentMethods(settings.paymentMethods, settings);

  const rows = methods.flatMap((method) => {
    const value = method.type === 'TELEBIRR'
      ? method.phoneNumber
      : method.accountNumber;

    if (!value) return [];

    return [[{
      text: `📋 Copy ${method.name}`,
      copy_text: { text: String(value) },
    }]];
  });

  const giveUrl = websiteUrl('/give');

  if (giveUrl) {
    rows.push([{ text: '💛 Giving Instructions', url: giveUrl }]);
  }

  const markup = rows.length ? { inline_keyboard: rows } : undefined;

  await sendPhotoOrText(
    context,
    IMAGES.giving,
    formatPaymentMethods(methods, context.language),
    markup,
  );
}

async function sendCampaigns(context) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.title,
       c.goal_amount AS "goalAmount",
       c.currency,
       c.ends_at AS "endsAt",
       dc.name AS category,
       COALESCE(
         SUM(d.amount) FILTER (
           WHERE d.status = 'APPROVED'
             AND d.deleted_at IS NULL
             AND d.currency = c.currency
         ), 0
       )::numeric AS "raisedAmount"
     FROM fundraising_campaigns c
     LEFT JOIN donation_categories dc ON dc.id = c.category_id
     LEFT JOIN donations d ON d.campaign_id = c.id
     WHERE c.status = 'ACTIVE'
       AND (c.starts_at IS NULL OR c.starts_at <= NOW())
       AND (c.ends_at IS NULL OR c.ends_at >= NOW())
     GROUP BY c.id, dc.name
     ORDER BY c.ends_at ASC NULLS LAST, c.created_at DESC
     LIMIT 8`,
  );

  const rows = result.rows.slice(0, 5).map((campaign) => [{
    text: `💛 ${Array.from(campaign.title).slice(0, 55).join('')}`,
    callback_data: `campaign:${campaign.id}`,
  }]);

  const campaignUrl = websiteUrl('/campaigns');

  if (campaignUrl) {
    rows.push([{ text: 'Explore All Campaigns', url: campaignUrl }]);
  }

  await sendPhotoOrText(
    context,
    IMAGES.fundraising,
    formatCampaigns(result.rows, context.language),
    rows.length ? { inline_keyboard: rows } : undefined,
  );
}

async function sendCampaign(context, id) {
  const result = await pool.query(
    `SELECT
       c.id, c.title, c.description,
       c.goal_amount AS "goalAmount",
       c.currency, c.ends_at AS "endsAt",
       c.cta_url AS "ctaUrl",
       dc.name AS category,
       COALESCE(
         SUM(d.amount) FILTER (
           WHERE d.status = 'APPROVED'
             AND d.deleted_at IS NULL
             AND d.currency = c.currency
         ), 0
       )::numeric AS "raisedAmount"
     FROM fundraising_campaigns c
     LEFT JOIN donation_categories dc ON dc.id = c.category_id
     LEFT JOIN donations d ON d.campaign_id = c.id
     WHERE c.id = $1
       AND c.status = 'ACTIVE'
       AND (c.starts_at IS NULL OR c.starts_at <= NOW())
       AND (c.ends_at IS NULL OR c.ends_at >= NOW())
     GROUP BY c.id, dc.name`,
    [id],
  );

  const campaign = result.rows[0];

  if (!campaign) {
    await context.reply(t(context, 'campaignUnavailable'));
    return;
  }

  const category = campaign.category
    ? `\n${t(context, 'category')}: ${escapeHtml(campaign.category)}`
    : '';

  const description = campaign.description
    ? `\n\n${escapeHtml(campaign.description)}`
    : '';

  const goal = campaign.goalAmount == null
    ? ''
    : `\n${t(context, 'goal')}: ${formatAmount(campaign.goalAmount, campaign.currency)}`;

  const end = campaign.endsAt
    ? `\n${t(context, 'ends')}: ${escapeHtml(formatDate(campaign.endsAt, config.churchTimezone, context.language))}`
    : '';

  const message =
    `💛 <b>${escapeHtml(campaign.title)}</b>` +
    `${category}${description}${goal}` +
    `\n${t(context, 'raised')}: ${formatAmount(campaign.raisedAmount, campaign.currency)}${end}`;

  const campaignUrl =
    safeUrl(campaign.ctaUrl) ||
    websiteUrl('/give');

  await context.reply(message, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard([
      campaignUrl
        ? [{ text: t(context, 'giveToCampaign'), url: campaignUrl }]
        : [],
      [{ text: t(context, 'campaignsTitle'), callback_data: 'menu:campaigns' }],
    ]),
  });
}

async function sendReceipts(context) {
  if (!isPrivate(context)) {
    await context.reply(t(context, 'privateReceipts'));
    return;
  }

  const member = await linkedMember(context);

  if (!member) {
    await sendConnectInstructions(context);
    return;
  }

  const result = await pool.query(
    `SELECT
       d.id::text AS id,
       d.amount, d.currency,
       d.payment_reference AS "paymentReference",
       d.received_at AS "receivedAt",
       d.verified_at AS "verifiedAt",
       d.created_at AS "createdAt",
       dc.name AS category
     FROM donations d
     LEFT JOIN donation_categories dc ON dc.id = d.category_id
     WHERE d.user_id = $1
       AND d.status = 'APPROVED'
       AND d.deleted_at IS NULL
     ORDER BY COALESCE(
       d.verified_at, d.received_at, d.created_at
     ) DESC
     LIMIT 10`,
    [member.id],
  );

  if (!result.rows.length) {
    await context.reply(
      t(context, 'noReceipts'),
      {
        reply_markup: inlineKeyboard([
          [urlButton(t(context, 'openGivingRecords'), '/give?tab=history')],
          [{ text: t(context, 'back'), callback_data: 'menu:main' }],
        ]),
      },
    );
    return;
  }

  const entries = result.rows.map((receipt) => {
    const date = formatDate(
      receipt.verifiedAt ?? receipt.receivedAt ?? receipt.createdAt,
      config.churchTimezone,
      context.language,
    );

    const reference = receipt.paymentReference
      ? `\n${t(context, 'reference')}: <code>${escapeHtml(receipt.paymentReference)}</code>`
      : '';

    return `✅ <b>${formatAmount(receipt.amount, receipt.currency)}</b>\n${escapeHtml(date)}${reference}`;
  });

  await context.reply(
    `<b>${escapeHtml(t(context, 'yourReceipts'))}</b>\n\n${entries.join('\n\n')}`,
    {
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard([
        [urlButton(t(context, 'openGivingRecords'), '/give?tab=history')],
        [{ text: t(context, 'back'), callback_data: 'menu:main' }],
      ]),
    },
  );
}

async function sendProfile(context) {
  if (!isPrivate(context)) {
    await context.reply(t(context, 'profilePrivate'));
    return;
  }

  const member = await linkedMember(context);

  if (!member) {
    await context.reply(
      t(context, 'profileUnlinked'),
      {
        reply_markup: inlineKeyboard([
          [{ text: t(context, 'connectButton'), callback_data: 'menu:connect' }],
          [{ text: t(context, 'back'), callback_data: 'menu:main' }],
        ]),
      },
    );
    return;
  }

  const user = await pool.query(
    `SELECT u.id, u.name, u.first_name AS "firstName", u.father_name AS "fatherName",
            u.grandfather_name AS "grandfatherName", u.birth_date_gregorian AS "birthDateGregorian",
            TO_CHAR(u.birth_date_ec, 'YYYY-MM-DD') AS "birthDateEc", u.location, u.other_location AS "otherLocation",
            u.marital_status AS "maritalStatus", u.role, u.account_status AS "accountStatus",
            u.created_at AS "createdAt",
            (SELECT ta.username FROM telegram_accounts ta WHERE ta.user_id = u.id ORDER BY ta.linked_at DESC NULLS LAST LIMIT 1) AS "telegramUsername",
            (SELECT ta.linked_at FROM telegram_accounts ta WHERE ta.user_id = u.id ORDER BY ta.linked_at DESC NULLS LAST LIMIT 1) AS "telegramLinkedAt"
     FROM users u
     WHERE u.id = $1
     LIMIT 1`,
    [member.id],
  );

  const profile = user.rows[0] ?? member;
  const fullName = [
    profile.firstName,
    profile.fatherName,
    profile.grandfatherName,
  ].filter(Boolean).join(' ') || profile.name || t(context, 'profileNotProvided');

  let ageText = t(context, 'profileNotProvided');
  const birthDateGregorian = profile.birthDateGregorian || null;
  const birthDateEc = profile.birthDateEc || null;

  if (birthDateGregorian) {
    try {
      ageText = `${calculateAge(birthDateGregorian)} years`;
    } catch {
      ageText = t(context, 'profileNotProvided');
    }
  } else if (birthDateEc) {
    try {
      ageText = `${getEthiopianBirthDetails(birthDateEc, config.churchTimezone).age} years`;
    } catch {
      ageText = t(context, 'profileNotProvided');
    }
  }

  const locationText = [profile.location, profile.otherLocation].filter((value) => typeof value === 'string' && value.trim()).join(', ') || t(context, 'profileNotProvided');
  const maritalStatus = profile.maritalStatus || t(context, 'profileNotProvided');
  const membershipStatus = profile.role || profile.accountStatus || t(context, 'profileNotProvided');
  const telegramStatus = profile.telegramUsername || profile.telegramLinkedAt ? t(context, 'profileConnected') : t(context, 'profileNotConnected');

  const departmentRows = await pool.query(
    `SELECT d.id, d.name, d.description, d.leader_name AS "leaderName",
            d.meeting_location AS "meetingLocation",
            d.meeting_schedule AS "meetingSchedule",
            dm.role AS "membershipRole",
            dm.status AS "membershipStatus",
            COALESCE(d.telegram_public_link, d.telegram_invite_link) AS "telegramLink",
            (SELECT a.title FROM announcements a
             WHERE a.department_id = d.id AND a.status = 'PUBLISHED' AND a.deleted_at IS NULL
             ORDER BY COALESCE(a.published_at, a.created_at) DESC
             LIMIT 1) AS "recentAnnouncement"
     FROM department_members dm
     JOIN departments d ON d.id = dm.department_id
     WHERE dm.user_id = $1 AND dm.status = 'ACTIVE' AND d.deleted_at IS NULL
     ORDER BY d.name`,
    [profile.id],
  );

  const bibleRows = await pool.query(
    `SELECT g.id, g.name, g.description, g.leader_name AS "leaderName",
            g.location_text AS "locationText",
            g.meeting_schedule AS "meetingSchedule",
            bsm.role AS "membershipRole",
            COALESCE(g.telegram_public_link, g.telegram_invite_link) AS "telegramLink",
            (SELECT a.title FROM announcements a
             WHERE a.bible_study_group_id = g.id AND a.status = 'PUBLISHED' AND a.deleted_at IS NULL
             ORDER BY COALESCE(a.published_at, a.created_at) DESC
             LIMIT 1) AS "recentAnnouncement"
     FROM bible_study_memberships bsm
     JOIN bible_study_groups g ON g.id = bsm.bible_study_group_id
     WHERE bsm.user_id = $1 AND g.deleted_at IS NULL
     ORDER BY g.name`,
    [profile.id],
  );

  const departments = departmentRows.rows || [];
  const bibleStudies = bibleRows.rows || [];

  const profileLines = [
    `<b>${escapeHtml(t(context, 'profileMyChurchProfile'))}</b>`,
    '',
    `<b>${escapeHtml(t(context, 'profilePersonalInfo'))}</b>`,
    `${t(context, 'profileName')}: ${escapeHtml(fullName)}`,
    `${t(context, 'profileAge')}: ${escapeHtml(ageText)}`,
    `${t(context, 'profileGender')}: ${escapeHtml(t(context, 'profileNotProvided'))}`,
    `${t(context, 'profileMaritalStatus')}: ${escapeHtml(maritalStatus)}`,
    `${t(context, 'profileLocation')}: ${escapeHtml(locationText)}`,
    `${t(context, 'profileMemberSince')}: ${escapeHtml(formatDate(profile.createdAt, config.churchTimezone, context.language))}`,
    '',
    `<b>${escapeHtml(t(context, 'profileChurchMembership'))}</b>`,
    `${t(context, 'profileStatus')}: ${escapeHtml(membershipStatus)}`,
    `${t(context, 'profileDepartments')}`,
    ...(departments.length
      ? departments.map((department) => `- ${escapeHtml(department.name)}`)
      : [`${escapeHtml(t(context, 'profileNoDepartments'))}`]),
    `${t(context, 'profileBibleStudies')}`,
    ...(bibleStudies.length
      ? bibleStudies.map((study) => `- ${escapeHtml(study.name)}`)
      : [`${escapeHtml(t(context, 'profileNoBibleStudies'))}`]),
    ...(departments.length || bibleStudies.length ? [] : [`${escapeHtml(t(context, 'profileNoGroupsJoined'))}`]),
    '',
    `${t(context, 'profileTelegram')}: ${escapeHtml(telegramStatus)}`,
  ].join('\n');

  await context.reply(profileLines, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard([
      [{ text: t(context, 'profileUpdateProfile'), callback_data: 'menu:profile' }],
      [{ text: t(context, 'profileMyDepartments'), callback_data: 'group:my_departments' }],
      [{ text: t(context, 'profileMyBibleStudies'), callback_data: 'group:my_bible_studies' }],
      [{ text: t(context, 'profileChurchLocation'), callback_data: 'menu:location' }],
      ...(profile.telegramUsername || profile.telegramLinkedAt
        ? [[{ text: t(context, 'profileTelegramSettings'), callback_data: 'menu:telegram_disconnect' }]]
        : []),
      [{ text: t(context, 'menu'), callback_data: 'menu:main' }],
    ]),
  });
}

async function sendMyDepartments(context) {
  if (!isPrivate(context)) {
    await context.reply(t(context, 'profilePrivate'));
    return;
  }

  const member = await linkedMember(context);

  if (!member) {
    await context.reply(
      t(context, 'profileUnlinked'),
      {
        reply_markup: inlineKeyboard([
          [{ text: t(context, 'connectButton'), callback_data: 'menu:connect' }],
          [{ text: t(context, 'back'), callback_data: 'menu:profile' }],
        ]),
      },
    );
    return;
  }

  const result = await pool.query(
    `SELECT d.id, d.name, d.description, d.leader_name AS "leaderName",
            dm.status AS "membershipStatus",
            d.meeting_location AS "meetingLocation",
            d.meeting_schedule AS "meetingSchedule",
            COALESCE(d.telegram_public_link, d.telegram_invite_link) AS "telegramLink",
            (SELECT a.title FROM announcements a
             WHERE a.department_id = d.id AND a.status = 'PUBLISHED' AND a.deleted_at IS NULL
             ORDER BY COALESCE(a.published_at, a.created_at) DESC
             LIMIT 1) AS "recentAnnouncement"
     FROM department_members dm
     JOIN departments d ON d.id = dm.department_id
     WHERE dm.user_id = $1 AND dm.status = 'ACTIVE' AND d.deleted_at IS NULL
     ORDER BY d.name`,
    [member.id],
  );

  if (!result.rows.length) {
    const exploreUrl = websiteUrl('/groups');
    await context.reply(
      t(context, 'profileNoDepartments'),
      {
        reply_markup: inlineKeyboard([
          exploreUrl ? [{ text: t(context, 'profileExploreAvailableGroups'), url: exploreUrl }] : [],
          [{ text: t(context, 'profileBackToProfile'), callback_data: 'menu:profile' }],
          [{ text: t(context, 'menu'), callback_data: 'menu:main' }],
        ]),
      },
    );
    return;
  }

  const message = ['<b>👥 My Departments</b>', ''].concat(result.rows.map((department) => {
    const leader = department.leaderName ? `\n👤 ${t(context, 'profileLeader')}: ${escapeHtml(department.leaderName)}` : '';
    const description = department.description ? `\n📝 ${escapeHtml(department.description)}` : '';
    const meetingLocation = department.meetingLocation ? `\n📍 ${t(context, 'profileMeetingLocation')}: ${escapeHtml(department.meetingLocation)}` : '';
    const meetingSchedule = department.meetingSchedule ? `\n⏰ ${t(context, 'profileMeetingSchedule')}: ${escapeHtml(department.meetingSchedule)}` : '';
    const announcement = department.recentAnnouncement ? `\n📣 ${t(context, 'profileRecentAnnouncement')}: ${escapeHtml(department.recentAnnouncement)}` : '';
    const status = department.membershipStatus ? `\n🧩 ${t(context, 'profileMembershipStatus')}: ${escapeHtml(department.membershipStatus)}` : '';
    return `<b>${escapeHtml(department.name)}</b>${description}${leader}${status}${meetingLocation}${meetingSchedule}${announcement}`;
  })).join('\n\n');

  const keyboardRows = result.rows.map((department) => {
    const buttons = [
      { text: t(context, 'profileViewDepartment'), callback_data: `group:view:department:${department.id}` },
    ];
    if (safeUrl(department.telegramLink)) {
      buttons.push({ text: t(context, 'profileOpenTelegramGroup'), url: safeUrl(department.telegramLink) });
    }
    return buttons;
  });

  await context.reply(message, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard([
      ...keyboardRows,
      [{ text: t(context, 'profileBackToProfile'), callback_data: 'menu:profile' }],
      [{ text: t(context, 'menu'), callback_data: 'menu:main' }],
    ]),
  });
}

async function sendMyBibleStudies(context) {
  if (!isPrivate(context)) {
    await context.reply(t(context, 'profilePrivate'));
    return;
  }

  const member = await linkedMember(context);

  if (!member) {
    await context.reply(
      t(context, 'profileUnlinked'),
      {
        reply_markup: inlineKeyboard([
          [{ text: t(context, 'connectButton'), callback_data: 'menu:connect' }],
          [{ text: t(context, 'back'), callback_data: 'menu:profile' }],
        ]),
      },
    );
    return;
  }

  const result = await pool.query(
    `SELECT g.id, g.name, g.description, g.leader_name AS "leaderName",
            g.location_text AS "locationText",
            g.meeting_schedule AS "meetingSchedule",
            COALESCE(g.telegram_public_link, g.telegram_invite_link) AS "telegramLink",
            (SELECT a.title FROM announcements a
             WHERE a.bible_study_group_id = g.id AND a.status = 'PUBLISHED' AND a.deleted_at IS NULL
             ORDER BY COALESCE(a.published_at, a.created_at) DESC
             LIMIT 1) AS "recentAnnouncement"
     FROM bible_study_memberships bsm
     JOIN bible_study_groups g ON g.id = bsm.bible_study_group_id
     WHERE bsm.user_id = $1 AND g.deleted_at IS NULL
     ORDER BY g.name`,
    [member.id],
  );

  if (!result.rows.length) {
    const exploreUrl = websiteUrl('/groups');
    await context.reply(
      t(context, 'profileNoBibleStudies'),
      {
        reply_markup: inlineKeyboard([
          exploreUrl ? [{ text: t(context, 'profileExploreAvailableGroups'), url: exploreUrl }] : [],
          [{ text: t(context, 'profileBackToProfile'), callback_data: 'menu:profile' }],
          [{ text: t(context, 'menu'), callback_data: 'menu:main' }],
        ]),
      },
    );
    return;
  }

  const message = ['<b>📖 My Bible Studies</b>', ''].concat(result.rows.map((group) => {
    const leader = group.leaderName ? `\n👤 ${t(context, 'profileLeader')}: ${escapeHtml(group.leaderName)}` : '';
    const description = group.description ? `\n📝 ${escapeHtml(group.description)}` : '';
    const meetingLocation = group.locationText ? `\n📍 ${t(context, 'profileMeetingLocation')}: ${escapeHtml(group.locationText)}` : '';
    const meetingSchedule = group.meetingSchedule ? `\n⏰ ${t(context, 'profileMeetingSchedule')}: ${escapeHtml(group.meetingSchedule)}` : '';
    const announcement = group.recentAnnouncement ? `\n📣 ${t(context, 'profileRecentAnnouncement')}: ${escapeHtml(group.recentAnnouncement)}` : '';
    return `<b>${escapeHtml(group.name)}</b>${description}${leader}${meetingLocation}${meetingSchedule}${announcement}`;
  })).join('\n\n');

  const keyboardRows = result.rows.map((group) => {
    const buttons = [
      { text: t(context, 'profileViewBibleStudy'), callback_data: `group:view:bible:${group.id}` },
    ];
    if (safeUrl(group.telegramLink)) {
      buttons.push({ text: t(context, 'profileOpenTelegramGroup'), url: safeUrl(group.telegramLink) });
    }
    return buttons;
  });

  await context.reply(message, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard([
      ...keyboardRows,
      [{ text: t(context, 'profileBackToProfile'), callback_data: 'menu:profile' }],
      [{ text: t(context, 'menu'), callback_data: 'menu:main' }],
    ]),
  });
}

async function sendGroupDetails(context, type, id) {
  const member = await linkedMember(context);

  if (!member) {
    await context.reply(t(context, 'profileUnlinked'), {
      reply_markup: inlineKeyboard([
        [{ text: t(context, 'connectButton'), callback_data: 'menu:connect' }],
        [{ text: t(context, 'back'), callback_data: 'menu:profile' }],
      ]),
    });
    return;
  }

  let groupQuery;
  if (type === 'department') {
    groupQuery = `SELECT d.id, d.name, d.description, d.leader_name AS "leaderName",
                        d.meeting_location AS "meetingLocation",
                        d.meeting_schedule AS "meetingSchedule",
                        dm.role AS "membershipRole",
                        dm.status AS "membershipStatus",
                        COALESCE(d.telegram_public_link, d.telegram_invite_link) AS "telegramLink"
                  FROM department_members dm
                  JOIN departments d ON d.id = dm.department_id
                  WHERE dm.user_id = $1 AND d.id = $2 AND dm.status = 'ACTIVE' AND d.deleted_at IS NULL
                  LIMIT 1`;
  } else {
    groupQuery = `SELECT g.id, g.name, g.description, g.leader_name AS "leaderName",
                        g.location_text AS "locationText",
                        g.meeting_schedule AS "meetingSchedule",
                        bsm.role AS "membershipRole",
                        COALESCE(g.telegram_public_link, g.telegram_invite_link) AS "telegramLink"
                  FROM bible_study_memberships bsm
                  JOIN bible_study_groups g ON g.id = bsm.bible_study_group_id
                  WHERE bsm.user_id = $1 AND g.id = $2 AND g.deleted_at IS NULL
                  LIMIT 1`;
  }

  const result = await pool.query(groupQuery, [member.id, Number(id)]);
  const group = result.rows[0];

  if (!group) {
    await context.reply(t(context, 'buttonUnavailable'));
    return;
  }

  const details = [
    `<b>${escapeHtml(group.name)}</b>`,
    group.description ? `\n${escapeHtml(group.description)}` : '',
    group.leaderName ? `\n👤 ${t(context, 'profileLeader')}: ${escapeHtml(group.leaderName)}` : '',
    `\n🧩 ${t(context, 'profileMembershipStatus')}: ${escapeHtml(group.membershipStatus || group.membershipRole || 'ACTIVE')}`,
    group.meetingLocation || group.locationText ? `\n📍 ${t(context, 'profileMeetingLocation')}: ${escapeHtml(group.meetingLocation || group.locationText)}` : '',
    group.meetingSchedule ? `\n⏰ ${t(context, 'profileMeetingSchedule')}: ${escapeHtml(group.meetingSchedule)}` : '',
  ].join('');

  const replyKeyboard = [
    safeUrl(group.telegramLink) ? [{ text: t(context, 'profileOpenTelegramGroup'), url: safeUrl(group.telegramLink) }] : [],
    [{ text: t(context, 'profileBackToProfile'), callback_data: 'menu:profile' }],
    [{ text: t(context, 'menu'), callback_data: 'menu:main' }],
  ];

  await context.reply(details, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard(replyKeyboard),
  });
}

async function sendSignup(context) {
  await context.reply(t(context, 'signupInstructions'));
}

async function sendConnectInstructions(context) {
  await context.reply(t(context, 'connectInstructions'));
}

async function sendLocation(context) {
  const result = await pool.query(
    `SELECT key, value
     FROM system_settings
     WHERE key IN (
       'address', 'churchAddress', 'googleMapsLink',
       'mapsUrl', 'location'
     )`,
  );

  const settings = Object.fromEntries(
    result.rows.map(({ key, value }) => [key, value]),
  );

  const address = [
    settings.address,
    settings.churchAddress,
    settings.location,
  ].find((value) => typeof value === 'string' && value.trim());

  const mapUrl = safeUrl(
    settings.googleMapsLink ?? settings.mapsUrl,
  ) ?? 'https://www.google.com/maps/search/?api=1&query=9.057474946312198%2C38.86319895979084';

  const latitude = 9.057474946312198;
  const longitude = 38.86319895979084;

  try {
    await context.api.sendLocation({
      chat_id: context.chatId,
      latitude,
      longitude,
    });
  } catch (error) {
    console.warn('[telegram-bot] sendLocation failed:', error.message);
  }

  const message = [
    `<b>${escapeHtml(t(context, 'churchLocationTitle'))}</b>`,
    '',
    escapeHtml(t(context, 'churchLocationPlace')),
    '',
    `<b>${escapeHtml(t(context, 'churchLocationOurLocation'))}</b>`,
    escapeHtml(t(context, 'churchLocationAddress')),
    '',
    `<a href="${escapeHtml(mapUrl)}">${escapeHtml(t(context, 'churchLocationMaps'))}</a>`,
  ].join('\n');

  await context.reply(message, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard([
      [{ text: t(context, 'churchLocationButton'), url: mapUrl }],
      [{ text: t(context, 'back'), callback_data: 'menu:main' }],
    ]),
  });
}

async function sendNewChristian(context) {
  const url = websiteUrl('/new-christian');
  const message = `<b>${escapeHtml(t(context, 'newChristianTitle'))}</b>\n\n${escapeHtml(t(context, 'newChristianBody'))}`;

  await sendPhotoOrText(
    context,
    IMAGES.newChristian,
    message,
    inlineKeyboard([
      url ? [{ text: t(context, 'newChristianButton'), url }] : [],
      [{ text: t(context, 'back'), callback_data: 'menu:main' }],
    ]),
  );
}

async function sendHelp(context) {
  const lines = [`<b>${escapeHtml(t(context, 'helpTitle'))}</b>`, '', t(context, 'helpBody')];

  if (config.branding.email) {
    lines.push(
      '',
      `Email: <a href="mailto:${escapeHtml(config.branding.email)}">${escapeHtml(config.branding.email)}</a>`,
    );
  }

  if (config.branding.phone) {
    lines.push(`Phone: ${escapeHtml(config.branding.phone)}`);
  }

  await context.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard([
      [urlButton(t(context, 'website'), '/')],
      [{ text: t(context, 'back'), callback_data: 'menu:main' }],
    ]),
  });
}

async function sendGivingInstructions(context) {
  const url = websiteUrl('/give');

  if (!url) {
    await context.reply(t(context, 'noGivingUrl'));
    return;
  }

  await context.reply(
    t(context, 'givingInstructions'),
    {
      reply_markup: {
        inline_keyboard: [[
          { text: t(context, 'givingPage'), url },
        ]],
      },
    },
  );
}

async function sendLanguagePrompt(context) {
  await context.reply(
    '🌐 Choose your language / ቋንቋ ይምረጡ / Afaan filadhu',
    { reply_markup: telegramLanguageKeyboard() },
  );
}

async function changeLanguage(context) {
  await preferenceFor(context);
  await sendLanguagePrompt(context);
}

function registerHandlers(instance) {
  const actions = {
    programs: sendPrograms,
    giving: sendGiving,
    giving_submit: sendGivingInstructions,
    campaigns: sendCampaigns,
    receipts: sendReceipts,
    profile: sendProfile,
    departments: sendMyDepartments,
    bible_studies: sendMyBibleStudies,
    my_departments: sendMyDepartments,
    my_bible_studies: sendMyBibleStudies,
    help: sendHelp,
    menu: sendMainMenu,
    cancel: sendCancel,
    location: sendLocation,
    signup: sendSignup,
    connect: sendConnectInstructions,
    newchristian: sendNewChristian,
    contact: beginContact,
    telegram_disconnect: async (context) => {
      if (!isPrivate(context)) {
        await context.reply(t(context, 'linkPrivate'));
        return;
      }
      const member = await linkedMember(context);
      if (!member) {
        await context.reply(t(context, 'telegramNotConnected'), {
          reply_markup: inlineKeyboard([
            ...(websiteUrl('/account') ? [[{ text: t(context, 'telegramConnectButton'), url: websiteUrl('/account') }]] : []),
            [{ text: t(context, 'back'), callback_data: 'menu:main' }],
          ]),
        });
        return;
      }
      let recoveryUrl = null;
      const telegramUserId = Number(context.from?.id);
      const accountUrl = websiteUrl('/account');
      if (Number.isSafeInteger(telegramUserId) && telegramUserId > 0 && accountUrl) {
        const token = randomBytes(32).toString('base64url');
        await createTelegramRecoveryToken(telegramUserId, createHash('sha256').update(token).digest('hex'));
        const url = new URL(accountUrl);
        url.searchParams.set('telegramRecovery', token);
        recoveryUrl = url.href;
      }
      await context.reply(t(context, 'telegramDisconnectPrompt'), {
        reply_markup: inlineKeyboard([
          ...(recoveryUrl ? [[{ text: t(context, 'telegramDisconnectConfirm'), url: recoveryUrl }]] : []),
          [{ text: t(context, 'telegramDisconnectCancel'), callback_data: 'menu:main' }],
        ]),
      });
    },
  };

  async function runAction(context, action) {
    await preferenceFor(context);

    if (action === 'start') {
      const member = await linkedMember(context);
      await sendWelcomeCard(context, Boolean(member));
      return;
    }

    const handler = actions[action];

    if (!handler) {
      await context.reply(t(context, 'menuPrompt'));
      return;
    }

    await handler(context);
  }

  async function runConfiguredMenuItem(context, item) {
    if (item.visibility === 'LINKED_MEMBER' && !await linkedMember(context)) {
      await context.reply(t(context, 'buttonUnavailable'));
      return;
    }
    if (item.actionType === 'TEXT') {
      await context.reply(localizedValue(item.responses, context.language));
      return;
    }
    if (item.actionType === 'URL') {
      const url = safeUrl(item.targetUrl);
      if (!url) {
        await context.reply(t(context, 'buttonUnavailable'));
        return;
      }
      await context.reply(localizedValue(item.labels, context.language), {
        reply_markup: inlineKeyboard([[{ text: t(context, 'website'), url }]]),
      });
      return;
    }
    const mappedActions = {
      PROFILE: 'profile',
      GROUPS: 'my_departments',
      PROGRAMS: 'programs',
      GIVING: 'giving',
      HELP: 'help',
      CAMPAIGNS: 'campaigns',
      LOCATION: 'location',
      CONTACT: 'contact',
    };
    const handler = mappedActions[item.actionType];
    if (!handler) {
      await context.reply(t(context, 'buttonUnavailable'));
      return;
    }
    await runAction(context, handler);
  }

  async function runBuiltInMenuButton(context, action) {
    const builtInKey = `builtin_${action}`;
    const result = await pool.query(`SELECT label_i18n AS labels,response_i18n AS responses,
      action_type AS "actionType",target_url AS "targetUrl",visibility,is_active AS "isActive"
      FROM telegram_menu_items WHERE item_key=$1 AND is_builtin=TRUE`, [builtInKey]);
    if (!result.rowCount) {
      await runAction(context, action);
      return;
    }
    const item = result.rows[0];
    const pressedLabel = context.message?.text?.trim();
    if (!item.isActive || localizedValue(item.labels, context.language) !== pressedLabel) {
      await context.reply(t(context, 'buttonUnavailable'), {
        reply_markup: await persistentMenu(context),
      });
      return;
    }
    await runConfiguredMenuItem(context, item);
  }

  instance.command('start', async (context) => {
    await preferenceFor(context);

    const token = typeof context.match === 'string'
      ? context.match.trim()
      : '';

    // A Telegram linking token is handled by the existing secure controller.
    if (!token) {
      await runAction(context, 'start');
      return;
    }

    if (!isPrivate(context)) {
      await context.reply(t(context, 'linkPrivate'));
      return;
    }

    try {
      const link = await completeTelegramLink(token, {
        telegramUserId: context.from?.id,
        chatId: context.chatId,
        username: context.from?.username,
        displayName: [
          context.from?.first_name,
          context.from?.last_name,
        ].filter(Boolean).join(' '),
      });

      await preferenceFor(context);

      if (link?.kind === 'followup') {
        await context.reply(
          link.welcomeStatus === 'DELIVERED'
            ? t(context, 'linkedFollowup')
            : t(context, 'linkedFollowupFailed'),
          { reply_markup: await persistentMenu(context) },
        );
        return;
      }

      await context.reply(
        t(context, 'linkedNote'),
        { reply_markup: await persistentMenu(context) },
      );

      await sendWelcomeCard(context, true);
    } catch (error) {
      await preferenceFor(context);

      if (error.status === 400 || error.status === 409) {
        const usedByDifferentChurchAccount = error.reason === 'church_account_in_use';
        let recoveryUrl = null;
        if (error.reason === 'telegram_account_in_use' && Number.isSafeInteger(Number(context.from?.id))) {
          const recoveryToken = randomBytes(32).toString('base64url');
          await createTelegramRecoveryToken(Number(context.from.id), createHash('sha256').update(recoveryToken).digest('hex'));
          const accountUrl = websiteUrl('/account');
          if (accountUrl) {
            const url = new URL(accountUrl);
            url.searchParams.set('telegramRecovery', recoveryToken);
            recoveryUrl = url.href;
          }
        }
        await context.reply(usedByDifferentChurchAccount
          ? t(context, 'linkChurchAccountAlreadyUsed')
          : error.reason === 'telegram_account_in_use'
            ? t(context, 'linkTelegramAccountInUse')
            : error.status === 409
              ? t(context, 'linkAlreadyUsed')
              : t(context, 'linkExpired'), {
          reply_markup: inlineKeyboard([
            ...(recoveryUrl
              ? [[{ text: t(context, 'telegramRecoveryButton'), url: recoveryUrl }]]
              : []),
            ...(usedByDifferentChurchAccount && websiteUrl('/account')
              ? [[{ text: t(context, 'profileSettings'), url: websiteUrl('/account') }]]
              : []),
            [{ text: t(context, 'back'), callback_data: 'menu:main' }],
          ]),
        });
        return;
      }

      throw error;
    }
  });

  const commands = {
    programs: 'programs',
    giving: 'giving',
    campaigns: 'campaigns',
    fundraising: 'campaigns',
    receipts: 'receipts',
    myreceipts: 'receipts',
    departments: 'departments',
    mydepartments: 'my_departments',
    bible: 'bible_studies',
    bible_studies: 'bible_studies',
    mybiblestudies: 'my_bible_studies',
    location: 'location',
    signup: 'signup',
    connect: 'connect',
    profile: 'profile',
    help: 'help',
    menu: 'menu',
    contact: 'contact',
    cancel: 'cancel',
    newchristian: 'newchristian',
    language: 'language',
    disconnect: 'telegram_disconnect',
  };

  for (const [command, action] of Object.entries(commands)) {
    instance.command(command, async (context) => {
      if (action === 'language') {
        await changeLanguage(context);
        return;
      }

      await runAction(context, action);
    });
  }

  for (const language of TELEGRAM_LANGUAGES) {
    for (const [key, action] of MENU_ITEMS) {
      instance.hears(
        telegramText(language, key),
        async (context) => runBuiltInMenuButton(context, action),
      );
    }

    instance.hears(
      telegramText(language, 'changeLanguage'),
      changeLanguage,
    );

    instance.hears(
      telegramText(language, 'back'),
      async (context) => runAction(context, 'menu'),
    );

    instance.hears(
      telegramText(language, 'cancel'),
      async (context) => runAction(context, 'cancel'),
    );
  }

  // Compatibility with the original English keyboard labels.
  const legacyLabels = {
    '📅 Programs & Events': 'programs',
    '🏦 Church Giving Accounts': 'giving',
    '🪙 Fundraising Campaigns': 'campaigns',
    '📜 My Verified Receipts': 'receipts',
    '✝️ Accept Jesus': 'newchristian',
    '👤 My Profile & Settings': 'profile',
    '❓ Help & Support': 'help',
  };

  for (const [label, action] of Object.entries(legacyLabels)) {
    instance.hears(label, async (context) => runBuiltInMenuButton(context, action));
  }

  instance.hears(
    /^(?:🔗\s*)?Connect My Account$/i,
    async (context) => runAction(context, 'connect'),
  );

  instance.on('callback_query', async (context) => {
    const action = context.callbackQuery?.data ?? '';

    await context.answerCallbackQuery();

    if (action === 'telegram:disconnect:confirm' || action === 'telegram:disconnect:prompt') {
      if (!isPrivate(context)) {
        await context.reply(t(context, 'buttonUnavailable'));
        return;
      }
      if (action === 'telegram:disconnect:prompt') {
        await context.reply(t(context, 'telegramDisconnectPrompt'), {
          reply_markup: inlineKeyboard([
            ...(websiteUrl('/account') ? [[{ text: t(context, 'telegramDisconnectConfirm'), url: websiteUrl('/account') }]] : []),
            [{ text: t(context, 'telegramDisconnectCancel'), callback_data: 'menu:main' }],
          ]),
        });
        return;
      }
      await context.reply(t(context, 'telegramRecoveryRequired'), {
        reply_markup: inlineKeyboard([
          ...(websiteUrl('/account') ? [[{ text: t(context, 'telegramConnectButton'), url: websiteUrl('/account') }]] : []),
          [{ text: t(context, 'back'), callback_data: 'menu:main' }],
        ]),
      });
      return;
    }

    const configuredMenuMatch = /^config-menu:(\d{1,19})$/.exec(action);
    if (configuredMenuMatch) {
      await preferenceFor(context);
      const item = await pool.query(`SELECT id,label_i18n AS labels,response_i18n AS responses,
        action_type AS "actionType",target_url AS "targetUrl",visibility
        FROM telegram_menu_items WHERE id=$1 AND is_active=TRUE`, [configuredMenuMatch[1]]);
      if (!item.rowCount || (item.rows[0].visibility === 'LINKED_MEMBER' && !await linkedMember(context))) {
        await context.reply(t(context, 'buttonUnavailable'));
        return;
      }
      await runConfiguredMenuItem(context, item.rows[0]);
      return;
    }

    const contactCategoryMatch = /^contact:category:([A-Z_]+)$/.exec(action);
    if (contactCategoryMatch) {
      const categoryCode = contactCategoryMatch[1];
      if (!CONTACT_CATEGORIES.some(([code]) => code === categoryCode) || !isPrivate(context)) {
        await context.reply(t(context, 'buttonUnavailable'));
        return;
      }
      await preferenceFor(context);
      await pool.query(`UPDATE telegram_accounts SET pending_action=$2,updated_at=NOW() WHERE telegram_user_id=$1`,
        [Number(context.from.id), `contact_message:${categoryCode}`]);
      await context.reply(t(context, 'contactWriteMessage'), {
        reply_markup: inlineKeyboard([[{ text: t(context, 'contactCancel'), callback_data: 'contact:cancel' }]]),
      });
      return;
    }

    if (action === 'contact:confirm' || action === 'contact:cancel') {
      await preferenceFor(context);
      if (!isPrivate(context)) {
        await context.reply(t(context, 'buttonUnavailable'));
        return;
      }
      if (action === 'contact:cancel') {
        await pool.query(`UPDATE telegram_messages SET status='CANCELLED' WHERE chat_id=$1 AND status='DRAFT'`, [String(context.chatId)]);
        await pool.query(`UPDATE telegram_accounts SET pending_action=NULL,updated_at=NOW() WHERE telegram_user_id=$1`, [Number(context.from.id)]);
        await context.reply(t(context, 'contactCancelled'), { reply_markup: await persistentMenu(context) });
        return;
      }
      let draft = await pool.query(`UPDATE telegram_messages SET status='NEW',
        reference_code=COALESCE(reference_code,'TG-' || id::text),contact_submitted_at=COALESCE(contact_submitted_at,NOW())
        WHERE id=(SELECT id FROM telegram_messages WHERE chat_id=$1 AND status='DRAFT' ORDER BY received_at DESC LIMIT 1)
        RETURNING id,reference_code`, [String(context.chatId)]);
      if (!draft.rowCount) {
        draft = await pool.query(`SELECT id,reference_code FROM telegram_messages
          WHERE chat_id=$1 AND contact_submitted_at >= NOW()-INTERVAL '15 minutes'
          ORDER BY contact_submitted_at DESC LIMIT 1`, [String(context.chatId)]);
        if (!draft.rowCount) {
          await context.reply(t(context, 'buttonUnavailable'));
          return;
        }
      } else {
        await pool.query(`INSERT INTO telegram_message_status_history(telegram_message_id,old_status,new_status)
          VALUES($1,'DRAFT','NEW')`, [draft.rows[0].id]);
      }
      await pool.query(`UPDATE telegram_accounts SET pending_action=NULL,updated_at=NOW() WHERE telegram_user_id=$1`, [Number(context.from.id)]);
      await context.reply(t(context, 'contactSent', { reference: draft.rows[0].reference_code }), {
        reply_markup: await persistentMenu(context),
      });
      return;
    }

    if (action === 'language:change') {
      await changeLanguage(context);
      return;
    }

    if (action.startsWith('language:')) {
      const language = action.slice('language:'.length);

      if (!TELEGRAM_LANGUAGES.includes(language)) {
        await context.reply(t(context, 'buttonUnavailable'));
        return;
      }

      const telegramUserId = Number(context.from.id);
      try {
        await pool.query(
          `UPDATE telegram_accounts
           SET language_code = $2,
               updated_at = NOW()
           WHERE telegram_user_id = $1`,
          [telegramUserId, language],
        );
      } catch (error) {
        if (!missingLanguageSchema(error)) throw error;
        warnMissingLanguageMigration();
      }

      sessionLanguages.set(telegramUserId, language);
      context.language = language;

      await context.reply(telegramText(language, 'languageChanged'), {
        reply_markup: await persistentMenu(context),
      });

      return;
    }

    if (action === 'menu:main') {
      await runAction(context, 'menu');
      return;
    }

    if (action.startsWith('menu:')) {
      const menuAction = action.slice('menu:'.length);
      await runAction(context, menuAction);
      return;
    }

    if (action === 'giving:submit') {
      await runAction(context, 'giving_submit');
      return;
    }

    if (action === 'group:my_departments') {
      await sendMyDepartments(context);
      return;
    }

    if (action === 'group:my_bible_studies') {
      await sendMyBibleStudies(context);
      return;
    }

    const groupDetailMatch = /^group:view:(department|bible):(\d{1,19})$/.exec(action);

    if (groupDetailMatch) {
      await preferenceFor(context);
      await sendGroupDetails(context, groupDetailMatch[1], groupDetailMatch[2]);
      return;
    }

    const campaignMatch = /^campaign:(\d{1,19})$/.exec(action);

    if (campaignMatch) {
      await preferenceFor(context);
      await sendCampaign(context, campaignMatch[1]);
      return;
    }

    await context.reply(t(context, 'buttonUnavailable'));
  });

  instance.hears(/^[\s\S]+$/, async (context) => {
    const incoming = context.message?.text?.trim() ?? '';

    if (!incoming || incoming.startsWith('/')) return;

    // Do not interpret arbitrary messages as commands or expose account data.
    // The user can always return to the persistent menu.
    const preference = await preferenceFor(context);

    if (isPrivate(context) && preference.pendingAction?.startsWith('contact_message:')) {
      if (incoming.length > 4000) {
        await context.reply(t(context, 'contactWriteMessage'));
        return;
      }
      const categoryCode = preference.pendingAction.slice('contact_message:'.length);
      const draft = await pool.query(`UPDATE telegram_messages SET status='DRAFT',category_code=$3,
        reference_code=COALESCE(reference_code,'TG-' || id::text)
        WHERE chat_id=$1 AND telegram_message_id=$2 RETURNING id,content,reference_code`,
      [String(context.chatId), Number(context.message?.message_id), categoryCode]);
      if (!draft.rowCount) throw new Error('Telegram contact draft message was not recorded.');
      await pool.query(`UPDATE telegram_accounts SET pending_action='contact_confirm',updated_at=NOW() WHERE telegram_user_id=$1`,
        [Number(context.from.id)]);
      await context.reply(t(context, 'contactReview', { message: draft.rows[0].content }), {
        reply_markup: inlineKeyboard([[
          { text: t(context, 'contactConfirm'), callback_data: 'contact:confirm' },
          { text: t(context, 'contactCancel'), callback_data: 'contact:cancel' },
        ]]),
      });
      return;
    }

    if (isPrivate(context) && preference.pendingAction === 'contact_confirm') {
      const draft = await pool.query(`SELECT content FROM telegram_messages
        WHERE chat_id=$1 AND status='DRAFT' ORDER BY received_at DESC LIMIT 1`, [String(context.chatId)]);
      if (draft.rowCount) {
        await context.reply(t(context, 'contactReview', { message: draft.rows[0].content }), {
          reply_markup: inlineKeyboard([[
            { text: t(context, 'contactConfirm'), callback_data: 'contact:confirm' },
            { text: t(context, 'contactCancel'), callback_data: 'contact:cancel' },
          ]]),
        });
        return;
      }
      await pool.query(`UPDATE telegram_accounts SET pending_action=NULL,updated_at=NOW() WHERE telegram_user_id=$1`, [Number(context.from.id)]);
    }

    if (isPrivate(context)) {
      const configuredItems = await pool.query(`SELECT label_i18n AS labels,response_i18n AS responses,
        action_type AS "actionType",target_url AS "targetUrl",visibility
        FROM telegram_menu_items WHERE is_active=TRUE ORDER BY sort_order,id LIMIT 100`);
      const configuredItem = configuredItems.rows.find((item) => localizedValue(item.labels, context.language) === incoming);
      if (configuredItem) {
        await runConfiguredMenuItem(context, configuredItem);
        return;
      }
      const result = await pool.query(`SELECT id,name,keywords,match_type AS "matchType",
        response_i18n AS responses,priority FROM telegram_auto_reply_rules
        WHERE is_active=TRUE ORDER BY priority,id LIMIT 200`);
      const match = findAutoReplyRule(result.rows, incoming);
      if (match) {
        await context.reply(localizedValue(match.responses, context.language));
        return;
      }
    }

    await context.reply(
      t(context, 'menuPrompt'),
      { reply_markup: await persistentMenu(context) },
    );
  });
}

function getBot() {
  if (!config.telegram.token) return null;
  if (bot) return bot;

  bot = new Bot(config.telegram.token);
  registerHandlers(bot);

  bot.catch(async (error, context) => {
    console.error(
      '[telegram-bot] Update failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    if (!context?.chatId) return;

    try {
      await preferenceFor(context);

      await context.reply(
        t(context, 'error'),
        { reply_markup: await persistentMenu(context) },
      );
    } catch (replyError) {
      console.error(
        '[telegram-bot] Error notification failed:',
        replyError instanceof Error ? replyError.message : 'Unknown error',
      );
    }
  });

  return bot;
}

export async function handleTelegramUpdate(update) {
  const instance = getBot();

  if (!instance) return false;

  await instance.handleUpdate(update);
  return true;
}

export function startTelegramBot() {
  if (!config.telegram.token) {
    console.info(
      '[telegram-bot] Disabled: TELEGRAM_BOT_TOKEN is not configured.',
    );
    return null;
  }

  const instance = getBot();
  if (botStarted || pollingStarting) return instance;

  if (config.telegramWebhookUrl) {
    botStarted = true;
    console.info(
      '[telegram-bot] Webhook mode is configured; polling is disabled.',
    );
    return instance;
  }

  stopping = false;
  pollingStarting = true;
  void (async () => {
    let lockClient;
    try {
      lockClient = await pool.connect();
      const lock = await lockClient.query(
        'SELECT pg_try_advisory_lock($1::bigint) AS acquired',
        [TELEGRAM_POLLING_LOCK_ID],
      );
      if (!lock.rows[0]?.acquired || stopping) {
        if (lock.rows[0]?.acquired) {
          await lockClient.query('SELECT pg_advisory_unlock($1::bigint)', [TELEGRAM_POLLING_LOCK_ID]);
        } else {
          console.info('[telegram-bot] Polling is already active in another application instance.');
        }
        lockClient.release();
        return;
      }
      pollingClient = lockClient;
      botStarted = true;
      void instance.startPolling(undefined, {
        timeout: 30,
        retry: true,
        retryDelayMs: 1500,
        onError: (error) => {
          console.error(
            '[telegram-bot] Polling temporarily failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        },
      }).catch(async (error) => {
        console.error('[telegram-bot] Polling stopped:', error.message);
        botStarted = false;
        await releasePollingLock();
      });
      console.info('[telegram-bot] Church Assistant is running.');
    } catch (error) {
      console.error('[telegram-bot] Polling could not start:', error.message);
      botStarted = false;
      if (lockClient === pollingClient) await releasePollingLock();
      else if (lockClient) lockClient.release();
    } finally {
      pollingStarting = false;
    }
  })();

  return instance;
}

async function releasePollingLock() {
  if (!pollingClient) return;
  const client = pollingClient;
  pollingClient = undefined;
  try {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [TELEGRAM_POLLING_LOCK_ID]);
  } catch (error) {
    console.error('[telegram-bot] Polling lock release failed:', error.message);
  } finally {
    client.release();
  }
}

export async function stopTelegramBot() {
  stopping = true;
  if (bot) bot.stop();
  bot = null;
  botStarted = false;
  await releasePollingLock();
}
