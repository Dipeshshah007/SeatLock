import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { eventsApi, venuesApi } from '../api/endpoints';
import { extractErrorMessage } from '../api/client';
import type { Venue, EventCategory } from '../types';

interface SeatLayoutRow {
  section: string;
  rowLabel: string;
  seatCount: number;
  seatType: 'STANDARD' | 'VIP' | 'ACCESSIBLE';
}

const CATEGORIES: EventCategory[] = ['CONCERT', 'MOVIE', 'SPORTS', 'CONFERENCE', 'TRAVEL', 'THEATRE', 'GENERAL'];

export function CreateEventPage() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('GENERAL');
  const [venueId, setVenueId] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [basePrice, setBasePrice] = useState(50);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [layout, setLayout] = useState<SeatLayoutRow[]>([
    { section: 'General', rowLabel: 'A', seatCount: 20, seatType: 'STANDARD' },
  ]);

  useEffect(() => {
    venuesApi.list().then(({ data }) => setVenues(data.venues));
  }, []);

  function updateLayoutRow(index: number, patch: Partial<SeatLayoutRow>) {
    setLayout((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLayoutRow() {
    setLayout((prev) => [
      ...prev,
      { section: 'General', rowLabel: String.fromCharCode(65 + prev.length), seatCount: 20, seatType: 'STANDARD' },
    ]);
  }

  function removeLayoutRow(index: number) {
    setLayout((prev) => prev.filter((_, i) => i !== index));
  }

  const totalSeats = layout.reduce((sum, row) => sum + (row.seatCount || 0), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalVenueId = venueId;
      if (!finalVenueId && newVenueName) {
        const { data } = await venuesApi.create({ name: newVenueName, city: newVenueCity });
        finalVenueId = data.venue.id;
      }
      if (!finalVenueId) {
        toast.error('Select or create a venue');
        setSubmitting(false);
        return;
      }

      const { data } = await eventsApi.create({
        title,
        description,
        category,
        venueId: finalVenueId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        basePrice: Number(basePrice),
        coverImageUrl: coverImageUrl || undefined,
        seatLayout: layout,
      });

      toast.success('Event created!');
      navigate(`/events/${(data as { event: { id: string } }).event.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 40, paddingBottom: 80 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Create event</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15 }}>Basics</h3>
          <div>
            <label className="label">Title</label>
            <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cover image URL (optional)</label>
            <input className="input" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15 }}>Venue</h3>
          <div>
            <label className="label">Existing venue</label>
            <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="">— or create new below —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.city})
                </option>
              ))}
            </select>
          </div>
          {!venueId && (
            <>
              <div>
                <label className="label">New venue name</label>
                <input className="input" value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={newVenueCity} onChange={(e) => setNewVenueCity(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15 }}>Schedule & pricing</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Starts at</label>
              <input className="input" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Ends at</label>
              <input className="input" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Base price ($)</label>
            <input className="input" type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15 }}>Seat layout</h3>
            <span className="badge badge-accent">{totalSeats} total seats</span>
          </div>

          {layout.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="label">Section</label>
                <input
                  className="input"
                  value={row.section}
                  onChange={(e) => updateLayoutRow(idx, { section: e.target.value })}
                />
              </div>
              <div style={{ width: 70 }}>
                <label className="label">Row</label>
                <input
                  className="input"
                  value={row.rowLabel}
                  onChange={(e) => updateLayoutRow(idx, { rowLabel: e.target.value })}
                />
              </div>
              <div style={{ width: 90 }}>
                <label className="label"># seats</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={row.seatCount}
                  onChange={(e) => updateLayoutRow(idx, { seatCount: Number(e.target.value) })}
                />
              </div>
              <div style={{ width: 130 }}>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={row.seatType}
                  onChange={(e) => updateLayoutRow(idx, { seatType: e.target.value as SeatLayoutRow['seatType'] })}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="VIP">VIP</option>
                  <option value="ACCESSIBLE">Accessible</option>
                </select>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => removeLayoutRow(idx)}>
                ✕
              </button>
            </div>
          ))}

          <button type="button" className="btn btn-secondary" onClick={addLayoutRow}>
            + Add row group
          </button>
        </div>

        <button className="btn btn-primary btn-block" disabled={submitting} type="submit">
          {submitting ? <span className="spinner" /> : 'Publish event'}
        </button>
      </form>
    </div>
  );
}
