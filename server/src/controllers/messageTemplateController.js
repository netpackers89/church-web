import { pool } from "../config/db.js";
import { config } from "../config/env.js";
import {
  renderEmailHtml,
  renderTemplateVariables,
} from "../services/notificationStudioService.js";
import { isSafeImageUrl } from "../services/imgbbService.js";

const TEMPLATE_CATEGORIES = new Set([
  "WELCOME",
  "SUNDAY_SERVICE",
  "CONFERENCE",
  "CAMPAIGN",
  "FUNDRAISING",
  "ANNOUNCEMENT",
  "REGULAR_PROGRAM",
  "NEW_EVENT",
  "GENERAL",
  "NEW_CHRISTIAN_FOLLOW_UP",
  "OTHER",
]);

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function optionalText(value, name, limit) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > limit)
    throw fail(`${name} must be no longer than ${limit} characters.`);
  return value.trim();
}

function normalizeTemplate(body = {}) {
  const code =
    typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(code))
    throw fail(
      "Template key must use lowercase letters, numbers, and underscores.",
    );
  const category =
    typeof body.category === "string" ? body.category.trim().toUpperCase() : "";
  if (!TEMPLATE_CATEGORIES.has(category))
    throw fail("Select a supported template category.");
  const channel = typeof body.channel === "string" ? body.channel.trim().toUpperCase() : "EMAIL";
  if (!["EMAIL", "TELEGRAM", "BOTH"].includes(channel))
    throw fail("Select EMAIL, TELEGRAM, or BOTH for the template channel.");
  const name = optionalText(body.name, "Template name", 150);
  const title = optionalText(body.title, "Title", 200);
  const subject = optionalText(body.subject, "Email subject", 255);
  const messageBody = optionalText(body.body, "Message body", 12000);
  if (!name || !title || !subject || !messageBody)
    throw fail("Name, title, subject, and message body are required.");
  const bannerUrl = optionalText(body.bannerUrl, "Banner URL", 1000);
  if (bannerUrl && !isSafeImageUrl(bannerUrl, config.mediaAllowedHosts))
    throw fail("Use an HTTPS image URL from configured media storage.");
  const ctaUrl = optionalText(body.ctaUrl, "Button URL", 1000);
  if (ctaUrl) {
    try {
      if (new URL(ctaUrl).protocol !== "https:") throw new Error();
    } catch {
      throw fail("Button URL must be a valid HTTPS URL.");
    }
  }
  return {
    code,
    channel,
    name,
    category,
    title,
    subject,
    body: messageBody,
    greeting: optionalText(body.greeting, "Greeting", 300),
    signature: optionalText(body.signature, "Signature", 500),
    bannerUrl,
    ctaUrl,
    ctaLabel: optionalText(body.ctaLabel, "Button label", 80),
    isArchived: body.isArchived === true,
  };
}

const TEMPLATE_SELECT = `SELECT id,code,channel,subject_template AS "subjectTemplate",body_template AS "bodyTemplate",
  category,title,greeting,signature,banner_url AS "bannerUrl",cta_url AS "ctaUrl",cta_label AS "ctaLabel",
  is_archived AS "isArchived",updated_at AS "updatedAt" FROM notification_templates`;

function toTemplate(row) {
  return {
    id: String(row.id),
    code: row.code,
    channel: row.channel,
    name: row.title || row.code,
    category: row.category,
    title: row.title,
    subject: row.subjectTemplate,
    greeting: row.greeting,
    body: row.bodyTemplate,
    signature: row.signature,
    bannerUrl: row.bannerUrl,
    ctaUrl: row.ctaUrl,
    ctaLabel: row.ctaLabel,
    isArchived: row.isArchived,
    updatedAt: row.updatedAt,
  };
}

export async function listEmailTemplates(_request, response) {
  try {
    const result = await pool.query(
      `${TEMPLATE_SELECT} ORDER BY is_archived,category,title,code`,
    );
    return response.json({ success: true, data: result.rows.map(toTemplate) });
  } catch (error) {
    return templateError(response, error);
  }
}

export async function createEmailTemplate(request, response) {
  try {
    const template = normalizeTemplate(request.body);
    const result = await pool.query(
      `INSERT INTO notification_templates
      (code,channel,subject_template,body_template,category,title,greeting,signature,banner_url,cta_url,cta_label,is_archived,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id,code,channel,subject_template AS "subjectTemplate",body_template AS "bodyTemplate",category,title,greeting,signature,banner_url AS "bannerUrl",cta_url AS "ctaUrl",cta_label AS "ctaLabel",is_archived AS "isArchived",updated_at AS "updatedAt"`,
      [
        template.code,
        template.channel,
        template.subject,
        template.body,
        template.category,
        template.title,
        template.greeting,
        template.signature,
        template.bannerUrl,
        template.ctaUrl,
        template.ctaLabel,
        template.isArchived,
        request.user.id,
      ],
    );
    return response
      .status(201)
      .json({ success: true, data: toTemplate(result.rows[0]) });
  } catch (error) {
    return templateError(response, error);
  }
}

export async function updateEmailTemplate(request, response) {
  try {
    const template = normalizeTemplate(request.body);
    const result = await pool.query(
      `UPDATE notification_templates SET code=$2,channel=$3,subject_template=$4,body_template=$5,category=$6,
      title=$7,greeting=$8,signature=$9,banner_url=$10,cta_url=$11,cta_label=$12,is_archived=$13,updated_by=$14,updated_at=NOW()
      WHERE id=$1
      RETURNING id,code,channel,subject_template AS "subjectTemplate",body_template AS "bodyTemplate",category,title,greeting,signature,banner_url AS "bannerUrl",cta_url AS "ctaUrl",cta_label AS "ctaLabel",is_archived AS "isArchived",updated_at AS "updatedAt"`,
      [
        request.params.id,
        template.code,
        template.channel,
        template.subject,
        template.body,
        template.category,
        template.title,
        template.greeting,
        template.signature,
        template.bannerUrl,
        template.ctaUrl,
        template.ctaLabel,
        template.isArchived,
        request.user.id,
      ],
    );
    if (!result.rowCount) throw fail("Email template was not found.", 404);
    return response.json({ success: true, data: toTemplate(result.rows[0]) });
  } catch (error) {
    return templateError(response, error);
  }
}

export function previewEmailTemplate(request, response) {
  try {
    const template = normalizeTemplate({
      ...request.body,
      code: request.body?.code || "preview_email",
      name: request.body?.name || "Preview",
    });
    const sample = {
      firstName: "Amanuel",
      name: "Amanuel Desta",
      churchName: config.branding.churchName,
      eventDate: "Sunday, October 25",
      eventTime: "10:00 AM",
      eventLocation: config.branding.churchName,
    };
    const rendered = Object.fromEntries(
      [
        "subject",
        "title",
        "greeting",
        "body",
        "signature",
        "bannerUrl",
        "ctaUrl",
        "ctaLabel",
      ].map((key) => [
        key,
        renderTemplateVariables(template[key] ?? "", sample),
      ]),
    );
    const html = renderEmailHtml({
      greeting: rendered.greeting,
      subject: rendered.title,
      body: rendered.body,
      signature: rendered.signature,
      bannerUrl: rendered.bannerUrl,
      ctaUrl: rendered.ctaUrl,
      ctaLabel: rendered.ctaLabel,
    });
    return response.json({ success: true, data: { ...rendered, html } });
  } catch (error) {
    return templateError(response, error);
  }
}

function templateError(response, error) {
  if (error.status)
    return response.status(error.status).json({ error: error.message });
  if (error.code === "23505")
    return response
      .status(409)
      .json({ error: "A template with this key already exists." });
  console.error("[message-templates] request failed:", error.message);
  return response
    .status(503)
    .json({ error: "Message templates are temporarily unavailable." });
}
