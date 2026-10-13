import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declaredMatches, sniffMime } from '../../src/common/file-sniff';
import { csvCell, toCsv } from '../../src/common/csv';

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));

test('upload type is detected from file bytes, not from the name or declared type', () => {
  assert.equal(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), 'image/jpeg');
  assert.equal(sniffMime(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(sniffMime(bytes('RIFF', 0, 0, 0, 0, 'WEBP')), 'image/webp');
  assert.equal(sniffMime(bytes('%PDF-1.7')), 'application/pdf');
  assert.equal(sniffMime(bytes(0, 0, 0, 0x18, 'ftyp', 'heic')), 'image/heic');
  assert.equal(sniffMime(bytes(0, 0, 0, 0x18, 'ftyp', 'isom')), 'video/mp4');
  assert.equal(sniffMime(bytes(0, 0, 0, 0x14, 'ftyp', 'qt  ')), 'video/quicktime');
  assert.equal(sniffMime(bytes('<html><script>')), null, 'HTML disguised as an image is rejected');
  assert.equal(sniffMime(bytes('MZ', 0x90, 0)), null, 'executables are rejected');
  assert.equal(sniffMime(new Uint8Array()), null);
});

test('declared type must match the detected type', () => {
  assert.equal(declaredMatches('image/jpeg', 'image/jpeg'), true);
  assert.equal(declaredMatches('image/png', 'image/jpeg'), false);
  assert.equal(declaredMatches('image/heif', 'image/heic'), true);
  assert.equal(declaredMatches('application/pdf', null), false);
});

test('CSV export escapes quotes/newlines and neutralizes formula injection', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+961 71 123 456'), "'+961 71 123 456");
  assert.equal(csvCell('-25.00'), '-25.00', 'negative amounts stay numeric');
  assert.equal(csvCell('-2+3'), "'-2+3");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(null), '');
  const csv = toCsv(['a', 'b'], [['شقة', 1]]);
  assert.ok(csv.startsWith('﻿'), 'BOM for Arabic in Excel');
  assert.equal(csv.slice(1), 'a,b\r\nشقة,1');
});
