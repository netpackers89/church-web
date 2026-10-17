const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function validateImageFile(file) {
  if (!file) {
    throw Object.assign(new Error('Select an image file to upload.'), { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    throw Object.assign(new Error('Only JPG, PNG, WebP, and GIF image files are allowed.'), { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Image size must be between 1 byte and 5 MB.'), { status: 400 });
  }
  const bytes = file.buffer ? Buffer.from(file.buffer) : Buffer.from(file);
  const signatureMatches = {
    'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/gif': ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii')),
    'image/webp': bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  if (!signatureMatches[file.mimetype]) {
    throw Object.assign(new Error('The file contents do not match the selected image type.'), { status: 400 });
  }
  return file;
}

export function isSafeImageUrl(value, allowedHosts = ['i.ibb.co']) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.toLowerCase();
    const hostAllowed = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    return hostAllowed && /\.(png|jpe?g|webp|gif)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export async function uploadImageToImgbb(file, apiKey, allowedHosts = ['i.ibb.co']) {
  const validFile = validateImageFile(file);
  if (!apiKey || !apiKey.trim()) {
    throw Object.assign(new Error('The ImgBB API key is not configured on the server.'), { status: 500 });
  }

  const formData = new FormData();
  formData.append('key', apiKey.trim());
  formData.append('image', Buffer.from(validFile.buffer || validFile).toString('base64'));

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.data?.url || !payload?.data?.id) {
    throw Object.assign(new Error(payload?.data?.error?.message || 'Image upload failed while contacting ImgBB.'), { status: 502 });
  }

  if (!isSafeImageUrl(payload.data.url, allowedHosts)) {
    throw Object.assign(new Error('The image provider returned an unsupported image URL.'), { status: 502 });
  }
  return { url: payload.data.url, storageId: String(payload.data.id) };
}
