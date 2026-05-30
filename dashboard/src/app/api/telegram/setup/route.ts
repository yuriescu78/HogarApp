/**
 * GET /api/telegram/setup
 * Registers the Telegram webhook for this deployment. Call once after deploy.
 * Protected by TELEGRAM_WEBHOOK_SECRET (same secret Telegram uses to sign updates).
 *
 * Usage:
 *   curl "https://<your-domain>/api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>"
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const token      = process.env.TELEGRAM_BOT_TOKEN!;
  const webhookUrl = `${new URL(req.url).origin}/api/telegram`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      url:          webhookUrl,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
    }),
  });

  const data = await res.json() as { ok: boolean; description?: string };
  if (!data.ok) {
    return Response.json({ ok: false, error: data.description }, { status: 500 });
  }

  return Response.json({ ok: true, webhook: webhookUrl });
}
