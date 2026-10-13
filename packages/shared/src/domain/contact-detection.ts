import { normalizeDigits } from './digits';

/**
 * Flags contact information hidden in listing text for MODERATION. It assists
 * reviewers; it does not and cannot guarantee detection. A human approves
 * every listing before publication.
 */
export type ContactFindingType = 'PHONE' | 'EMAIL' | 'URL' | 'WHATSAPP' | 'SOCIAL' | 'SPELLED_DIGITS' | 'HANDLE';
export type Confidence = 'high' | 'medium' | 'low';

export interface ContactFinding {
  type: ContactFindingType;
  match: string;
  confidence: Confidence;
}

const ZERO_WIDTH = /[​-‏‪-‮⁠-⁤﻿ـ]/g; // incl. tatweel

/** Canonical form used before matching: digits → ASCII, zero-width/tatweel removed, lowercase. */
export function normalizeForDetection(text: string): string {
  return normalizeDigits(text).replace(ZERO_WIDTH, '').normalize('NFKC').toLowerCase();
}

// Digit words (Arabic incl. common Lebanese spellings, and English) → digit.
const DIGIT_WORDS: Record<string, string> = {
  'صفر': '0', 'واحد': '1', 'وحدة': '1', 'اثنين': '2', 'إثنين': '2', 'تنين': '2', 'اتنين': '2',
  'ثلاثة': '3', 'تلاتة': '3', 'تلاته': '3', 'ثلاث': '3', 'اربعة': '4', 'أربعة': '4', 'اربعه': '4', 'أربع': '4',
  'خمسة': '5', 'خمسه': '5', 'خمس': '5', 'ستة': '6', 'سته': '6', 'ست': '6', 'سبعة': '7', 'سبعه': '7', 'سبع': '7',
  'ثمانية': '8', 'تمانية': '8', 'تمانيه': '8', 'ثمان': '8', 'تسعة': '9', 'تسعه': '9', 'تسع': '9',
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

// Lebanese numbers after optional +961/00961/961: mobiles 3xxxxxx, 7[0169]xxxxxx, 81xxxxxx; landlines [1-9]xxxxxx.
const LB_MOBILE = /^(?:00961|961)?0?(?:3\d{6}|7[016-9]\d{6}|8[1]\d{6})$/;

export function detectContactInfo(raw: string): ContactFinding[] {
  const text = normalizeForDetection(raw);
  const findings: ContactFinding[] = [];
  const push = (f: ContactFinding) => {
    if (!findings.some((x) => x.type === f.type && x.match === f.match)) findings.push(f);
  };

  // Emails, including "name at gmail dot com" and Arabic "ات".
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)) push({ type: 'EMAIL', match: m[0], confidence: 'high' });
  for (const m of text.matchAll(/[a-z0-9._-]+\s*(?:\(at\)|\[at\]| at |@|ات)\s*[a-z0-9-]+\s*(?:\(dot\)|\[dot\]| dot |\.|دوت)\s*(?:com|net|org|lb)\b/g)) {
    push({ type: 'EMAIL', match: m[0].trim(), confidence: 'medium' });
  }
  if (/\b(gmail|hotmail|yahoo|outlook|icloud)\b/.test(text)) push({ type: 'EMAIL', match: 'email provider mentioned', confidence: 'low' });

  // Links and messaging/social apps.
  for (const m of text.matchAll(/\b(?:https?:\/\/|www\.)\S+/g)) push({ type: 'URL', match: m[0], confidence: 'high' });
  for (const m of text.matchAll(/\b[a-z0-9-]+\.(?:com|net|org|lb|me|io|app|link)(?:\/\S*)?\b/g)) {
    push({ type: 'URL', match: m[0], confidence: 'medium' });
  }
  if (/wa\.me|whats\s*app|whatsapp|واتس|وتس|واتساب|وتساب/.test(text)) push({ type: 'WHATSAPP', match: 'whatsapp', confidence: 'high' });
  const social =
    /(instagram|insta\b|\big\b|انستا|انستغرام|إنستغرام|انستجرام|facebook|\bfb\b|فيسبوك|فيس بوك|فيس|tiktok|تيك ?توك|snapchat|سناب|telegram|تلغرام|تيليغرام|t\.me|viber|فايبر|signal\b|linkedin|twitter|\bx\.com)/;
  const s = social.exec(text);
  if (s) push({ type: 'SOCIAL', match: s[0], confidence: 'high' });
  for (const m of text.matchAll(/(?:^|\s)@([a-z0-9_.]{3,30})\b/g)) push({ type: 'HANDLE', match: `@${m[1]}`, confidence: 'medium' });
  if (/(اتصل|اتصلوا|كلمني|كلموني|رقمي|رقم التلفون|رقم الهاتف|تلفون|موبايل|call me|text me|my number|contact me)/.test(text)) {
    push({ type: 'PHONE', match: 'contact request wording', confidence: 'low' });
  }

  // Digit runs allowing common separators: "03 12 34 56", "71-123-456", "(961)3.123.456".
  for (const m of text.matchAll(/\+?\(?\d[\d\s().\-_/\\|]{5,22}\d/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 7) continue;
    const start = m.index ?? 0;
    const around = text.slice(Math.max(0, start - 8), start + m[0].length + 10);
    const moneyContext = /\$|usd|دولار|د\.ل|ل\.ل|ليرة|lbp|م2|m2|sqm|متر/.test(around);
    const prefixed = /^(?:00961|961|0)/.test(digits);
    if (moneyContext && !prefixed && !/[\s.\-]/.test(m[0].trim())) continue; // e.g. "3500000$"
    if (/^(?:00961|961)\d{7,8}$/.test(digits) || (LB_MOBILE.test(digits) && (prefixed || digits.length === 8))) {
      push({ type: 'PHONE', match: m[0].trim(), confidence: 'high' });
    } else if (LB_MOBILE.test(digits)) {
      push({ type: 'PHONE', match: m[0].trim(), confidence: 'medium' }); // bare 3xxxxxx
    } else if (/^0\d{7}$/.test(digits)) {
      push({ type: 'PHONE', match: m[0].trim(), confidence: 'high' }); // 0X XXXXXX landline/mobile
    } else if (digits.length >= 8 && digits.length <= 15) {
      push({ type: 'PHONE', match: m[0].trim(), confidence: 'medium' });
    } else if (digits.length === 7 && /[\s.\-]/.test(m[0])) {
      push({ type: 'PHONE', match: m[0].trim(), confidence: 'low' });
    }
  }

  // Spelled-out digits: six or more digit words in a row.
  const tokens = text.split(/[\s,،.\-]+/).filter(Boolean);
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 6) push({ type: 'SPELLED_DIGITS', match: run.join(' '), confidence: 'medium' });
    run = [];
  };
  for (const t of tokens) {
    const w = t.replace(/^و(?=\S{2,})/, ''); // Arabic conjunction prefix "و"
    if (DIGIT_WORDS[t] || DIGIT_WORDS[w]) run.push(t);
    else if (/^\d$/.test(t)) run.push(t);
    else flush();
  }
  flush();

  return findings;
}

export function hasLikelyContactInfo(text: string): boolean {
  return detectContactInfo(text).some((f) => f.confidence !== 'low');
}
