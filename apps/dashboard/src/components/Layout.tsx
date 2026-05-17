import {
  AppShell,
  Badge,
  Box,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconActivityHeartbeat,
  IconBell,
  IconDeviceDesktopAnalytics,
  IconListCheck,
  IconMessageCircle,
  IconShield,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';

type PageKey = 'status' | 'devices' | 'checks' | 'incidents' | 'telegram';

interface LayoutProps {
  title: string;
  subtitle: string;
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
  children: ReactNode;
}

const links: Array<{ page: PageKey; label: string; icon: ReactNode }> = [
  { page: 'status', label: 'Overview', icon: <IconActivityHeartbeat size={18} /> },
  { page: 'devices', label: 'Devices', icon: <IconDeviceDesktopAnalytics size={18} /> },
  { page: 'checks', label: 'Checks', icon: <IconListCheck size={18} /> },
  { page: 'incidents', label: 'Incidents', icon: <IconBell size={18} /> },
  { page: 'telegram', label: 'Telegram', icon: <IconMessageCircle size={18} /> },
];

export function Layout({ title, subtitle, page, onNavigate, onLogout, children }: LayoutProps) {
  return (
    <AppShell
      padding="md"
      navbar={{
        width: 260,
        breakpoint: 'sm',
      }}
    >
      <AppShell.Navbar p="md">
        <Stack gap="md">
          <Box>
            <Group justify="space-between" mb="xs">
              <Title order={3}>ClawPing</Title>
              <Badge variant="light" color="green">
                Workers-first
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Telegram-first watchdog for home servers.
            </Text>
          </Box>

          <Stack gap={6}>
            {links.map((link) => (
              <NavLink
                key={link.page}
                active={link.page === page}
                label={link.label}
                leftSection={link.icon}
                onClick={() => onNavigate(link.page)}
              />
            ))}
          </Stack>

          <Box mt="auto">
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <IconShield size={16} />
                <Text size="sm">Admin session</Text>
              </Group>
              <Button size="xs" variant="light" onClick={onLogout}>
                Logout
              </Button>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="lg">
          <Box>
            <Title order={2}>{title}</Title>
            <Text c="dimmed">{subtitle}</Text>
          </Box>
          {children}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
