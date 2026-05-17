import { Alert, Button, Card, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';

interface LoginPageProps {
  error: string | null;
  onLogin: (password: string) => Promise<void>;
}

export function LoginPage({ error, onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await onLogin(password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack align="center" justify="center" mih="100vh" p="md">
      <Card withBorder radius="sm" padding="xl" w="100%" maw={420}>
        <Stack gap="md">
          <div>
            <Title order={2}>ClawPing</Title>
            <Text c="dimmed">Sign in to manage your home-server watchdog.</Text>
          </div>
          {error ? <Alert color="red">{error}</Alert> : null}
          <PasswordInput
            label="Admin password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Button onClick={() => void submit()} loading={loading}>
            Sign in
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
