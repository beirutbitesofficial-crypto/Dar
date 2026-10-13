'use client';

import { useActionState } from 'react';
import { BRAND, errorMessage } from '@dar/shared';
import { login, type ActionState } from '@/lib/actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, undefined);
  return (
    <main className="login">
      <div className="card">
        <div className="brand" style={{ padding: 0, marginBottom: 16 }}>
          <b>{BRAND.name.ar}</b>
          <span>{BRAND.name.en} · لوحة الإدارة · Admin</span>
        </div>
        <form action={action} className="form">
          <label>
            الإيميل · Email
            <input name="email" type="email" autoComplete="username" required dir="ltr" />
          </label>
          <label>
            كلمة السر · Password
            <input name="password" type="password" autoComplete="current-password" required dir="ltr" />
          </label>
          {state?.error && (
            <div className="flash err" role="alert">
              {errorMessage('ar', state.error)} · {errorMessage('en', state.error)}
            </div>
          )}
          <button type="submit" disabled={pending}>{pending ? '…' : 'تسجيل الدخول · Sign in'}</button>
          <p className="sub" style={{ fontSize: 12 }}>للموظفين والإدارة فقط · Staff and administrators only</p>
        </form>
      </div>
    </main>
  );
}
