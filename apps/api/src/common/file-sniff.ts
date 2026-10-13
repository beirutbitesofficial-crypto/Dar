/**
 * Detects a file's real type from its first bytes. Uploads are accepted only
 * when the detected type is allowed — the client-declared MIME type and file
 * extension are not trusted.
 */
export type SniffedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'application/pdf'
  | 'video/mp4'
  | 'video/quicktime'
  | null;

export function sniffMime(buf: Uint8Array): SniffedType {
  const at = (i: number) => buf[i] ?? -1;
  const ascii = (start: number, len: number) => String.fromCharCode(...Array.from(buf.subarray(start, start + len)));
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x89 && ascii(1, 3) === 'PNG' && at(4) === 0x0d && at(5) === 0x0a) return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1', 'hevc'].includes(brand)) return 'image/heic';
    if (brand === 'qt  ') return 'video/quicktime';
    if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'mmp4'].includes(brand)) return 'video/mp4';
  }
  return null;
}

/** HEIC and HEIF share the same container; treat them as equivalent declarations. */
export function declaredMatches(declared: string, sniffed: SniffedType): boolean {
  if (!sniffed) return false;
  if (sniffed === 'image/heic') return declared === 'image/heic' || declared === 'image/heif';
  return declared === sniffed;
}
