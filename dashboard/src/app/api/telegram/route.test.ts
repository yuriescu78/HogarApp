import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

vi.mock('grammy', () => {
  const handleUpdate = vi.fn().mockResolvedValue(undefined);
  class Bot {
    on           = vi.fn();
    handleUpdate = handleUpdate;
  }
  return { Bot };
});

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

vi.mock('@/lib/jarvis/tools',  () => ({ containsSensitiveData: vi.fn().mockReturnValue(false) }));
vi.mock('@/lib/jarvis/gemini', () => ({ runGeminiLoop: vi.fn().mockResolvedValue('ok') }));
vi.mock('openai', () => ({ default: vi.fn(), toFile: vi.fn() }));

import { POST } from './route';
import { waitUntil } from '@vercel/functions';

function makeRequest(body: unknown, secretHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secretHeader !== undefined) headers['X-Telegram-Bot-Api-Secret-Token'] = secretHeader;
  return new Request('https://example.com/api/telegram', {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
}

const validUpdate = { update_id: 1, message: { text: 'hola', from: { id: 123 } } };

describe('POST /api/telegram (webhook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.FAMILY_ID          = '00000000-0000-0000-0000-000000000000';
  });

  it('returns 200 ok:true when no secret is configured', async () => {
    const res  = await POST(makeRequest(validUpdate));
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns 401 when secret configured but header is missing', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'my-secret';
    const res  = await POST(makeRequest(validUpdate));
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it('returns 401 when secret header value does not match', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'my-secret';
    const res  = await POST(makeRequest(validUpdate, 'wrong-secret'));
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it('returns 200 ok:true when secret matches', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'my-secret';
    const res  = await POST(makeRequest(validUpdate, 'my-secret'));
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('calls waitUntil so Vercel keeps the function alive', async () => {
    await POST(makeRequest(validUpdate));
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it('returns 200 ok:false (not 500) when body is invalid JSON', async () => {
    const req = new Request('https://example.com/api/telegram', {
      method: 'POST',
      body:   'not json',
    });
    const res  = await POST(req);
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
  });
});
