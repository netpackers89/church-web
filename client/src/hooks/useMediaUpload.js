import { useCallback, useState } from 'react';
import { contentService } from '../services/index.js';

/**
 * Max file size for image uploads (5 MB), kept in sync with the backend
 * multer limit and imgbbService.MAX_IMAGE_BYTES.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * MIME types accepted for image uploads. Treated as the source of truth on
 * the client so the same validation runs before the request is sent.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Reusable upload lifecycle for banner, flyer, campaign, and announcement
 * images. Upload state is kept separate from the surrounding form state so
 * the form can be edited (title, status, categories) without racing the file
 * upload. Duplicate submissions are prevented while an upload is running and
 * the same file is never uploaded twice.
 */
export function useMediaUpload({ mediaType = 'BANNER', title, isThumbnail, onDraft, onPublish }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [uploadedIdentity, setUploadedIdentity] = useState('');
  const [uploadedAsset, setUploadedAsset] = useState(null);

  const clearPreview = useCallback(() => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setFile(null);
    setUploadedUrl('');
    setUploadedIdentity('');
    setUploadedAsset(null);
    setUploadProgress(0);
  }, [previewUrl]);

  /**
   * Select a file: validates type and size client-side and stores it without
   * uploading yet. Returns the validation outcome so callers can show messages.
   */
  const selectFile = useCallback(
    (inputFile) => {
      if (!inputFile) return { ok: false, reason: 'no-file' };
      if (!ALLOWED_IMAGE_TYPES.includes(inputFile.type)) {
        setError('Choose a JPG, PNG, WebP, or GIF image.');
        return { ok: false, reason: 'invalid-type' };
      }
      if (inputFile.size <= 0 || inputFile.size > MAX_UPLOAD_BYTES) {
        setError('Image size must be between 1 byte and 5 MB.');
        return { ok: false, reason: 'invalid-size' };
      }
      setError('');
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      const preview = URL.createObjectURL(inputFile);
      setPreviewUrl(preview);
      setFile(inputFile);
      setUploadedUrl('');
      setUploadedIdentity('');
      setUploadedAsset(null);
      return { ok: true };
    },
    [previewUrl],
  );

  /** Remove the selected image and its preview. */
  const removeFile = useCallback(() => clearPreview(), [clearPreview]);

  /**
   * Upload the selected file to the server image endpoint (which forwards it
   * to ImgBB and returns the public URL). Returns the public URL on success.
   */
  const upload = useCallback(async () => {
    if (!file) return { ok: false, reason: 'no-file' };
    if (uploading) return { ok: false, reason: 'uploading' };

    const identity = `${file.name}|${file.size}|${file.type}`;
    if (identity === uploadedIdentity && uploadedUrl) {
      return { ok: true, ...uploadedAsset };
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    try {
      const result = await contentService.uploadImage(file, {
        mediaType,
        title,
        isThumbnail,
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      const data = result?.data?.data ?? result?.data ?? {};
      const nextUrl =
        data.url ||
        data.imageUrl ||
        '';
      if (!nextUrl || !data.storageId || !data.mediaId && !data.id) {
        throw new Error('The storage service did not confirm a permanent image URL and storage ID.');
      }
      const asset = {
        url: nextUrl,
        storageId: data.storageId,
        storageProvider: data.storageProvider || 'imgbb',
        mediaId: data.mediaId || data.id,
      };
      setUploadedUrl(nextUrl);
      setUploadedIdentity(identity);
      setUploadedAsset(asset);
      setUploadProgress(100);
      return { ok: true, ...asset };
    } catch (reason_) {
      const message =
        reason_.response?.data?.error ||
        reason_.message ||
        'The image could not be uploaded.';
      setError(message);
      return { ok: false, reason: 'upload-failed', message };
    } finally {
      setUploading(false);
    }
  }, [file, uploading, uploadedIdentity, uploadedUrl, uploadedAsset, mediaType, title, isThumbnail]);

  return {
    file,
    previewUrl,
    uploading,
    error,
    uploadedUrl,
    uploadedAsset,
    uploadProgress,
    selectFile,
    removeFile,
    upload,
    clearPreview,
  };
}
