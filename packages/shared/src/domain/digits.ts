/**
 * Converts Arabic-Indic (٠-٩) and Extended Arabic-Indic / Persian (۰-۹) digits
 * to ASCII 0-9. Everything else is left untouched.
 */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (code >= 0xff10 && code <= 0xff19) out += String(code - 0xff10); // full-width digits
    else out += ch;
  }
  return out;
}
