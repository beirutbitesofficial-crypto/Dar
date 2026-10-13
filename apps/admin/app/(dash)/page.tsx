import { DashboardOverview } from '@dar/shared';
import { Card, PageHeader, Stat, Table } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { usd } from '@/lib/format';
import { getT, LEAD_STATUS } from '@/lib/i18n';

export default async function Overview() {
  const user = await me();
  const { t, dict, locale } = await getT();
  if (!isAdmin(user)) {
    const [leads, queue] = await Promise.all([apiGet('/v1/staff/leads/pipeline'), apiGet<any[]>('/v1/staff/viewings/requests')]);
    return (
      <>
        <PageHeader title={`${dict.home.greeting}، ${user.fullName}`} />
        <div className="grid g3">
          <Stat label={t('leads')} value={Object.entries(leads).filter(([s]) => !['WON', 'LOST'].includes(s)).reduce((a, [, n]) => a + Number(n), 0)} />
          <Stat label={t('requests')} value={queue.length} />
        </div>
      </>
    );
  }
  const [o, workload] = await Promise.all([apiGet<DashboardOverview>('/v1/admin/dashboard'), apiGet<any[]>('/v1/admin/workload')]);
  return (
    <>
      <PageHeader title={t('overview')} />
      {/* Money: five distinct figures — collected rent is NOT platform revenue. */}
      <div className="grid g5">
        <Stat money label={t('moneyCollected')} value={usd(o.money.moneyCollectedCents)} hint="rent + sale commissions received" />
        <Stat money label={t('revenueEarned')} value={usd(o.money.brokerageRevenueEarnedCents)} hint="rental fees + sale commissions collected" />
        <Stat label={t('feesUnpaid')} value={usd(o.money.brokerageFeesUnpaidCents)} hint="due fees + approved sale commissions outstanding" />
        <Stat label={t('owedToLandlords')} value={usd(o.money.rentOwedToLandlordsCents)} hint="collected for owners, not yet paid out" />
        <Stat label={t('landlordPayouts')} value={usd(o.money.landlordPayoutsCents)} hint="recorded transfers to owners" />
      </div>
      <div className="grid g5">
        <Stat label={dict.listingStatus.PENDING_REVIEW} value={o.listings.PENDING_REVIEW ?? 0} />
        <Stat label={dict.listingStatus.PUBLISHED} value={o.listings.PUBLISHED ?? 0} />
        <Stat label={t('viewingsNext7')} value={o.viewingsNext7Days} />
        <Stat label={t('activeRentals')} value={o.activeRentals} />
        <Stat label={t('overdue')} value={o.overdueObligations} />
      </div>
      <div className="grid g2">
        <Card title={t('pipeline')}>
          <Table head={[t('status'), '#']}>
            {['NEW', 'ASSIGNED', 'CONTACTED', 'VIEWING_SCHEDULED', 'VIEWED', 'NEGOTIATION', 'WON', 'LOST'].map((s) => (
              <tr key={s}><td>{LEAD_STATUS[s]?.[locale] ?? s}</td><td className="num">{(o.leads as any)[s] ?? 0}</td></tr>
            ))}
          </Table>
        </Card>
        <Card title={t('workload')}>
          <Table head={[t('employee'), t('leads'), t('properties'), t('viewings'), t('agreements')]}>
            {workload.map((w) => (
              <tr key={w.id}><td>{w.fullName}</td><td className="num">{w.openLeads}</td><td className="num">{w.activeListings}</td><td className="num">{w.upcomingViewings}</td><td className="num">{w.activeAgreements}</td></tr>
            ))}
          </Table>
        </Card>
      </div>
      <p className="sub">{t('salesThisMonth')}: {o.salesClosedThisMonth}</p>
    </>
  );
}
