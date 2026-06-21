interface HoldTimerBannerProps {
  formatted: string;
  isExpired: boolean;
  seatCount: number;
}

export function HoldTimerBanner({ formatted, isExpired, seatCount }: HoldTimerBannerProps) {
  if (seatCount === 0) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 64,
        zIndex: 10,
        background: isExpired ? 'var(--danger-soft)' : 'var(--accent-soft)',
        border: `1px solid ${isExpired ? 'rgba(248,113,113,0.3)' : 'rgba(255,176,32,0.3)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        margin: '16px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 13, color: isExpired ? 'var(--danger)' : 'var(--accent)' }}>
        {isExpired
          ? '⏱ Your hold expired — please reselect your seats'
          : `🔒 ${seatCount} seat${seatCount > 1 ? 's' : ''} held — complete checkout before time runs out`}
      </span>
      {!isExpired && (
        <span
          className="mono"
          style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}
        >
          {formatted}
        </span>
      )}
    </div>
  );
}
