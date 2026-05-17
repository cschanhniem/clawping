import { Badge, Card, Group, Stack, Text } from '@mantine/core';

function isOnline(device: Record<string, unknown>) {
  const lastHeartbeat = device.last_heartbeat_at as string | null;
  const threshold = Number(device.missed_heartbeat_threshold_seconds ?? 300);
  if (!lastHeartbeat) {
    return false;
  }
  return Date.now() - new Date(lastHeartbeat).getTime() <= threshold * 1000;
}

export function DeviceCard({ device }: { device: Record<string, unknown> }) {
  const online = isOnline(device);

  return (
    <Card withBorder radius="sm" padding="lg">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{String(device.name ?? 'Unnamed device')}</Text>
          <Badge color={online ? 'green' : 'red'} variant="light">
            {online ? 'Online' : 'Offline'}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Hostname: {String(device.hostname ?? 'Not reported')}
        </Text>
        <Text size="sm" c="dimmed">
          Agent: {String(device.agent_version ?? 'Not registered')}
        </Text>
        <Text size="sm" c="dimmed">
          Last heartbeat: {String(device.last_heartbeat_at ?? 'Never')}
        </Text>
      </Stack>
    </Card>
  );
}
