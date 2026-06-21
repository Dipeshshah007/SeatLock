import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/client';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      const redirectTo = (location.state as { from?: string })?.from || '/events';
      navigate(redirectTo);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Log in</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        New here? <Link to="/register" style={{ color: 'var(--accent)' }}>Create an account</Link>
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={submitting} type="submit">
          {submitting ? <span className="spinner" /> : 'Log in'}
        </button>

        <div
          style={{
            marginTop: 8,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.8,
          }}
        >
          <strong>Demo accounts</strong> (password: Password123!)
          <br />
          user@seatlock.app · organizer@seatlock.app · admin@seatlock.app
        </div>
      </form>
    </div>
  );
}
