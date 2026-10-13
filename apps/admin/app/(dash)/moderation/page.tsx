import Link from 'next/link';
import { Fragment } from 'react';
import { ApiForm, Card, DemoBadge, Empty, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

type SP = Promise<{ ok?: string; error?: string }>;

export default async function Moderation({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { t, dict, locale } = await getT();
  const q = await apiGet('/v1/admin/moderation');
  return (
    <>
      <PageHeader title={t('moderation')} sub={`${q.listings.length} · ${q.revisions.length} · ${q.media.length} · ${t('reports')}: ${q.openReports}`} />
      <Flash sp={sp} />
      <Card title={dict.listingStatus.PENDING_REVIEW}>
        {q.listings.length === 0 ? <Empty text={t('empty')} /> : (
          <Table head={[<L ar="المرجع" en="Ref" />, <L ar="العنوان" en="Title" />, <L ar="النوع" en="Type" />, <L ar="المالك" en="Owner" />, <L ar="تاريخ التقديم" en="Submitted" />, '']}>
            {q.listings.map((l: any) => (
              <tr key={l.id}>
                <td><Link href={`/properties/${l.id}`}>{l.ref}</Link> <DemoBadge show={l.demo} label={t('demo')} /></td>
                <td>{l.titleAr} {l.contactFlagged && <span className="badge red">{t('contactFlag')}</span>}</td>
                <td>{dict.listingType[l.listingType as 'SALE']} · {dict.propertyType[l.propertyType as 'LAND']}</td>
                <td>{l.owner.fullName}</td>
                <td>{dateTime(l.submittedAt, locale)}</td>
                <td><Link className="btn secondary" href={`/properties/${l.id}`}><L ar="مراجعة" en="Review" /></Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={<L ar="تعديلات معلّقة على إعلانات منشورة" en="Pending edits to published listings" />}>
        {q.revisions.length === 0 ? <Empty text={t('empty')} /> : q.revisions.map((r: any) => (
          <div key={r.id} className="card" style={{ boxShadow: 'none' }}>
            <div className="topbar" style={{ marginBottom: 8 }}>
              <strong><Link href={`/properties/${r.propertyId}`}>{r.ref}</Link> — {r.title}</strong>
              {r.contactFlags && <span className="badge red">{t('contactFlag')}</span>}
            </div>
            <dl className="kv">
              {Object.entries(r.changes).map(([k, v]) => (
                <Fragment key={k}><dt>{k}</dt><dd>{k === 'priceCents' ? `$${(Number(v) / 100).toLocaleString('en-US')}` : String(v)}</dd></Fragment>
              ))}
            </dl>
            <div className="row" style={{ marginTop: 12 }}>
              <ApiForm path={`/v1/admin/moderation/revisions/${r.id}/decision`} back="/moderation"><input type="hidden" name="decision" value="APPROVE" /><button>{t('approve')}</button></ApiForm>
              <ApiForm path={`/v1/admin/moderation/revisions/${r.id}/decision`} back="/moderation">
                <input type="hidden" name="decision" value="REJECT" />
                <input name="reason" placeholder={t('reason')} required minLength={5} />
                <button className="danger">{t('reject')}</button>
              </ApiForm>
            </div>
          </div>
        ))}
      </Card>

      <Card title={<L ar="صور جديدة على إعلانات منشورة" en="New photos on published listings" />}>
        <p className="notice"><L ar="افحص كل صورة: أرقام تلفون، لافتات، أشخاص، أو أي شي بيدلّ على العنوان الدقيق. ما في كشف تلقائي على الصور." en="Check every photo for phone numbers, signs, people or anything that identifies the exact address. Automatic detection is not used for photos." /></p>
        {q.media.length === 0 ? <Empty text={t('empty')} /> : (
          <div className="photos" style={{ marginTop: 12 }}>
            {q.media.map((m: any) => (
              <figure key={m.id}>
                {m.url && (m.kind === 'PHOTO' ? <img src={m.url} alt="" /> : <video src={m.url} controls style={{ width: '100%' }} />)}
                <figcaption>
                  <Link href={`/properties/${m.propertyId}`}>listing</Link>
                  <ApiForm path="/v1/admin/moderation/media" back="/moderation"><input type="hidden" name="mediaId" value={m.id} /><input type="hidden" name="decision" value="APPROVE" /><button>{t('approve')}</button></ApiForm>
                  <ApiForm path="/v1/admin/moderation/media" back="/moderation"><input type="hidden" name="mediaId" value={m.id} /><input type="hidden" name="decision" value="REJECT" /><input name="reason" placeholder={t('reason')} required /><button className="danger">{t('reject')}</button></ApiForm>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

