import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';

interface DeviceStateRecord {
  incidentOpen: boolean;
  lastNotificationAt: string | null;
  mutedUntil: string | null;
}

function plusHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export class DeviceState extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async readState(): Promise<DeviceStateRecord> {
    return (
      ((await this.ctx.storage.get<DeviceStateRecord>('state')) as DeviceStateRecord | undefined) ?? {
        incidentOpen: false,
        lastNotificationAt: null,
        mutedUntil: null,
      }
    );
  }

  private async writeState(state: DeviceStateRecord): Promise<void> {
    await this.ctx.storage.put('state', state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = await this.readState();
    const now = new Date();

    if (url.pathname === '/should-alert') {
      const shouldRecover = url.searchParams.get('recover') === '1';
      const muteUntil = state.mutedUntil ? new Date(state.mutedUntil) : null;
      if (muteUntil && muteUntil > now) {
        return Response.json({ send: false, mutedUntil: state.mutedUntil });
      }

      if (shouldRecover) {
        return Response.json({ send: state.incidentOpen });
      }

      if (!state.incidentOpen) {
        return Response.json({ send: true, reason: 'new_incident' });
      }

      if (!state.lastNotificationAt) {
        return Response.json({ send: true, reason: 'missing_notification_marker' });
      }

      const last = new Date(state.lastNotificationAt);
      const nextReminder = last > plusHours(new Date(0), 0) ? plusHours(last, 6) : plusHours(now, 1);
      return Response.json({ send: nextReminder <= now, reason: 'reminder' });
    }

    if (url.pathname === '/mark-open') {
      const nextState = {
        ...state,
        incidentOpen: true,
        lastNotificationAt: new Date().toISOString(),
      };
      await this.writeState(nextState);
      return Response.json(nextState);
    }

    if (url.pathname === '/recover') {
      const nextState = {
        ...state,
        incidentOpen: false,
        lastNotificationAt: new Date().toISOString(),
      };
      await this.writeState(nextState);
      return Response.json(nextState);
    }

    if (url.pathname === '/mute' && request.method === 'POST') {
      const body = (await request.json()) as { mutedUntil: string };
      const nextState = { ...state, mutedUntil: body.mutedUntil };
      await this.writeState(nextState);
      return Response.json(nextState);
    }

    return Response.json(state);
  }
}
