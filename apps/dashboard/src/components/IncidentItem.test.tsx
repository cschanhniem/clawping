import { screen } from '@testing-library/react';
import { IncidentItem } from './IncidentItem';
import { renderWithMantine } from '../test-utils';

describe('IncidentItem', () => {
  it('renders open incident', () => {
    renderWithMantine(
      <IncidentItem
        incident={{
          title: 'home-mini-pc stopped checking in',
          message: 'Last heartbeat was 5 minutes ago',
          opened_at: '2026-05-17T10:00:00Z',
          recovered_at: null,
        }}
      />,
    );

    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders recovered incident', () => {
    renderWithMantine(
      <IncidentItem
        incident={{
          title: 'Immich recovered',
          message: 'Recovered successfully',
          opened_at: '2026-05-17T10:00:00Z',
          recovered_at: '2026-05-17T10:10:00Z',
        }}
      />,
    );

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('renders fallback incident copy', () => {
    renderWithMantine(<IncidentItem incident={{}} />);

    expect(screen.getByText('Untitled incident')).toBeInTheDocument();
    expect(screen.getByText('Recovered: Still open')).toBeInTheDocument();
    expect(screen.getByText('Opened: Unknown')).toBeInTheDocument();
  });
});
