import { Badge, Card, Grid, Group, Stack, Text } from '@mantine/core';
import type { DashboardOverview } from '../lib/api';

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card withBorder radius="sm" padding="lg">
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Group justify="space-between">
          <Text fw={700} size="xl">
            {value}
          </Text>
          <Badge color={color} variant="light">
            Live
          </Badge>
        </Group>
      </Stack>
    </Card>
  );
}

export function StatusPage({ overview }: { overview: DashboardOverview | null }) {
  if (!overview) {
    return null;
  }

  return (
    <Stack gap="md">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatCard label="Devices Online" value={overview.devicesOnline} color="green" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatCard label="Devices Offline" value={overview.devicesOffline} color="red" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatCard label="Active Incidents" value={overview.activeIncidents} color="orange" />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <StatCard label="Warnings" value={overview.warnings} color="yellow" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <StatCard label="Critical" value={overview.critical} color="red" />
        </Grid.Col>
      </Grid>
      <Card withBorder radius="sm" padding="lg">
        <Text fw={600}>Last sweep</Text>
        <Text c="dimmed">{overview.lastSweepAt ?? 'Not yet recorded'}</Text>
      </Card>
    </Stack>
  );
}
