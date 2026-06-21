import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../api/endpoints';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('seatlock_token');
    const storedUser = localStorage.getItem('seatlock_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const persist = useCallback((u: User, t: string) => {
    localStorage.setItem('seatlock_token', t);
    localStorage.setItem('seatlock_user', JSON.stringify(u));
    setUser(u);
    setToken(t);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login({ email, password });
      persist(data.user, data.token);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data } = await authApi.register({ name, email, password });
      persist(data.user, data.token);
      return data.user;
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('seatlock_token');
    localStorage.removeItem('seatlock_user');
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
