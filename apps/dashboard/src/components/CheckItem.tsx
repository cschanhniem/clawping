import { Badge, Card, Group, Stack, Text } from '@mantine/core';

export function CheckItem({ check }: { check: Record<string, unknown> }) {
  return (
    <Card withBorder radius="sm" padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text fw={600}>{String(check.name ?? 'Unnamed check')}</Text>
          <Text size="sm" c="dimmed">
            {String(check.type ?? 'unknown')} · {String(check.source ?? 'unknown')}
          </Text>
          <Text size="sm" c="dimmed">
            Target: {String(check.target ?? 'n/a')}
          </Text>
        </Stack>
        <Badge variant="light">{String(check.enabled ? 'Enabled' : 'Disabled')}</Badge>
      </Group>
    </Card>
  );
}
