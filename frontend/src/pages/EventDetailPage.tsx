import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { eventsApi, seatsApi, bookingsApi } from '../api/endpoints';
import { extractErrorMessage } from '../api/client';
import type { EventDetail, SeatMapEntry } from '../types';
import { SeatMap } from '../components/seatmap/SeatMap';
import { HoldTimerBanner } from '../components/seatmap/HoldTimerBanner';
import { useCountdown } from '../hooks/useCountdown';
import { useAuth } from '../context/AuthContext';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [holdDuration, setHoldDuration] = useState(300);

  const countdown = useCountdown(0, () => {
    if (heldIds.size > 0) {
      toast.error('Your seat hold expired. Please reselect.');
      setHeldIds(new Set());
      setSelectedIds(new Set());
      loadEvent();
    }
  });

  const loadEvent = useCallback(async () => {
    if (!id) return;
    const { data } = await eventsApi.get(id);
    setEvent(data.event);
    setSeatMap(data.seatMap);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadEvent().finally(() => setLoading(false));
  }, [loadEvent]);

  // Poll the seat map periodically so users see other people's seats
  // being taken/released in near-real-time without a full page refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      loadEvent();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadEvent]);

  function toggleSeat(seat: SeatMapEntry) {
    if (!user) {
      toast.error('Please log in to select seats');
      navigate('/login', { state: { from: `/events/${id}` } });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  }

  async function handleHoldAndCheckout() {
    if (selectedIds.size === 0) return;
    setHolding(true);
    try {
      const ids = Array.from(selectedIds);
      const { data } = await seatsApi.hold(ids);
      setHeldIds(new Set(data.heldSeats.map((s) => s.id)));
      setHoldDuration(data.holdDurationSeconds);
      countdown.reset(data.holdDurationSeconds);

      const { data: bookingData } = await bookingsApi.create(event!.id, ids);
      navigate(`/checkout/${bookingData.booking.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
      await loadEvent(); // refresh to show real-time state after conflict
      setSelectedIds(new Set());
    } finally {
      setHolding(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading event...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <p>Event not found.</p>
      </div>
    );
  }

  const selectedSeats = seatMap.filter((s) => selectedIds.has(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + parseFloat(s.price), 0);

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 100 }}>
      <span className="badge badge-muted" style={{ marginBottom: 12 }}>
        {event.category}
      </span>
      <h1 style={{ fontSize: 30, marginBottom: 8 }}>{event.title}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
        {format(new Date(event.starts_at), 'EEEE, MMMM d, yyyy · h:mm a')}
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        {event.venue_name} — {event.venue_address}, {event.venue_city}
      </p>

      {heldIds.size > 0 && (
        <HoldTimerBanner formatted={countdown.formatted} isExpired={countdown.isExpired} seatCount={heldIds.size} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 20 }}>Select your seats</h3>
          <SeatMap
            seats={seatMap}
            selectedIds={selectedIds}
            currentUserHeldIds={heldIds}
            onToggleSeat={toggleSeat}
          />
        </div>

        <div className="card" style={{ position: 'sticky', top: 90 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Your selection</h3>
          {selectedSeats.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Tap available seats on the map to add them here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {selectedSeats.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                    {s.section} {s.row_label}
                    {s.seat_number}
                  </span>
                  <span className="mono">${parseFloat(s.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 12,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600 }}>Total</span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              ${totalPrice.toFixed(2)}
            </span>
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={selectedSeats.length === 0 || holding}
            onClick={handleHoldAndCheckout}
          >
            {holding ? <span className="spinner" /> : `Hold seats & checkout`}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
            Seats are held for {Math.floor(holdDuration / 60)} minutes once you proceed
          </p>
        </div>
      </div>
    </div>
  );
}
