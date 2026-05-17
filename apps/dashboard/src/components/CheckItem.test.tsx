import { screen } from '@testing-library/react';
import { CheckItem } from './CheckItem';
import { renderWithMantine } from '../test-utils';

describe('CheckItem', () => {
  it('renders check metadata', () => {
    renderWithMantine(
      <CheckItem
        check={{
          name: 'Homepage',
          type: 'http',
          source: 'cloud',
          target: 'https://example.com',
          enabled: 1,
        }}
      />,
    );

    expect(screen.getByText('Homepage')).toBeInTheDocument();
    expect(screen.getByText(/^http · cloud$/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/example.com/i)).toBeInTheDocument();
  });

  it('renders fallback values and disabled state', () => {
    renderWithMantine(<CheckItem check={{ enabled: 0 }} />);

    expect(screen.getByText('Unnamed check')).toBeInTheDocument();
    expect(screen.getByText(/^unknown · unknown$/)).toBeInTheDocument();
    expect(screen.getByText(/Target: n\/a/i)).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });
});
