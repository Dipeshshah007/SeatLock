import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        background: 'rgba(14, 17, 22, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: 'var(--accent)',
              display: 'inline-block',
              boxShadow: '0 0 0 3px var(--accent-soft)',
            }}
          />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
            SeatLock
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/events" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Browse events
          </Link>

          {user && (
            <Link to="/my-bookings" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              My bookings
            </Link>
          )}

          {user && (user.role === 'ORGANIZER' || user.role === 'ADMIN') && (
            <Link to="/organizer/new-event" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Create event
            </Link>
          )}

          {user?.role === 'ADMIN' && (
            <Link to="/admin" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Admin
            </Link>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.name}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login" className="btn btn-secondary">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
