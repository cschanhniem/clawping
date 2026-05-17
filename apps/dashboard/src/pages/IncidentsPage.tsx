import { Stack } from '@mantine/core';
import { IncidentItem } from '../components/IncidentItem';

export function IncidentsPage({ incidents }: { incidents: Array<Record<string, unknown>> }) {
  return (
    <Stack gap="sm">
      {incidents.map((incident) => (
        <IncidentItem key={String(incident.id)} incident={incident} />
      ))}
    </Stack>
  );
}
