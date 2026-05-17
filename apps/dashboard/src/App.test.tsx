import { fireEvent, screen } from '@testing-library/react';
import App from './App';
import { renderWithMantine } from './test-utils';

vi.mock('./pages/StatusPage', () => ({
  StatusPage: () => <div>Status Page</div>,
}));

vi.mock('./pages/DevicesPage', () => ({
  DevicesPage: ({ onCreated }: { onCreated: () => Promise<void> }) => (
    <button onClick={() => void onCreated()} type="button">
      Devices Page
    </button>
  ),
}));

vi.mock('./pages/ChecksPage', () => ({
  ChecksPage: ({ onCreated }: { onCreated: () => Promise<void> }) => (
    <button onClick={() => void onCreated()} type="button">
      Checks Page
    </button>
  ),
}));

vi.mock('./pages/IncidentsPage', () => ({
  IncidentsPage: () => <div>Incidents Page</div>,
}));

vi.mock('./pages/TelegramPage', () => ({
  TelegramPage: () => <div>Telegram Page</div>,
}));

vi.mock('./hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./hooks/useApi', () => ({
  useAsyncData: vi.fn(),
}));

describe('App', () => {
  it('renders login when unauthenticated', async () => {
    const authModule = await import('./hooks/useAuth');
    const apiModule = await import('./hooks/useApi');
    vi.mocked(authModule.useAuth).mockReturnValue({
      authenticated: false,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(apiModule.useAsyncData).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderWithMantine(<App />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders dashboard when authenticated', async () => {
    const authModule = await import('./hooks/useAuth');
    const apiModule = await import('./hooks/useApi');
    const logout = vi.fn();
    const devicesReload = vi.fn().mockResolvedValue(undefined);
    const checksReload = vi.fn().mockResolvedValue(undefined);
    const overviewState = {
      data: {
        devicesOnline: 1,
        devicesOffline: 0,
        warnings: 0,
        critical: 0,
        activeIncidents: 0,
        lastSweepAt: null,
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    const devicesState = {
      data: [],
      loading: false,
      error: null,
      reload: devicesReload,
    };
    const checksState = {
      data: [],
      loading: false,
      error: null,
      reload: checksReload,
    };
    const incidentsState = {
      data: [],
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    vi.mocked(authModule.useAuth).mockReturnValue({
      authenticated: true,
      loading: false,
      error: null,
      login: vi.fn(),
      logout,
    });
    let asyncCall = 0;
    vi.mocked(apiModule.useAsyncData).mockImplementation(() => {
      const states = [overviewState, devicesState, checksState, incidentsState];
      const state = states[asyncCall % states.length];
      asyncCall += 1;
      return state;
    });

    renderWithMantine(<App />);
    expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Status Page')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Devices'));
    fireEvent.click(screen.getByText('Devices Page'));
    expect(devicesReload).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Checks'));
    fireEvent.click(screen.getByText('Checks Page'));
    expect(checksReload).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Incidents'));
    expect(screen.getByText('Incidents Page')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Telegram'));
    expect(screen.getByText('Telegram Page')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Logout'));
    expect(logout).toHaveBeenCalled();
  });

  it('renders loading and error states for authenticated sessions', async () => {
    const authModule = await import('./hooks/useAuth');
    const apiModule = await import('./hooks/useApi');
    vi.mocked(authModule.useAuth).mockReturnValue({
      authenticated: true,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(apiModule.useAsyncData)
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        reload: vi.fn(),
      })
      .mockReturnValue({
        data: [],
        loading: false,
        error: null,
        reload: vi.fn(),
      });

    const { rerender } = renderWithMantine(<App />);
    expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Status Page')).not.toBeInTheDocument();

    vi.mocked(apiModule.useAsyncData)
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: 'Overview failed',
        reload: vi.fn(),
      })
      .mockReturnValue({
        data: [],
        loading: false,
        error: null,
        reload: vi.fn(),
      });

    rerender(<App />);
    expect(screen.getByText('Overview failed')).toBeInTheDocument();
  });

  it('renders the top-level auth loader', async () => {
    const authModule = await import('./hooks/useAuth');
    const apiModule = await import('./hooks/useApi');
    vi.mocked(authModule.useAuth).mockReturnValue({
      authenticated: false,
      loading: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(apiModule.useAsyncData).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    const { container } = renderWithMantine(<App />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
  });

  it('falls back to empty lists when page data is null', async () => {
    const authModule = await import('./hooks/useAuth');
    const apiModule = await import('./hooks/useApi');
    vi.mocked(authModule.useAuth).mockReturnValue({
      authenticated: true,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    let asyncCall = 0;
    vi.mocked(apiModule.useAsyncData).mockImplementation(() => {
      const states = [
        { data: { devicesOnline: 1, devicesOffline: 0, warnings: 0, critical: 0, activeIncidents: 0, lastSweepAt: null }, loading: false, error: null, reload: vi.fn() },
        { data: null, loading: false, error: null, reload: vi.fn().mockResolvedValue(undefined) },
        { data: null, loading: false, error: null, reload: vi.fn().mockResolvedValue(undefined) },
        { data: null, loading: false, error: null, reload: vi.fn() },
      ];
      const state = states[asyncCall % states.length];
      asyncCall += 1;
      return state;
    });

    renderWithMantine(<App />);
    fireEvent.click(screen.getByText('Devices'));
    expect(screen.getByText('Devices Page')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Checks'));
    expect(screen.getByText('Checks Page')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Incidents'));
    expect(screen.getByText('Incidents Page')).toBeInTheDocument();
  });
});
