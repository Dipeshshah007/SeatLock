import { useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';

interface Stats {
  totalRevenue: string;
  bookingsByStatus: Array<{ status: string; count: string }>;
  topEvents: Array<{ id: string; title: string; seats_sold: string; revenue: string }>;
  seatUtilization: { available: string; held: string; booked: string };
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then(({ data }) => setStats(data as Stats)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) return null;

  const seatTotal =
    parseInt(stats.seatUtilization.available, 10) +
    parseInt(stats.seatUtilization.held, 10) +
    parseInt(stats.seatUtilization.booked, 10);

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, marginBottom: 28 }}>Admin dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total revenue" value={`$${parseFloat(stats.totalRevenue).toFixed(2)}`} accent />
        <StatCard
          label="Seats booked"
          value={stats.seatUtilization.booked}
          sub={`of ${seatTotal} total`}
        />
        <StatCard label="Seats currently held" value={stats.seatUtilization.held} sub="active 5-min locks" />
        <StatCard label="Seats available" value={stats.seatUtilization.available} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Bookings by status</h3>
          {stats.bookingsByStatus.map((row) => (
            <div key={row.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{row.status}</span>
              <span className="mono">{row.count}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Top events by revenue</h3>
          {stats.topEvents.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No confirmed bookings yet.</p>
          ) : (
            stats.topEvents.map((evt) => (
              <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{evt.title}</span>
                <span className="mono">${parseFloat(evt.revenue).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card">
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</p>
      <p
        className="mono"
        style={{ fontSize: 26, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}
