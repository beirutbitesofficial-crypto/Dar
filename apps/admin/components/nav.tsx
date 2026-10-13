'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}

/** Asks for confirmation before submitting destructive financial forms. */
export function ConfirmButton({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
