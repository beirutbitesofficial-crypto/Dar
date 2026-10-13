import { ApiForm, Card, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { getT } from '@/lib/i18n';

export default async function Locations({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const [locs, amenities] = await Promise.all([apiGet<any[]>('/v1/admin/locations'), apiGet<any[]>('/v1/admin/amenities')]);
  const byId = new Map(locs.map((l) => [l.id, l]));
  const parentOptions = locs.filter((l) => l.kind !== 'NEIGHBORHOOD');
  return (
    <>
      <PageHeader title={t('locations')} sub="Coordinates are approximate town centres used for public map pins. Deactivate instead of deleting." />
      <Flash sp={sp} />
      <Card title={t('create')}>
        <ApiForm path="/v1/admin/locations" back="/locations">
          <select name="kind"><option value="AREA">Area</option><option value="TOWN">Town</option><option value="NEIGHBORHOOD">Neighborhood</option></select>
          <select name="parentId" defaultValue=""><option value="">— parent —</option>{parentOptions.map((p) => <option key={p.id} value={p.id}>{p.kind}: {p.nameEn}</option>)}</select>
          <input name="nameAr" placeholder="الاسم بالعربي" required />
          <input name="nameEn" placeholder="Name (EN)" required />
          <input name="num:lat" placeholder="lat" style={{ width: 110 }} />
          <input name="num:lng" placeholder="lng" style={{ width: 110 }} />
          <button>{t('create')}</button>
        </ApiForm>
      </Card>
      <Table head={['Kind', 'Name', 'Parent', 'lat, lng', 'Listings', 'Active', '']}>
        {locs.map((l) => (
          <tr key={l.id}>
            <td>{l.kind}</td><td>{l.nameAr} · {l.nameEn}</td><td>{l.parentId ? byId.get(l.parentId)?.nameEn : '—'}</td>
            <td dir="ltr">{l.lat ?? '—'}, {l.lng ?? '—'}</td><td className="num">{l._count.townProperties}</td>
            <td>{l.active ? '✓' : '✕'}</td>
            <td>
              <ApiForm path={`/v1/admin/locations/${l.id}`} method="PUT" back="/locations">
                <input type="hidden" name="kind" value={l.kind} /><input type="hidden" name="nameAr" value={l.nameAr} /><input type="hidden" name="nameEn" value={l.nameEn} />
                {l.parentId && <input type="hidden" name="parentId" value={l.parentId} />}
                {l.lat && <input type="hidden" name="num:lat" value={l.lat} />}{l.lng && <input type="hidden" name="num:lng" value={l.lng} />}
                <input type="hidden" name="num:sortOrder" value={l.sortOrder} />
                <input type="hidden" name="bool:active" value={String(!l.active)} />
                <button className="link">{l.active ? 'Deactivate' : 'Activate'}</button>
              </ApiForm>
            </td>
          </tr>
        ))}
      </Table>
      <Card title="Amenities">
        <p className="sub">Amenity keys are fixed in the shared schema (packages/shared/src/domain/enums.ts); labels, availability per property type and visibility are editable here.</p>
        <Table head={['Key', 'Labels', 'Applies to', 'Active', '']}>
          {amenities.map((a) => (
            <tr key={a.key}>
              <td><code>{a.key}</code></td>
              <td colSpan={4}>
                <ApiForm path={`/v1/admin/amenities/${a.key}`} method="PUT" back="/locations">
                  <input name="labelAr" defaultValue={a.labelAr} required />
                  <input name="labelEn" defaultValue={a.labelEn} required />
                  {['APARTMENT', 'HOUSE_VILLA', 'LAND', 'COMMERCIAL'].map((pt) => (
                    <label key={pt}><span><input type="checkbox" name="list:appliesTo" value={pt} defaultChecked={a.appliesTo.includes(pt)} /> {pt}</span></label>
                  ))}
                  <select name="bool:active" defaultValue={String(a.active)}><option value="true">Active</option><option value="false">Hidden</option></select>
                  <input type="hidden" name="num:sortOrder" value={a.sortOrder} />
                  <button className="secondary">{t('save')}</button>
                </ApiForm>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
