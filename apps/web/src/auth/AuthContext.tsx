import * as React from 'react';
import type { AuthResponse, LoginInput, RegisterInput, User } from '@centralit/shared';
import { api, onUnauthorized } from '../lib/api';
import {
  clearAuthStorage,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '../lib/auth-storage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => getStoredUser<User>());
  const [token, setTokenState] = React.useState<string | null>(() => getToken());
  const [status, setStatus] = React.useState<AuthStatus>(() =>
    getToken() ? 'authenticated' : 'unauthenticated',
  );

  const logout = React.useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setTokenState(null);
    setStatus('unauthenticated');
  }, []);

  React.useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setTokenState(null);
      setStatus('unauthenticated');
    });
  }, []);

  const persist = React.useCallback((data: AuthResponse) => {
    setToken(data.token);
    setStoredUser(data.user);
    setTokenState(data.token);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const login = React.useCallback(
    async (input: LoginInput) => {
      setStatus('loading');
      try {
        const { data } = await api.post<AuthResponse>('/auth/login', input);
        persist(data);
      } catch (err) {
        setStatus('unauthenticated');
        throw err;
      }
    },
    [persist],
  );

  const register = React.useCallback(
    async (input: RegisterInput) => {
      setStatus('loading');
      try {
        const { data } = await api.post<AuthResponse>('/auth/register', input);
        persist(data);
      } catch (err) {
        setStatus('unauthenticated');
        throw err;
      }
    },
    [persist],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, token, login, register, logout }),
    [status, user, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
