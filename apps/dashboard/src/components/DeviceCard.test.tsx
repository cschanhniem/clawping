import { screen } from '@testing-library/react';
import { DeviceCard } from './DeviceCard';
import { renderWithMantine } from '../test-utils';

describe('DeviceCard', () => {
  it('renders online device details', () => {
    renderWithMantine(
      <DeviceCard
        device={{
          name: 'home-mini-pc',
          hostname: 'mini.local',
          agent_version: '0.1.0',
          last_heartbeat_at: new Date().toISOString(),
          missed_heartbeat_threshold_seconds: 300,
        }}
      />,
    );

    expect(screen.getByText('home-mini-pc')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders offline state when heartbeat is stale', () => {
    renderWithMantine(
      <DeviceCard
        device={{
          name: 'nas-box',
          hostname: 'nas.local',
          agent_version: '0.1.0',
          last_heartbeat_at: '2020-01-01T00:00:00Z',
          missed_heartbeat_threshold_seconds: 60,
        }}
      />,
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders fallback values for an unregistered device', () => {
    renderWithMantine(<DeviceCard device={{}} />);

    expect(screen.getByText('Unnamed device')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText(/Hostname: Not reported/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent: Not registered/i)).toBeInTheDocument();
    expect(screen.getByText(/Last heartbeat: Never/i)).toBeInTheDocument();
  });
});
