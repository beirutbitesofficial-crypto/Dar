import { BRAND } from '@dar/shared';
import { NavLink } from '@/components/nav';
import { logout, toggleLocale } from '@/lib/actions';
import { isAdmin, me } from '@/lib/api';
import { getT } from '@/lib/i18n';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([me(), getT()]);
  const admin = isAdmin(user);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <b>{BRAND.name.ar}</b>
          <span>{BRAND.name.en} admin</span>
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink href="/">{t('overview')}</NavLink>
          {admin && <NavLink href="/moderation">{t('moderation')}</NavLink>}
          <NavLink href="/properties">{t('properties')}</NavLink>
          <div className="section">CRM</div>
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
      <main className="main">{children}</main>
    </div>
  );
}
