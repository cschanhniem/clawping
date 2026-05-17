import { Alert, Loader, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Layout } from './components/Layout';
import { useAuth } from './hooks/useAuth';
import { useAsyncData } from './hooks/useApi';
import { getChecks, getDevices, getIncidents, getOverview } from './lib/api';
import { ChecksPage } from './pages/ChecksPage';
import { DevicesPage } from './pages/DevicesPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { LoginPage } from './pages/LoginPage';
import { StatusPage } from './pages/StatusPage';
import { TelegramPage } from './pages/TelegramPage';

type PageKey = 'status' | 'devices' | 'checks' | 'incidents' | 'telegram';

export default function App() {
  const auth = useAuth();
  const [page, setPage] = useState<PageKey>('status');

  const overview = useAsyncData(getOverview, [auth.authenticated]);
  const devices = useAsyncData(getDevices, [auth.authenticated]);
  const checks = useAsyncData(getChecks, [auth.authenticated]);
  const incidents = useAsyncData(getIncidents, [auth.authenticated]);

  const loading = useMemo(
    () => auth.loading || (auth.authenticated && (overview.loading || devices.loading || checks.loading || incidents.loading)),
    [auth.loading, auth.authenticated, overview.loading, devices.loading, checks.loading, incidents.loading],
  );

  if (auth.loading) {
    return (
      <Stack align="center" justify="center" mih="100vh">
        <Loader />
      </Stack>
    );
  }

  if (!auth.authenticated) {
    return <LoginPage error={auth.error} onLogin={auth.login} />;
  }

  const body = (() => {
    if (loading) {
      return (
        <Stack align="center" justify="center" mih={240}>
          <Loader />
        </Stack>
      );
    }

    const error = overview.error || devices.error || checks.error || incidents.error;
    if (error) {
      return <Alert color="red">{error}</Alert>;
    }

    if (page === 'devices') {
      return <DevicesPage devices={devices.data ?? []} onCreated={async () => { await devices.reload(); }} />;
    }
    if (page === 'checks') {
      return <ChecksPage checks={checks.data ?? []} onCreated={async () => { await checks.reload(); }} />;
    }
    if (page === 'incidents') {
      return <IncidentsPage incidents={incidents.data ?? []} />;
    }
    if (page === 'telegram') {
      return <TelegramPage />;
    }
    return <StatusPage overview={overview.data} />;
  })();

  return (
    <Layout
      title="Operations Dashboard"
      subtitle="Configure devices, inspect incidents, and wire Telegram alerts."
      page={page}
      onNavigate={setPage}
      onLogout={() => {
        void auth.logout();
      }}
    >
      {body}
      <Text size="sm" c="dimmed">
        Daily product: Telegram. Dashboard: onboarding, configuration, debugging.
      </Text>
    </Layout>
  );
}
