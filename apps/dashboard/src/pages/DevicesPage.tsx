import { Alert, Button, Group, Modal, NumberInput, Stack, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { createDevice } from '../lib/api';
import { DeviceCard } from '../components/DeviceCard';

export function normalizeNumberInputValue(value: string | number): number | '' {
  return typeof value === 'number' ? value : '';
}

export function DevicesPage({
  devices,
  onCreated,
}: {
  devices: Array<Record<string, unknown>>;
  onCreated: () => Promise<void>;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState('home-mini-pc');
  const [intervalSeconds, setIntervalSeconds] = useState<number | ''>(60);
  const [thresholdSeconds, setThresholdSeconds] = useState<number | ''>(300);
  const [installCommand, setInstallCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const response = await createDevice({
        name,
        heartbeatIntervalSeconds: Number(intervalSeconds),
        missedHeartbeatThresholdSeconds: Number(thresholdSeconds),
      });
      setInstallCommand(String(response.installCommand ?? ''));
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device');
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button onClick={open}>Add device</Button>
      </Group>

      {installCommand ? (
        <Alert color="green" title="Install command ready">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{installCommand}</pre>
        </Alert>
      ) : null}

      <Stack gap="sm">
        {devices.map((device) => (
          <DeviceCard key={String(device.id)} device={device} />
        ))}
      </Stack>

      <Modal opened={opened} onClose={close} title="Create device" centered>
        <Stack gap="md">
          {error ? <Alert color="red">{error}</Alert> : null}
          <TextInput label="Device name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <NumberInput
            label="Heartbeat interval (seconds)"
            value={intervalSeconds}
            onChange={(value) => setIntervalSeconds(normalizeNumberInputValue(value))}
            min={30}
          />
          <NumberInput
            label="Missed heartbeat threshold (seconds)"
            value={thresholdSeconds}
            onChange={(value) => setThresholdSeconds(normalizeNumberInputValue(value))}
            min={60}
          />
          <Button
            onClick={() => {
              void submit();
            }}
          >
            Create
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
