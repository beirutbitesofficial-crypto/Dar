import Link from 'next/link';
import { formatBasisPoints } from '@dar/shared';
import { ApiForm, Badge, Card, DemoBadge, Flash, PageHeader } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { date, dateTime, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

export default async function PropertyRecord({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, dict, locale } = await getT();
  const [p, user] = await Promise.all([apiGet(`/v1/staff/properties/${id}`), me()]);
  const admin = isAdmin(user);
  const employees = admin ? await apiGet<any[]>('/v1/admin/employees') : [];
  const back = `/properties/${id}`;
  const name = (x: any) => (x ? (locale === 'ar' ? x.nameAr : x.nameEn) : '—');
  return (
    <>
      <PageHeader
        title={`${p.ref} — ${p.titleAr ?? ''}`}
        sub={<><Badge value={p.status} label={dict.listingStatus[p.status as 'DRAFT']} /> <DemoBadge show={p.demo} label={t('demo')} /> {p.contactFlags && <span className="badge red">{t('contactFlag')}</span>}</>}
      />
      <Flash sp={sp} />

      {admin && p.status === 'PENDING_REVIEW' && (
        <Card title={t('moderation')}>
          {p.contactFlags && (
            <p className="notice">Detected: {(p.contactFlags as any[]).map((f) => `${f.type} “${f.match}” (${f.confidence})`).join(' · ')}</p>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <ApiForm path={`/v1/admin/moderation/properties/${id}/decision`} back={back}>
              <input type="hidden" name="decision" value="APPROVE" />
              <label>{t('employee')}
                <select name="assignedEmployeeId" defaultValue={p.assignedEmployeeId ?? ''} required>
                  <option value="" disabled>—</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e._count.assignedLeads})</option>)}
                </select>
              </label>
              <label><span>★</span><select name="bool:featured" defaultValue="false"><option value="false">—</option><option value="true"><L ar="مميّز" en="Featured" /></option></select></label>
              <button>{t('approve')}</button>
            </ApiForm>
            <ApiForm path={`/v1/admin/moderation/properties/${id}/decision`} back={back}>
              <input type="hidden" name="decision" value="REJECT" />
              <input name="reason" placeholder={`${t('reason')} (shown to the owner)`} required minLength={5} style={{ minWidth: 320 }} />
              <button className="danger">{t('reject')}</button>
            </ApiForm>
          </div>
        </Card>
      )}

      <div className="grid g2">
        <Card title={dict.property.specs}>
          <dl className="kv">
            <dt><L ar="النوع" en="Type" /></dt><dd>{p.listingType && dict.listingType[p.listingType as 'SALE']} · {p.propertyType && dict.propertyType[p.propertyType as 'LAND']}</dd>
            <dt>{dict.property.location}</dt><dd>{name(p.area)} › {name(p.town)}{p.neighborhood ? ` › ${name(p.neighborhood)}` : ''}</dd>
            <dt>{p.listingType === 'RENT' ? dict.owner.netRent : dict.property.askingPrice}</dt><dd>{usd(p.priceCents)} {p.rentPricingMode && <span className="sub">({p.rentPricingMode})</span>}</dd>
            {p.estimate && p.listingType === 'SALE' && (<><dt>{dict.owner.sellerCommission.replace('{rate}', formatBasisPoints(p.estimate.sellerBps))}</dt><dd>{usd(p.estimate.sellerCommissionCents)} → {usd(p.estimate.sellerProceedsCents)}</dd></>)}
            {p.estimate && p.listingType === 'RENT' && (<><dt>{dict.owner.rentTenantPays}</dt><dd>{usd(p.estimate.tenantTotalCents)} ({usd(p.estimate.platformFeeCents)} fee)</dd></>)}
            <dt>{dict.property.size}</dt><dd>{p.sizeSqm ?? '—'} m²</dd>
            {p.bedrooms !== null && (<><dt>{dict.property.bedrooms}</dt><dd>{p.bedrooms}</dd></>)}
            {p.bathrooms !== null && (<><dt>{dict.property.bathrooms}</dt><dd>{p.bathrooms}</dd></>)}
            {p.floor !== null && (<><dt>{dict.property.floor}</dt><dd>{p.floor} / {p.totalFloors ?? '—'}</dd></>)}
            {p.furnished !== null && (<><dt>{dict.property.furnished}</dt><dd>{p.furnished ? '✓' : '✕'}</dd></>)}
            <dt>{dict.property.amenities}</dt><dd>{(p.amenities as string[]).map((a) => (dict.amenities as any)[a] ?? a).join('، ') || '—'}</dd>
            <dt>{dict.property.availableFrom}</dt><dd>{date(p.availableFrom, locale)}</dd>
          </dl>
          <h3 style={{ marginTop: 16 }}>{dict.property.description}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{p.descriptionAr}</p>
          {p.descriptionEn && <p dir="ltr" style={{ whiteSpace: 'pre-wrap' }}>{p.descriptionEn}</p>}
          {p.rejectionReason && <p className="flash err">{dict.owner.rejectionReason}: {p.rejectionReason}</p>}
        </Card>

        <Card title={t('privateData')} className="private">
          <dl className="kv">
            <dt><L ar="حساب المالك" en="Owner account" /></dt><dd>{p.owner.fullName} · <span dir="ltr">{p.owner.phone}</span> · <span dir="ltr">{p.owner.email}</span></dd>
            <dt>{dict.owner.contactName}</dt><dd>{p.ownerContactName ?? '—'}</dd>
            <dt>{dict.owner.contactPhone}</dt><dd dir="ltr">{p.ownerContactPhone ?? '—'}</dd>
            <dt>{dict.owner.contactEmail}</dt><dd dir="ltr">{p.ownerContactEmail ?? '—'}</dd>
            <dt>{dict.owner.exactAddress}</dt><dd>{p.exactAddress ?? '—'}</dd>
            <dt><L ar="GPS" en="GPS" /></dt><dd dir="ltr">{p.latitude ? `${p.latitude}, ${p.longitude}` : '—'}</dd>
            <dt><L ar="ملاحظات المالك" en="Owner notes" /></dt><dd>{p.ownerNotesForStaff ?? '—'}</dd>
          </dl>
          <h3 style={{ marginTop: 16 }}>{dict.owner.documents}</h3>
          {(p.media as any[]).filter((m) => m.kind === 'DOCUMENT').map((m) => (
            <div key={m.id}><a href={`/download?path=${encodeURIComponent(m.documentLink)}`} target="_blank" rel="noreferrer">{m.fileName}</a></div>
          ))}
        </Card>
      </div>

      <Card title={dict.owner.photos}>
        <div className="photos">
          {(p.media as any[]).filter((m) => m.kind !== 'DOCUMENT').map((m) => (
            <figure key={m.id}>
              {m.url && (m.kind === 'PHOTO' ? <img src={m.url} alt="" /> : <video src={m.url} controls style={{ width: '100%' }} />)}
              <figcaption>
                <span><Badge value={m.reviewStatus} /> {m.isCover && <span className="badge blue">cover</span>}</span>
                {admin && m.reviewStatus !== 'REJECTED' && (
                  <ApiForm path="/v1/admin/moderation/media" back={back}><input type="hidden" name="mediaId" value={m.id} /><input type="hidden" name="decision" value="REJECT" /><input name="reason" placeholder={t('reason')} required /><button className="danger">{t('reject')}</button></ApiForm>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </Card>

      <div className="grid g2">
        {admin && (
          <Card title={t('assign')}>
            <ApiForm path={`/v1/admin/moderation/properties/${id}/assignee`} method="PUT" back={back}>
              <select name="employeeId" defaultValue={p.assignedEmployeeId ?? ''} required>
                <option value="" disabled>—</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
              <button className="secondary">{t('save')}</button>
            </ApiForm>
            <ApiForm path={`/v1/admin/moderation/properties/${id}/featured`} method="PUT" back={back} className="inline">
              <select name="bool:featured" defaultValue={String(p.featured)}><option value="true">★ Featured</option><option value="false"><L ar="غير مميّز" en="Not featured" /></option></select>
              <input name="num:rank" type="number" min={0} defaultValue={p.featuredRank} style={{ width: 90 }} />
              <button className="secondary">{t('save')}</button>
            </ApiForm>
          </Card>
        )}
        <Card title={t('status')}>
          <ApiForm path={`/v1/staff/properties/${id}/status`} back={back}>
            <select name="to" required>{(p.allowedTransitions as string[]).map((s) => <option key={s} value={s}>{dict.listingStatus[s as 'DRAFT']}</option>)}</select>
            <input name="reason" placeholder={t('reason')} />
            <button className="secondary" disabled={p.allowedTransitions.length === 0}>{t('save')}</button>
          </ApiForm>
          <p className="sub" style={{ marginTop: 8 }}><L ar="حالة «مباع» و«مؤجّر» بتتعيّن تلقائياً لما ينوافق على البيع أو يتفعّل عقد الإيجار." en="Sold / rented are set automatically by approved closings and activated leases." /></p>
        </Card>
      </div>

      <Card title={t('notes')}>
        <ApiForm path={`/v1/staff/properties/${id}/notes`} back={back} className="form">
          <textarea name="body" required placeholder="للموظفين بس — ما بتبيّن للمالكين أو الزباين · Staff only — never shown to owners or customers" />
          <div><button className="secondary">{t('addNote')}</button></div>
        </ApiForm>
        {(p.internalNotes as any[]).map((n) => <p key={n.id}><span className="sub">{dateTime(n.createdAt, locale)}</span><br />{n.body}</p>)}
      </Card>
      <p className="sub"><Link href="/properties">← {t('properties')}</Link></p>
    </>
  );
}
