import { screen } from '@testing-library/react';
import { StatusPage } from './StatusPage';
import { renderWithMantine } from '../test-utils';

describe('StatusPage', () => {
  it('renders overview metrics', () => {
    renderWithMantine(
      <StatusPage
        overview={{
          devicesOnline: 2,
          devicesOffline: 1,
          warnings: 3,
          critical: 1,
          activeIncidents: 2,
          lastSweepAt: '2026-05-17T10:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('Devices Online')).toBeInTheDocument();
    expect(screen.getByText('Active Incidents')).toBeInTheDocument();
    expect(screen.getByText('Last sweep')).toBeInTheDocument();
  });

  it('returns null for empty overview', () => {
    renderWithMantine(<StatusPage overview={null} />);
    expect(screen.queryByText('Devices Online')).not.toBeInTheDocument();
  });

  it('renders fallback text when the sweep timestamp is missing', () => {
    renderWithMantine(
      <StatusPage
        overview={{
          devicesOnline: 0,
          devicesOffline: 1,
          warnings: 0,
          critical: 0,
          activeIncidents: 1,
          lastSweepAt: null,
        }}
      />,
    );

    expect(screen.getByText('Not yet recorded')).toBeInTheDocument();
  });
});
