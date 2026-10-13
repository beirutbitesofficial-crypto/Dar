'use client';

export default function DashError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" role="alert">
      <h2>صار في مشكلة · Something went wrong</h2>
      <p className="sub">{error.digest ? `Ref: ${error.digest}` : 'Please try again.'}</p>
      <button onClick={reset}>جرّب مرة تانية · Try again</button>
    </div>
  );
}
