/** Original upload limit (phone photos are ~2-12 MB). Crops sent to the API are much smaller. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export const ACCEPT_ATTRIBUTE =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';

export function isHeic(file: Pick<File, 'name' | 'type'>): boolean {
  return /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Returns a user-facing error, or null when the file can be loaded. */
export function checkUploadFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_BYTES)
    return `That file is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  const known = (ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(
    file.type.toLowerCase(),
  );
  const byExtension = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!known && !(file.type === '' && byExtension))
    return 'Unsupported file type. Use a JPG, PNG, WebP, or HEIC photo.';
  return null;
}
