import { Alert, Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { CheckItem } from '../components/CheckItem';
import { createCheck } from '../lib/api';

export function ChecksPage({
  checks,
  onCreated,
}: {
  checks: Array<Record<string, unknown>>;
  onCreated: () => Promise<void>;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>('http');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await createCheck({
        name,
        type,
        target,
        source: 'cloud',
        configJson: '{}',
      });
      close();
      setName('');
      setTarget('');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create check');
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button onClick={open}>Add cloud check</Button>
      </Group>

      <Stack gap="sm">
        {checks.map((check) => (
          <CheckItem key={String(check.id)} check={check} />
        ))}
      </Stack>

      <Modal opened={opened} onClose={close} title="Create cloud check" centered>
        <Stack gap="md">
          {error ? <Alert color="red">{error}</Alert> : null}
          <TextInput label="Check name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <Select
            label="Check type"
            data={[
              { value: 'http', label: 'HTTP/S URL' },
              { value: 'dns', label: 'DNS Resolve' },
              { value: 'tls_expiry', label: 'TLS Expiry' },
            ]}
            value={type}
            onChange={setType}
          />
          <TextInput label="Target" value={target} onChange={(event) => setTarget(event.currentTarget.value)} />
          <Button
            onClick={() => {
              void submit();
            }}
          >
            Save check
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
