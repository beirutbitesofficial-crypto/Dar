import type { ReactNode } from 'react';
import { submit } from '@/lib/actions';
import { getLocale } from '@/lib/i18n';

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: 'green', ACTIVE: 'green', PAID: 'green', APPROVED: 'green', CONFIRMED: 'green', WON: 'green', COMPLETED: 'green', SENT: 'green',
  PENDING_REVIEW: 'amber', PENDING: 'amber', PENDING_APPROVAL: 'amber', PARTIALLY_PAID: 'amber', REQUESTED: 'amber', DUE: 'amber', NEW: 'amber', DRAFT: 'blue',
  REJECTED: 'red', OVERDUE: 'red', LOST: 'red', CANCELLED: 'red', TERMINATED: 'red', NO_SHOW: 'red', VOID: 'red', FAILED: 'red',
};

/** Arabic/English names for every status or kind value shown in a badge. */
const STATUS_LABEL: Record<string, [ar: string, en: string]> = {
  // listings
  DRAFT: ['مسودة', 'Draft'], PENDING_REVIEW: ['قيد المراجعة', 'Pending review'], PUBLISHED: ['منشور', 'Published'], REJECTED: ['مرفوض', 'Rejected'],
  PAUSED: ['موقوف مؤقتاً', 'Paused'], RENTED: ['مؤجّر', 'Rented'], SOLD: ['مباع', 'Sold'], ARCHIVED: ['مؤرشف', 'Archived'],
  // reviews, approvals
  PENDING: ['معلّق', 'Pending'], APPROVED: ['موافَق عليه', 'Approved'], WITHDRAWN: ['مسحوب', 'Withdrawn'], PENDING_APPROVAL: ['بانتظار الموافقة', 'Pending approval'],
  // leads
  NEW: ['جديد', 'New'], ASSIGNED: ['معيّن لموظف', 'Assigned'], CONTACTED: ['تم التواصل', 'Contacted'], VIEWING_SCHEDULED: ['زيارة محددة', 'Viewing scheduled'],
  VIEWED: ['تمت الزيارة', 'Viewed'], NEGOTIATION: ['مفاوضة', 'Negotiation'], WON: ['نجحت', 'Won'], LOST: ['ما مشي الحال', 'Lost'],
  // viewings
  REQUESTED: ['مطلوبة', 'Requested'], CONFIRMED: ['مؤكدة', 'Confirmed'], COMPLETED: ['مكتملة', 'Completed'], NO_SHOW: ['ما حدا إجا', 'No-show'], CANCELLED: ['ملغى', 'Cancelled'],
  // agreements
  ACTIVE: ['ساري', 'Active'], ENDED: ['منتهي', 'Ended'], TERMINATED: ['منهى مبكراً', 'Terminated'],
  // money
  UPCOMING: ['قادم', 'Upcoming'], DUE: ['مستحق', 'Due'], OVERDUE: ['متأخّر', 'Overdue'], PARTIALLY_PAID: ['مدفوع جزئياً', 'Partially paid'], PAID: ['مدفوع', 'Paid'],
  WAIVED: ['معفى', 'Waived'], REFUNDED: ['مسترد', 'Refunded'], VOID: ['ملغى', 'Void'],
  PAYMENT: ['دفعة', 'Payment'], REVERSAL: ['قيد عكسي', 'Reversal'], REFUND: ['استرداد', 'Refund'], PAYOUT: ['تحويل للمالك', 'Payout'],
  RECEIVED: ['مستلَم', 'Received'], RETURNED: ['مُرجَع', 'Returned'], APPLIED_TO_DAMAGES: ['مخصوم للأضرار', 'Applied to damages'],
  // misc
  OPEN: ['مفتوح', 'Open'], RESOLVED: ['محلول', 'Resolved'], DISMISSED: ['مرفوض', 'Dismissed'], SENT: ['مُرسل', 'Sent'], FAILED: ['فشل', 'Failed'],
  QUEUED: ['بالانتظار', 'Queued'], UNCONFIGURED: ['غير مفعّل', 'Not configured'], NOT_REQUESTED: ['غير مطلوب', 'Not requested'],
  SALE: ['بيع', 'Sale'], RENT: ['إيجار', 'Rent'], BUYER: ['المشتري', 'Buyer'], SELLER: ['البائع', 'Seller'],
};

/** Status pill. Server component: picks Arabic or English from the dashboard language. */
export async function Badge({ value, label }: { value: string; label?: string }) {
  const known = STATUS_LABEL[value];
  const text = label ?? (known ? known[(await getLocale()) === 'en' ? 1 : 0] : value.replaceAll('_', ' ').toLowerCase());
  return <span className={`badge ${STATUS_TONE[value] ?? ''}`}>{text}</span>;
}

export function DemoBadge({ show, label = 'Demo' }: { show?: boolean; label?: string }) {
  return show ? <span className="badge demo">{label}</span> : null;
}

export function Card({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="topbar" style={{ marginBottom: 12 }}>
          {title ? <h2 style={{ margin: 0 }}>{title}</h2> : <span />}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, money }: { label: string; value: ReactNode; hint?: string; money?: boolean }) {
  return (
    <div className={`card stat ${money ? 'money' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Shows ?ok= / ?error= results from server actions. */
export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.error) return <div className="flash err" role="alert">⚠ {decodeURIComponent(sp.error).replaceAll('_', ' ')}</div>;
  if (sp.ok) return <div className="flash ok" role="status">✓ Saved</div>;
  return null;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

/**
 * A form that posts to the API through the generic `submit` server action.
 * Pass hidden fields via props; children are the visible inputs.
 */
export function ApiForm({
  path,
  back,
  method = 'POST',
  idem,
  children,
  className = 'inline',
  confirmText,
}: {
  path: string;
  back: string;
  method?: 'POST' | 'PUT';
  idem?: boolean;
  children: ReactNode;
  className?: string;
  confirmText?: string;
}) {
  return (
    <form action={submit} className={className} data-confirm={confirmText}>
      <input type="hidden" name="_path" value={path} />
      <input type="hidden" name="_back" value={back} />
      <input type="hidden" name="_method" value={method} />
      {idem && <input type="hidden" name="_idem" value="1" />}
      {children}
    </form>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <Empty text="—" />}
    </div>
  );
}

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(new Date());
