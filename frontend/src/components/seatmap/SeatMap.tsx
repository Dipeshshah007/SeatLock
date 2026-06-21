import { useMemo } from 'react';
import type { SeatMapEntry } from '../../types';

interface SeatMapProps {
  seats: SeatMapEntry[];
  selectedIds: Set<string>;
  currentUserHeldIds: Set<string>;
  onToggleSeat: (seat: SeatMapEntry) => void;
  maxSelectable?: number;
}

const SEAT_TYPE_LABEL: Record<string, string> = {
  STANDARD: 'Standard',
  VIP: 'VIP',
  ACCESSIBLE: 'Accessible',
};

export function SeatMap({
  seats,
  selectedIds,
  currentUserHeldIds,
  onToggleSeat,
  maxSelectable = 10,
}: SeatMapProps) {
  const sections = useMemo(() => {
    const map = new Map<string, Map<string, SeatMapEntry[]>>();
    for (const seat of seats) {
      if (!map.has(seat.section)) map.set(seat.section, new Map());
      const rows = map.get(seat.section)!;
      if (!rows.has(seat.row_label)) rows.set(seat.row_label, []);
      rows.get(seat.row_label)!.push(seat);
    }
    return map;
  }, [seats]);

  function seatVisualState(seat: SeatMapEntry): 'available' | 'selected' | 'held-mine' | 'held-other' | 'booked' {
    if (selectedIds.has(seat.id)) return 'selected';
    if (seat.status === 'BOOKED') return 'booked';
    if (seat.status === 'HELD') {
      return currentUserHeldIds.has(seat.id) ? 'held-mine' : 'held-other';
    }
    return 'available';
  }

  function handleClick(seat: SeatMapEntry) {
    const state = seatVisualState(seat);
    if (state === 'booked' || state === 'held-other') return;
    if (state === 'available' && selectedIds.size >= maxSelectable) return;
    onToggleSeat(seat);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {Array.from(sections.entries()).map(([sectionName, rows]) => (
          <div key={sectionName}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <h4 style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{sectionName}</h4>
              {Array.from(rows.values())[0]?.[0] && (
                <span className="badge badge-muted">
                  {SEAT_TYPE_LABEL[Array.from(rows.values())[0][0].seat_type]} · $
                  {parseFloat(Array.from(rows.values())[0][0].price).toFixed(2)}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from(rows.entries()).map(([rowLabel, rowSeats]) => (
                <div key={rowLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="mono"
                    style={{ width: 20, fontSize: 12, color: 'var(--text-muted)' }}
                  >
                    {rowLabel}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rowSeats
                      .sort((a, b) => a.seat_number - b.seat_number)
                      .map((seat) => {
                        const state = seatVisualState(seat);
                        return (
                          <SeatCell
                            key={seat.id}
                            seat={seat}
                            state={state}
                            onClick={() => handleClick(seat)}
                          />
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <SeatMapLegend />
    </div>
  );
}

function SeatCell({
  seat,
  state,
  onClick,
}: {
  seat: SeatMapEntry;
  state: 'available' | 'selected' | 'held-mine' | 'held-other' | 'booked';
  onClick: () => void;
}) {
  const styles: Record<string, React.CSSProperties> = {
    available: {
      background: 'var(--seat-available)',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
    },
    selected: {
      background: 'var(--accent)',
      color: '#1a1300',
      cursor: 'pointer',
      transform: 'scale(1.05)',
      animation: 'pulse-amber 1.6s infinite',
    },
    'held-mine': {
      background: 'var(--accent)',
      color: '#1a1300',
      cursor: 'pointer',
    },
    'held-other': {
      background: 'var(--seat-held-other)',
      color: '#8a7148',
      cursor: 'not-allowed',
    },
    booked: {
      background: 'var(--seat-booked)',
      color: 'var(--text-muted)',
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  };

  const disabled = state === 'booked' || state === 'held-other';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${seat.section} ${seat.row_label}${seat.seat_number} — $${parseFloat(seat.price).toFixed(2)}${
        state === 'held-other' ? ' (currently held by another user)' : ''
      }${state === 'booked' ? ' (sold)' : ''}`}
      style={{
        width: 30,
        height: 30,
        borderRadius: seat.seat_type === 'VIP' ? '8px' : '6px',
        border:
          seat.seat_type === 'VIP'
            ? '1px solid var(--vip)'
            : '1px solid transparent',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.12s ease',
        ...styles[state],
      }}
    >
      {state === 'held-other' ? '🔒' : seat.seat_number}
    </button>
  );
}

function SeatMapLegend() {
  const items: Array<{ label: string; color: string }> = [
    { label: 'Available', color: 'var(--seat-available)' },
    { label: 'Your selection', color: 'var(--accent)' },
    { label: 'Held by another user', color: 'var(--seat-held-other)' },
    { label: 'Sold', color: 'var(--seat-booked)' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              background: item.color,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
