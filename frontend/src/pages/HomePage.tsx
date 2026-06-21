import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 640 }}>
        <span className="badge badge-accent" style={{ marginBottom: 20 }}>
          ⚡ Concurrency-safe by design
        </span>
        <h1 style={{ fontSize: 48, lineHeight: 1.08, marginBottom: 20 }}>
          Book the seat you want.
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>Not the seat someone else stole.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
          SeatLock is a ticketing platform for any kind of seated event — concerts, conferences,
          sports, theatre. Every seat is protected by transactional row-locking, so two people can
          never accidentally buy the same seat — even if they click "Book" in the same millisecond.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/events" className="btn btn-primary" style={{ padding: '13px 24px' }}>
            Browse events
          </Link>
          <Link to="/register" className="btn btn-secondary" style={{ padding: '13px 24px' }}>
            Create an account
          </Link>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 72,
        }}
      >
        <FeatureCard
          title="Zero double-bookings"
          body="Postgres row-level locks (SELECT...FOR UPDATE) make it structurally impossible for two checkouts to win the same seat."
        />
        <FeatureCard
          title="5-minute holds"
          body="Selecting a seat reserves it with a Redis-backed TTL, giving you breathing room to pay without losing your spot."
        />
        <FeatureCard
          title="Works for any event"
          body="Concerts, conferences, sports, flights, theatre — one generic seat-map engine powers them all."
        />
      </div>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
