import { fireEvent, screen, waitFor } from '@testing-library/react';
import { DevicesPage, normalizeNumberInputValue } from './DevicesPage';
import { renderWithMantine } from '../test-utils';

vi.mock('../lib/api', () => ({
  createDevice: vi.fn().mockResolvedValue({
    installCommand: 'curl -fsSL https://example.com/install.sh | sh',
  }),
}));

describe('DevicesPage', () => {
  it('renders devices and creates a device', async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    renderWithMantine(
      <DevicesPage
        devices={[
          {
            id: '1',
            name: 'home-mini-pc',
            hostname: 'mini.local',
            agent_version: '0.1.0',
            last_heartbeat_at: new Date().toISOString(),
            missed_heartbeat_threshold_seconds: 300,
          },
        ]}
        onCreated={onCreated}
      />,
    );

    expect(screen.getByText('home-mini-pc')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add device'));
    await waitFor(() => expect(screen.getByText('Create device')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Heartbeat interval (seconds)'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Missed heartbeat threshold (seconds)'), { target: { value: '360' } });
    fireEvent.click(screen.getByText('Create'));

    expect(await screen.findByText(/Install command ready/i)).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows device creation errors for Error and non-Error failures', async () => {
    const api = await import('../lib/api');
    const onCreated = vi.fn().mockResolvedValue(undefined);

    vi.mocked(api.createDevice).mockRejectedValueOnce(new Error('Device already exists'));
    renderWithMantine(<DevicesPage devices={[]} onCreated={onCreated} />);
    fireEvent.click(screen.getByText('Add device'));
    await waitFor(() => expect(screen.getByText('Create device')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create'));
    expect(await screen.findByText('Device already exists')).toBeInTheDocument();

    vi.mocked(api.createDevice).mockRejectedValueOnce('boom');
    fireEvent.click(screen.getByText('Create'));
    expect(await screen.findByText('Failed to create device')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('handles successful creation without an install command', async () => {
    const api = await import('../lib/api');
    const onCreated = vi.fn().mockResolvedValue(undefined);
    vi.mocked(api.createDevice).mockResolvedValueOnce({} as never);

    renderWithMantine(<DevicesPage devices={[]} onCreated={onCreated} />);
    fireEvent.click(screen.getByText('Add device'));
    await waitFor(() => expect(screen.getByText('Create device')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Device name'), { target: { value: 'tiny-box' } });
    fireEvent.change(screen.getByLabelText('Heartbeat interval (seconds)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Missed heartbeat threshold (seconds)'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(screen.queryByText(/Install command ready/i)).not.toBeInTheDocument();
  });

  it('normalizes numeric and empty values from Mantine number inputs', () => {
    expect(normalizeNumberInputValue(90)).toBe(90);
    expect(normalizeNumberInputValue('')).toBe('');
  });
});
