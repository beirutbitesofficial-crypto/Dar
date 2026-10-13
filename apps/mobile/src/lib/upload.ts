import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { UPLOAD_LIMITS } from '@dar/shared';
import { ApiError, post } from './api';

/**
 * Upload pipeline used by the listing wizard:
 *   compress (max 2560px, JPEG 0.8 — also drops most metadata on device)
 *   → ask the API for a signed URL → upload with progress → server completes,
 *     verifies the real file type and strips all remaining metadata.
 * Each step can be retried independently.
 */
export type UploadKind = 'PHOTO' | 'DOCUMENT' | 'VIDEO' | 'MESSAGE_ATTACHMENT';

export interface LocalAsset {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
}

export async function compressPhoto(asset: LocalAsset): Promise<LocalAsset> {
  const max = 2560;
  const resize = asset.width && asset.height && Math.max(asset.width, asset.height) > max ? [{ resize: asset.width! >= asset.height! ? { width: max } : { height: max } }] : [];
  const out = await ImageManipulator.manipulateAsync(asset.uri, resize, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  const info = await FileSystem.getInfoAsync(out.uri);
  return { uri: out.uri, mimeType: 'image/jpeg', fileName: (asset.fileName ?? 'photo').replace(/\.\w+$/, '') + '.jpg', fileSize: info.exists ? info.size : null, width: out.width, height: out.height };
}

export async function uploadAsset(
  kind: UploadKind,
  asset: LocalAsset,
  target: { propertyId?: string; conversationId?: string },
  onProgress: (fraction: number) => void,
): Promise<{ id: string; url: string | null; isCover: boolean }> {
  const prepared = kind === 'PHOTO' || (kind === 'MESSAGE_ATTACHMENT' && asset.mimeType?.startsWith('image/')) ? await compressPhoto(asset) : asset;
  const size = prepared.fileSize ?? ((await FileSystem.getInfoAsync(prepared.uri)) as any).size ?? 0;
  const limits = UPLOAD_LIMITS[kind];
  const mime = prepared.mimeType ?? 'application/octet-stream';
  if (!(limits.mime as readonly string[]).includes(mime)) throw new ApiError(400, 'UPLOAD_TYPE', 'Type');
  if (size > limits.maxBytes) throw new ApiError(400, 'UPLOAD_TOO_LARGE', 'Size');

  const intent = await post<{ mediaId: string; uploadUrl: string; headers: Record<string, string> }>('/v1/uploads', {
    kind,
    mimeType: mime,
    sizeBytes: size,
    fileName: prepared.fileName ?? 'file',
    ...target,
  });
  const task = FileSystem.createUploadTask(
    intent.uploadUrl,
    prepared.uri,
    { httpMethod: 'PUT', headers: intent.headers, uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT },
    (p) => p.totalBytesExpectedToSend > 0 && onProgress(p.totalBytesSent / p.totalBytesExpectedToSend),
  );
  const res = await task.uploadAsync();
  if (!res || res.status >= 300) throw new ApiError(res?.status ?? 0, 'UPLOAD_FAILED', 'Upload failed');
  onProgress(1);
  return post(`/v1/uploads/${intent.mediaId}/complete`);
}
