import { environment } from '../../environments/environment';

/** Avatar paths come from the API ("/api/avatars/<token>"); make them absolute for <img>. */
export function avatarSrc(path?: string | null): string | null {
  return path ? `${environment.apiUrl}${path}` : null;
}

export function initialsOf(name?: string | null): string {
  return (name || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

/** Resize to a 512px square JPEG in the browser: smaller upload, and HEIC/large photos become JPEG first. */
export async function toSquareJpeg(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return await new Promise<Blob>((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('encode'))), 'image/jpeg', 0.88));
}
