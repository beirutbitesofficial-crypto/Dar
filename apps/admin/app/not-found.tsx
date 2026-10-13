import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="login">
      <div className="card"><h2>ما لقيناه · Not found</h2><Link href="/">← Dashboard</Link></div>
    </main>
  );
}
