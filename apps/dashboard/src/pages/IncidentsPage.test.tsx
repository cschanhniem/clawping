import { screen } from '@testing-library/react';
import { IncidentsPage } from './IncidentsPage';
import { renderWithMantine } from '../test-utils';

describe('IncidentsPage', () => {
  it('renders incidents', () => {
    renderWithMantine(
      <IncidentsPage
        incidents={[
          {
            id: '1',
            title: 'Offline',
            message: 'Down',
            opened_at: '2026-05-17T10:00:00Z',
            recovered_at: null,
          },
        ]}
      />,
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
