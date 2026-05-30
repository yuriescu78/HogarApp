import { Api } from 'grammy';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';

async function getActiveTelegramIds(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<number[]> {
  const { data } = await supabase
    .from('family_members')
    .select('telegram_id')
    .eq('family_id', FAMILY_ID)
    .eq('active', true)
    .not('telegram_id', 'is', null);
  return (data ?? []).map(m => m.telegram_id as number);
}

export async function GET(req: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const api      = new Api(process.env.TELEGRAM_BOT_TOKEN!);
  const now      = new Date().toISOString();

  const [{ data: eventReminders }, { data: petReminders }] = await Promise.all([
    supabase
      .from('event_reminders')
      .select('id, event_id, calendar_events(title, start_time)')
      .eq('family_id', FAMILY_ID)
      .eq('sent', false)
      .lte('remind_at', now),
    supabase
      .from('pet_reminders')
      .select('id, title, pets(name)')
      .eq('family_id', FAMILY_ID)
      .eq('sent', false)
      .lte('remind_at', now),
  ]);

  if (!eventReminders?.length && !petReminders?.length) {
    return Response.json({ ok: true, sent: 0 });
  }

  const telegramIds = await getActiveTelegramIds(supabase);
  if (!telegramIds.length) return Response.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const reminder of eventReminders ?? []) {
    const event = (reminder as { calendar_events: { title: string; start_time: string } | null }).calendar_events;
    if (!event) continue;

    const dateStr = new Date(event.start_time).toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE,
    });

    const text = `🔔 Recordatorio: *${event.title}*\n📅 ${dateStr}`;
    for (const chatId of telegramIds) {
      try { await api.sendMessage(chatId, text, { parse_mode: 'Markdown' }); sent++; }
      catch (err) { console.error(`[reminders] event error chatId=${chatId}:`, err); }
    }
    await supabase.from('event_reminders').update({ sent: true }).eq('id', reminder.id);
  }

  for (const reminder of petReminders ?? []) {
    const pet  = (reminder as { pets: { name: string } | null }).pets;
    const text = `🐾 Recordatorio de *${pet?.name ?? 'tu mascota'}*: ${reminder.title}`;
    for (const chatId of telegramIds) {
      try { await api.sendMessage(chatId, text, { parse_mode: 'Markdown' }); sent++; }
      catch (err) { console.error(`[reminders] pet error chatId=${chatId}:`, err); }
    }
    await supabase.from('pet_reminders').update({ sent: true }).eq('id', reminder.id);
  }

  return Response.json({ ok: true, sent });
}
