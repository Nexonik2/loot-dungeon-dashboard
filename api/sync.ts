import { timingSafeEqual } from 'node:crypto';
import { runFullSync } from '../server/sync.ts';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

async function handleSync(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: 'CRON_SECRET is not configured on the server' },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runFullSync();
    return Response.json({ ok: true, ...summary }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('[api/sync] failed:', err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleSync(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleSync(request);
}