import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { LoginPage } from './LoginPage';
import { renderWithMantine } from '../test-utils';

describe('LoginPage', () => {
  it('submits password', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    renderWithMantine(<LoginPage error={null} onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText('Admin password'), {
      target: { value: 'secret' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Sign in'));
    });

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('secret'));
  });

  it('renders an error', () => {
    renderWithMantine(<LoginPage error="Bad password" onLogin={vi.fn()} />);
    expect(screen.getByText('Bad password')).toBeInTheDocument();
  });
});
