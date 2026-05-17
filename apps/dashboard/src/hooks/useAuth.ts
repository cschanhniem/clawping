import { useEffect, useState } from 'react';
import { getMe, login as loginRequest, logout as logoutRequest } from '../lib/api';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getMe()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  async function login(password: string) {
    setError(null);
    try {
      await loginRequest(password);
      setAuthenticated(true);
    } catch (err) {
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  }

  async function logout() {
    await logoutRequest();
    setAuthenticated(false);
  }

  return { authenticated, loading, error, login, logout };
}
