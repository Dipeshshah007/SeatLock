import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { bookingsApi } from '../api/endpoints';
import { extractErrorMessage } from '../api/client';
import type { Booking } from '../types';

export function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [idempotencyKey] = useState(() => uuidv4()); // stable for this checkout attempt

  // mock card fields — purely cosmetic, the gateway is simulated server-side
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvc, setCvc] = useState('123');

  useEffect(() => {
    if (!bookingId) return;
    bookingsApi
      .get(bookingId)
      .then(({ data }) => setBooking(data.booking))
      .catch(() => toast.error('Could not load booking'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handlePay() {
    if (!bookingId) return;
    setPaying(true);
    try {
      const { data } = await bookingsApi.checkout(bookingId, idempotencyKey);
      toast.success('Payment successful! Booking confirmed.');
      navigate(`/bookings/${data.booking.id}/confirmation`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
      // payment failure already released seats server-side; send user back
      navigate(`/events/${booking?.event_id}`);
    } finally {
      setPaying(false);
    }
  }

  async function handleCancel() {
    if (!bookingId) return;
    try {
      await bookingsApi.cancel(bookingId);
      toast('Booking cancelled, seats released', { icon: 'ℹ️' });
      navigate(`/events/${booking?.event_id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading checkout...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p>Booking not found.</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 48, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Checkout</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
        Booking ref: <span className="mono">{booking.booking_ref}</span>
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total due</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            ${parseFloat(booking.total_amount).toFixed(2)}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          This is a simulated payment gateway — no real charge will be made. ~5% of payments are
          randomly simulated to fail, to demonstrate the rollback flow (seats are released
          automatically if payment fails).
        </p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15 }}>Mock card details</h3>
        <div>
          <label className="label">Card number</label>
          <input className="input mono" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Expiry</label>
            <input className="input mono" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">CVC</label>
            <input className="input mono" value={cvc} onChange={(e) => setCvc(e.target.value)} />
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-block" disabled={paying} onClick={handlePay} style={{ marginBottom: 10 }}>
        {paying ? <span className="spinner" /> : `Pay $${parseFloat(booking.total_amount).toFixed(2)}`}
      </button>
      <button className="btn btn-secondary btn-block" disabled={paying} onClick={handleCancel}>
        Cancel & release seats
      </button>
    </div>
  );
}
