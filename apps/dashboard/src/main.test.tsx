import { describe, expect, it, vi } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
  createRoot: createRootMock,
}));

vi.mock('./App', () => ({
  default: () => null,
}));

describe('dashboard entrypoint', () => {
  it('mounts the react app', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');
    expect(createRootMock).toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalled();
  });
});
