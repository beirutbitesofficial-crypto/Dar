import { headers } from 'next/headers';
import { BRAND } from '@dar/shared';
import { NavLink } from '@/components/nav';
import { logout, toggleLocale } from '@/lib/actions';
import { isAdmin, me } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

/** Sections only administrators can open (mirrors the API's role checks). */
const ADMIN_ONLY = ['/moderation', '/payouts', '/settings', '/locations', '/users', '/reports', '/audit', '/exports'];

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([me(), getT()]);
  const admin = isAdmin(user);
  const path = (await headers()).get('x-dar-path') ?? '/';
  const adminOnly = ADMIN_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <b>{BRAND.name.ar}</b>
          <span>{BRAND.name.en} admin</span>
        </div>
        <nav className="nav" aria-label="القائمة الرئيسية">
          <NavLink href="/">{t('overview')}</NavLink>
          {admin && <NavLink href="/moderation">{t('moderation')}</NavLink>}
          <NavLink href="/properties">{t('properties')}</NavLink>
          <div className="section"><L ar="العملاء" en="CRM" /></div>
          <NavLink href="/leads">{t('leads')}</NavLink>
          <NavLink href="/viewings">{t('viewings')}</NavLink>
          <NavLink href="/conversations">{t('conversations')}</NavLink>
          <div className="section">$</div>
          <NavLink href="/sales">{t('sales')}</NavLink>
          <NavLink href="/agreements">{t('agreements')}</NavLink>
          <NavLink href="/collections">{t('collections')}</NavLink>
          {admin && <NavLink href="/payouts">{t('payouts')}</NavLink>}
          {admin && (
            <>
              <div className="section">⚙</div>
              <NavLink href="/settings">{t('settings')}</NavLink>
              <NavLink href="/locations">{t('locations')}</NavLink>
              <NavLink href="/users">{t('users')}</NavLink>
              <NavLink href="/reports">{t('reports')}</NavLink>
              <NavLink href="/audit">{t('audit')}</NavLink>
              <NavLink href="/exports">{t('exports')}</NavLink>
            </>
          )}
        </nav>
        <div style={{ padding: '18px 12px', display: 'grid', gap: 8 }}>
          <div className="sub" style={{ fontSize: 13 }}>{user.fullName}</div>
          <form action={toggleLocale}><button className="link" type="submit">{t('language')}</button></form>
          <form action={logout}><button className="link" type="submit">{t('signOut')}</button></form>
        </div>
      </aside>
      <main className="main">
        {adminOnly && !admin ? (
          <div className="card" role="alert">
            <h2>{t('adminOnly')}</h2>
            <p className="sub">{t('adminOnlyHint')}</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
