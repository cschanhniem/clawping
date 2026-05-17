import { fireEvent, screen } from '@testing-library/react';
import { Layout } from './Layout';
import { renderWithMantine } from '../test-utils';

describe('Layout', () => {
  it('renders navigation and calls handlers', () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();

    renderWithMantine(
      <Layout
        title="Operations Dashboard"
        subtitle="Configure devices."
        page="status"
        onNavigate={onNavigate}
        onLogout={onLogout}
      >
        <div>Body</div>
      </Layout>,
    );

    fireEvent.click(screen.getByText('Devices'));
    fireEvent.click(screen.getByText('Logout'));

    expect(onNavigate).toHaveBeenCalledWith('devices');
    expect(onLogout).toHaveBeenCalled();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});
