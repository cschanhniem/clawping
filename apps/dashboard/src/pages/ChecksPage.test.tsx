import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ChecksPage } from './ChecksPage';
import { renderWithMantine } from '../test-utils';

vi.mock('../lib/api', () => ({
  createCheck: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('ChecksPage', () => {
  it('renders checks and creates a check', async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    renderWithMantine(
      <ChecksPage
        checks={[
          {
            id: '1',
            name: 'Homepage',
            type: 'http',
            source: 'cloud',
            target: 'https://example.com',
            enabled: 1,
          },
        ]}
        onCreated={onCreated}
      />,
    );

    expect(screen.getByText('Homepage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add cloud check'));
    await waitFor(() => expect(screen.getByText('Create cloud check')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Check name'), { target: { value: 'DNS' } });
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText('Save check'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('shows check creation errors for Error and non-Error failures', async () => {
    const api = await import('../lib/api');
    const onCreated = vi.fn().mockResolvedValue(undefined);

    vi.mocked(api.createCheck).mockRejectedValueOnce(new Error('Target is required'));
    renderWithMantine(<ChecksPage checks={[]} onCreated={onCreated} />);
    fireEvent.click(screen.getByText('Add cloud check'));
    await waitFor(() => expect(screen.getByText('Create cloud check')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Save check'));
    expect(await screen.findByText('Target is required')).toBeInTheDocument();

    vi.mocked(api.createCheck).mockRejectedValueOnce('boom');
    fireEvent.click(screen.getByText('Save check'));
    expect(await screen.findByText('Failed to create check')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
