import Link from 'next/link';
import { Empty, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Conversations() {
  const { t, locale } = await getT();
  const items = await apiGet<any[]>('/v1/conversations?scope=staff');
  return (
    <>
      <PageHeader title={t('conversations')} />
      {items.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={['', 'Subject', 'Last message', t('employee'), t('date')]}>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.unreadCount > 0 && <span className="badge red">{c.unreadCount}</span>}</td>
              <td><Link href={`/conversations/${c.id}`}>{c.subject}</Link></td>
              <td>{c.lastMessagePreview ?? '—'}</td>
              <td>{c.staffName ?? <span className="badge amber">unassigned</span>}</td>
              <td>{dateTime(c.lastMessageAt, locale)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
