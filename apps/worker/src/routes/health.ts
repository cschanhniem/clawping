import { json } from '../util';

export function handleHealth(): Response {
  return json({
    ok: true,
    service: 'clawping-worker',
    timestamp: new Date().toISOString(),
  });
}
