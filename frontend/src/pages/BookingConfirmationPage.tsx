import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { bookingsApi } from '../api/endpoints';

interface BookingDetailResponse {
  booking: {
    id: string;
    booking_ref: string;
    status: string;
    total_amount: string;
    event_title: string;
    starts_at: string;
    venue_name: string;
  };
  seats: Array<{ section: string; row_label: string; seat_number: number; price: string }>;
}

export function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [data, setData] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;
    bookingsApi.get(bookingId).then((res) => setData(res.data as BookingDetailResponse))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p>Booking not found.</p>
      </div>
    );
  }

  const { booking, seats } = data;
  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 56, paddingBottom: 80, textAlign: 'center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isConfirmed ? 'var(--success-soft)' : 'var(--danger-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          margin: '0 auto 20px',
        }}
      >
        {isConfirmed ? '✓' : '!'}
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 8 }}>
        {isConfirmed ? 'Booking confirmed' : `Booking ${booking.status.toLowerCase()}`}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
        Reference <span className="mono">{booking.booking_ref}</span>
      </p>

      <div className="card" style={{ textAlign: 'left', marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>{booking.event_title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {format(new Date(booking.starts_at), 'EEEE, MMMM d, yyyy · h:mm a')} · {booking.venue_name}
        </p>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          {seats.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                {s.section} {s.row_label}
                {s.seat_number}
              </span>
              <span className="mono">${parseFloat(s.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            marginTop: 8,
            paddingTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 600 }}>Total paid</span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
            ${parseFloat(booking.total_amount).toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Link to="/my-bookings" className="btn btn-secondary">
          View my bookings
        </Link>
        <Link to="/events" className="btn btn-primary">
          Browse more events
        </Link>
      </div>
    </div>
  );
}
