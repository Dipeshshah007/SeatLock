import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/endpoints';
import type { EventSummary } from '../types';
import { format } from 'date-fns';

const CATEGORIES = ['', 'CONCERT', 'MOVIE', 'SPORTS', 'CONFERENCE', 'TRAVEL', 'THEATRE', 'GENERAL'];

export function EventsListPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  async function loadEvents() {
    setLoading(true);
    try {
      const { data } = await eventsApi.list({ search: search || undefined, category: category || undefined });
      setEvents(data.events);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    loadEvents();
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Browse events</h1>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 200 }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c || 'All categories'}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading events...</p>
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-muted)' }}>No events match your search.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: EventSummary }) {
  const available = parseInt(event.seats_available, 10);
  const total = parseInt(event.seats_total, 10);
  const pctAvailable = total > 0 ? (available / total) * 100 : 0;
  const isLowAvailability = pctAvailable < 20 && available > 0;
  const isSoldOut = available === 0;

  return (
    <Link to={`/events/${event.id}`} className="card" style={{ display: 'block', overflow: 'hidden', padding: 0 }}>
      <div
        style={{
          height: 140,
          background: event.cover_image_url
            ? `url(${event.cover_image_url}) center/cover`
            : 'var(--bg-elevated)',
        }}
      />
      <div style={{ padding: 16 }}>
        <span className="badge badge-muted" style={{ marginBottom: 10 }}>
          {event.category}
        </span>
        <h3 style={{ fontSize: 16, marginBottom: 6 }}>{event.title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          {event.venue_name} · {event.venue_city}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {format(new Date(event.starts_at), 'EEE, MMM d · h:mm a')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>
            from ${parseFloat(event.base_price).toFixed(2)}
          </span>
          {isSoldOut ? (
            <span className="badge badge-danger">Sold out</span>
          ) : isLowAvailability ? (
            <span className="badge badge-accent">{available} left</span>
          ) : (
            <span className="badge badge-success">{available} available</span>
          )}
        </div>
      </div>
    </Link>
  );
}
