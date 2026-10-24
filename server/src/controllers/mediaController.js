import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { requestError, requiredString } from '../utils/http.js';
import { isSafeImageUrl, uploadImageToImgbb, validateImageFile } from '../services/imgbbService.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = resolve(currentDirectory, '../../public/uploads');

const VALID_MEDIA_TYPES = new Set(['BANNER', 'FLYER', 'ANNOUNCEMENT', 'CAMPAIGN', 'GALLERY', 'SERMON', 'EVENT', 'IMAGE', 'LOGO', 'PROFILE', 'DOCUMENT']);

function normalizeMediaType(value) {
  const type = typeof value === 'string' ? value.trim().toUpperCase() : 'IMAGE';
  if (!VALID_MEDIA_TYPES.has(type)) {
    return 'IMAGE';
  }
  return type;
}

function normalizeMediaUrl(value) {
  const imageUrl = typeof value === 'string' ? value.trim() : '';
  if (!isSafeImageUrl(imageUrl, config.mediaAllowedHosts)) {
    throw Object.assign(new Error('Use a valid image URL from an approved media host or storage.'), { status: 400 });
  }
  return imageUrl;
}

async function saveFileLocally(file) {
  await mkdir(uploadsDirectory, { recursive: true });
  const ext = (file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : file.mimetype === 'image/gif' ? '.gif' : '.jpg') || extname(file.originalname || '') || '.jpg';
  const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  const filePath = resolve(uploadsDirectory, filename);
  await writeFile(filePath, Buffer.from(file.buffer || file));
  const publicUrl = `/uploads/${filename}`;
  return { url: publicUrl, storageId: filename, storageProvider: 'local' };
}

export async function uploadMedia(request, response) {
  try {
    if (!request.file) {
      throw Object.assign(new Error('Select an image file to upload.'), { status: 400 });
    }
    validateImageFile(request.file);

    let uploaded = null;
    if (config.imgbbApiKey && config.imgbbApiKey.trim()) {
      try {
        const imgbbResult = await uploadImageToImgbb(request.file, config.imgbbApiKey, config.mediaAllowedHosts);
        uploaded = { ...imgbbResult, storageProvider: 'imgbb' };
      } catch (imgbbError) {
        console.warn('[media] ImgBB upload failed, falling back to local persistent storage:', imgbbError.message);
      }
    }

    if (!uploaded) {
      uploaded = await saveFileLocally(request.file);
    }

    const type = normalizeMediaType(request.body?.type);
    const title = requiredString(request.body?.title || request.file.originalname?.replace(/\.[^.]+$/, '') || 'Uploaded Image', 'Title', 200);
    const isThumbnail = request.body?.isThumbnail === 'true';
    const result = await pool.query(
      `INSERT INTO media_items(type, title, media_url, thumbnail_url, storage_provider, storage_id, is_thumbnail, is_public, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, CASE WHEN $6 THEN $3 ELSE NULL END, $4, $5, $6, FALSE, $7, NOW(), NOW())
       RETURNING id, media_url AS "mediaUrl", storage_provider AS "storageProvider", storage_id AS "storageId",
       thumbnail_url AS "thumbnailUrl", is_thumbnail AS "isThumbnail"`,
      [type, title, uploaded.url, uploaded.storageProvider, uploaded.storageId, isThumbnail, request.user.id],
    );
    return response.status(201).json({ success: true, data: { ...result.rows[0], url: uploaded.url, imageUrl: uploaded.url } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function createMedia(request, response) {
  try {
    const body = request.body ?? {};
    const type = normalizeMediaType(body.type);
    const title = requiredString(body.title ?? '', 'Title', 200);
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : null;
    const mediaUrl = normalizeMediaUrl(body.mediaUrl ?? body.imageUrl ?? '');
    const isPublic = body.isPublic !== false && body.status !== 'DRAFT';
    const publishedAt = isPublic ? (body.publishedAt ? new Date(body.publishedAt) : new Date()) : null;
    const thumbnailUrl = body.thumbnailUrl ? normalizeMediaUrl(body.thumbnailUrl) : null;
    const mediaId = Number(body.mediaId);
    if (Number.isSafeInteger(mediaId) && mediaId > 0) {
      const updated = await pool.query(
        `UPDATE media_items SET type = $2, title = $3, description = $4, media_url = $5, thumbnail_url = $6,
         is_thumbnail = $7, is_public = $8, published_at = $9, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL AND created_by = $10
         RETURNING id, type, title, description, media_url AS "mediaUrl", thumbnail_url AS "thumbnailUrl",
         storage_provider AS "storageProvider", storage_id AS "storageId", is_thumbnail AS "isThumbnail",
         is_public AS "isPublic", published_at AS "publishedAt", created_by AS "createdBy"`,
        [mediaId, type, title, description, mediaUrl, thumbnailUrl, Boolean(body.isThumbnail), isPublic, publishedAt, request.user.id],
      );
      if (!updated.rowCount) return response.status(404).json({ error: 'Uploaded media item was not found.' });
      return response.status(200).json({ success: true, data: updated.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO media_items(type, title, description, media_url, thumbnail_url, is_thumbnail, is_public, published_at, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, type, title, description, media_url AS "mediaUrl", thumbnail_url AS "thumbnailUrl",
       is_thumbnail AS "isThumbnail", is_public AS "isPublic", published_at AS "publishedAt", created_by AS "createdBy"`,
      [type, title, description, mediaUrl, thumbnailUrl, Boolean(body.isThumbnail), isPublic, publishedAt, request.user.id],
    );

    return response.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function updateMedia(request, response) {
  try {
    const body = request.body ?? {};
    const fields = [];
    const values = [request.params.id];
    let index = 2;

    if (body.title !== undefined) {
      fields.push(`title = $${index++}`);
      values.push(requiredString(body.title, 'Title', 200));
    }
    if (body.type !== undefined) {
      fields.push(`type = $${index++}`);
      values.push(normalizeMediaType(body.type));
    }
    if (body.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : null);
    }
    if (body.mediaUrl !== undefined || body.imageUrl !== undefined) {
      fields.push(`media_url = $${index++}`);
      values.push(normalizeMediaUrl(body.mediaUrl ?? body.imageUrl));
    }
    if (body.thumbnailUrl !== undefined) {
      fields.push(`thumbnail_url = $${index++}`);
      values.push(body.thumbnailUrl ? normalizeMediaUrl(body.thumbnailUrl) : null);
    }
    if (body.isThumbnail !== undefined) {
      fields.push(`is_thumbnail = $${index++}`);
      values.push(Boolean(body.isThumbnail));
    }
    if (body.isPublic !== undefined) {
      fields.push(`is_public = $${index++}`);
      values.push(Boolean(body.isPublic));
    }
    if (body.status !== undefined) {
      const nextStatus = String(body.status).toUpperCase();
      const isPublished = nextStatus === 'PUBLISHED';
      fields.push(`is_public = $${index++}`);
      values.push(isPublished);
      if (isPublished) {
        fields.push(`published_at = COALESCE(published_at, NOW())`);
      }
    }

    if (!fields.length) {
      return response.status(400).json({ error: 'No media update fields were supplied.' });
    }

    fields.push('updated_at = NOW()');
    const result = await pool.query(
      `UPDATE media_items SET ${fields.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING id, type, title, description, media_url AS "mediaUrl", thumbnail_url AS "thumbnailUrl", is_public AS "isPublic", published_at AS "publishedAt"`,
      values,
    );

    if (!result.rowCount) {
      return response.status(404).json({ error: 'Media item was not found.' });
    }

    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function deleteMedia(request, response) {
  try {
    const result = await pool.query(
      `UPDATE media_items SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [request.params.id],
    );
    if (!result.rowCount) {
      return response.status(404).json({ error: 'Media item was not found.' });
    }
    return response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listMedia(request, response) {
  try {
    const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 100);
    const page = Math.max(Number(request.query?.page) || 1, 1);
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT id, type, title, description, media_url AS "mediaUrl", thumbnail_url AS "thumbnailUrl",
       storage_provider AS "storageProvider", storage_id AS "storageId", is_thumbnail AS "isThumbnail",
       is_public AS "isPublic", published_at AS "publishedAt", created_by AS "createdBy"
       FROM media_items
       WHERE deleted_at IS NULL
       ORDER BY published_at DESC NULLS LAST, id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}
