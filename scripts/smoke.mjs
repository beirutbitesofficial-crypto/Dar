// Screenshot smoke test of the admin dashboard and mobile web build.
// Records console errors and HTTP failures per page in ci-out/smoke.json.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'ci-out/shots';
const report = [];
const browser = await chromium.launch();

async function visit(page, name, url, wait = 1500) {
  const errors = [];
  const onConsole = (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300));
  const onResp = (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`);
  page.on('console', onConsole);
  page.on('response', onResp);
  let status = 'ok';
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (resp && resp.status() >= 400) status = `http ${resp.status()}`;
    await page.waitForTimeout(wait);
  } catch (e) {
    status = `error: ${String(e).slice(0, 200)}`;
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
  page.off('console', onConsole);
  page.off('response', onResp);
  report.push({ name, url: page.url(), status, errors });
  console.log(name, status, errors.length ? errors.slice(0, 3) : '');
}

// ---- Admin dashboard
const admin = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await visit(admin, 'admin-00-login', 'http://localhost:3000/login');
try {
  await admin.fill('input[name=email]', 'admin@demo.dar.test');
  await admin.fill('input[name=password]', 'Dar-demo-2026');
  await Promise.all([admin.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }), admin.click('button[type=submit]')]);
} catch (e) {
  console.log('admin login failed', String(e).slice(0, 200));
}
const pages = ['', 'moderation', 'properties', 'leads', 'viewings', 'conversations', 'sales', 'agreements', 'collections', 'payouts', 'reports', 'users', 'locations', 'settings', 'audit', 'exports'];
for (const [i, p] of pages.entries()) await visit(admin, `admin-${String(i + 1).padStart(2, '0')}-${p || 'overview'}`, `http://localhost:3000/${p}`);
// first detail pages
for (const section of ['properties', 'agreements', 'leads', 'sales']) {
  await admin.goto(`http://localhost:3000/${section}`, { waitUntil: 'networkidle' }).catch(() => {});
  const href = await admin.locator(`a[href^="/${section}/"]`).first().getAttribute('href').catch(() => null);
  if (href) await visit(admin, `admin-detail-${section}`, `http://localhost:3000${href}`);
}
// employee sees only their records
const emp = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await emp.goto('http://localhost:3000/login');
try {
  await emp.fill('input[name=email]', 'employee2@demo.dar.test');
  await emp.fill('input[name=password]', 'Dar-demo-2026');
  await Promise.all([emp.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }), emp.click('button[type=submit]')]);
} catch {}
await visit(emp, 'employee-01-overview', 'http://localhost:3000/');
await visit(emp, 'employee-02-properties', 'http://localhost:3000/properties');
await visit(emp, 'employee-03-settings-forbidden', 'http://localhost:3000/settings');

// ---- Mobile web build (phone viewport)
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await mobileCtx.newPage();
const MW = 'http://localhost:8081';
await visit(m, 'mobile-01-home-ar', `${MW}/`, 3000);
await visit(m, 'mobile-02-search-ar', `${MW}/search`, 3000);
const firstListing = await m.locator('a[href^="/listing/"]').first().getAttribute('href').catch(() => null);
if (firstListing) await visit(m, 'mobile-03-listing-ar', `${MW}${firstListing}`, 3000);
await visit(m, 'mobile-04-account-ar', `${MW}/account`, 2000);
await visit(m, 'mobile-05-login-ar', `${MW}/auth/login`, 2000);
try {
  await m.getByPlaceholder(/@/).first().fill('customer1@demo.dar.test').catch(() => {});
} catch {}
fs.writeFileSync('ci-out/smoke.json', JSON.stringify(report, null, 2));
await browser.close();
