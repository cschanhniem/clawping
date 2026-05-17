import { Badge, Card, Group, Stack, Text } from '@mantine/core';

export function IncidentItem({ incident }: { incident: Record<string, unknown> }) {
  const open = !incident.recovered_at;

  return (
    <Card withBorder radius="sm" padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text fw={600}>{String(incident.title ?? 'Untitled incident')}</Text>
          <Text size="sm" c="dimmed">
            {String(incident.message ?? '')}
          </Text>
          <Text size="sm" c="dimmed">
            Opened: {String(incident.opened_at ?? 'Unknown')}
          </Text>
          <Text size="sm" c="dimmed">
            Recovered: {String(incident.recovered_at ?? 'Still open')}
          </Text>
        </Stack>
        <Badge color={open ? 'red' : 'green'} variant="light">
          {open ? 'Open' : 'Recovered'}
        </Badge>
      </Group>
    </Card>
  );
}
