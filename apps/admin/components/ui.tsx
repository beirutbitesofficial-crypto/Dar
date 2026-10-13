import type { ReactNode } from 'react';
import { submit } from '@/lib/actions';

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: 'green', ACTIVE: 'green', PAID: 'green', APPROVED: 'green', CONFIRMED: 'green', WON: 'green', COMPLETED: 'green', SENT: 'green',
  PENDING_REVIEW: 'amber', PENDING: 'amber', PENDING_APPROVAL: 'amber', PARTIALLY_PAID: 'amber', REQUESTED: 'amber', DUE: 'amber', NEW: 'amber', DRAFT: 'blue',
  REJECTED: 'red', OVERDUE: 'red', LOST: 'red', CANCELLED: 'red', TERMINATED: 'red', NO_SHOW: 'red', VOID: 'red', FAILED: 'red',
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`badge ${STATUS_TONE[value] ?? ''}`}>{label ?? value.replaceAll('_', ' ').toLowerCase()}</span>;
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
