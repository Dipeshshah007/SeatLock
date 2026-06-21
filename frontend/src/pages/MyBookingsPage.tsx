import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../api/endpoints';
import { extractErrorMessage } from '../api/client';
import type { Booking, BookingStatus } from '../types';

const STATUS_BADGE: Record<BookingStatus, string> = {
  CONFIRMED: 'badge-success',
  PENDING: 'badge-accent',
  CANCELLED: 'badge-muted',
  EXPIRED: 'badge-muted',
  FAILED: 'badge-danger',
};

export function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await bookingsApi.myBookings();
    setBookings(data.bookings);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(id: string) {
    try {
      await bookingsApi.cancel(id);
      toast.success('Booking cancelled');
      load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>My bookings</h1>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>You haven't booked anything yet.</p>
          <Link to="/events" className="btn btn-primary">
            Browse events
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bookings.map((b) => (
            <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 15 }}>{b.event_title}</h3>
                  <span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {b.starts_at && format(new Date(b.starts_at), 'MMM d, yyyy · h:mm a')} · {b.venue_name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }} className="mono">
                  {b.booking_ref} · ${parseFloat(b.total_amount).toFixed(2)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {b.status === 'CONFIRMED' && (
                  <Link to={`/bookings/${b.id}/confirmation`} className="btn btn-secondary">
                    View
                  </Link>
                )}
                {(b.status === 'CONFIRMED' || b.status === 'PENDING') && (
                  <button className="btn btn-danger" onClick={() => handleCancel(b.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
