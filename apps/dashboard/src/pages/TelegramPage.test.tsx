import { screen } from '@testing-library/react';
import { TelegramPage } from './TelegramPage';
import { renderWithMantine } from '../test-utils';

describe('TelegramPage', () => {
  it('renders setup guidance', () => {
    renderWithMantine(<TelegramPage />);
    expect(screen.getByText('Telegram webhook')).toBeInTheDocument();
    expect(screen.getByText(/Recommended setup flow/i)).toBeInTheDocument();
  });
});
