import cron from 'node-cron';
import type { Api } from 'grammy';
import { supabase } from '../utils/supabase.js';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';

async function getActiveTelegramIds(): Promise<number[]> {
  const { data } = await supabase
    .from('family_members')
    .select('telegram_id')
    .eq('family_id', FAMILY_ID)
    .eq('active', true)
    .not('telegram_id', 'is', null);
  return (data ?? []).map(m => m.telegram_id as number);
}

async function dispatchEventReminders(api: Api): Promise<void> {
  const now = new Date().toISOString();

  const { data: reminders } = await supabase
    .from('event_reminders')
    .select('id, event_id, calendar_events(title, start_time)')
    .eq('family_id', FAMILY_ID)
    .eq('sent', false)
    .lte('remind_at', now);

  if (!reminders?.length) return;

  const telegramIds = await getActiveTelegramIds();
  if (!telegramIds.length) return;

  for (const reminder of reminders) {
    const event = (reminder as { calendar_events: { title: string; start_time: string } | null }).calendar_events;
    if (!event) continue;

    const dateStr = new Date(event.start_time).toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
      timeZone: TIMEZONE,
    });

    const text = `🔔 Recordatorio: *${event.title}*\n📅 ${dateStr}`;

    for (const chatId of telegramIds) {
      try {
        await api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(`[reminder] Error sending to ${chatId}:`, err);
      }
    }

    await supabase
      .from('event_reminders')
      .update({ sent: true })
      .eq('id', reminder.id);
  }
}

async function dispatchPetReminders(api: Api): Promise<void> {
  const now = new Date().toISOString();

  const { data: reminders } = await supabase
    .from('pet_reminders')
    .select('id, title, pets(name)')
    .eq('family_id', FAMILY_ID)
    .eq('sent', false)
    .lte('remind_at', now);

  if (!reminders?.length) return;

  const telegramIds = await getActiveTelegramIds();
  if (!telegramIds.length) return;

  for (const reminder of reminders) {
    const pet = (reminder as { pets: { name: string } | null }).pets;
    const petName = pet?.name ?? 'tu mascota';
    const text = `🐾 Recordatorio de *${petName}*: ${reminder.title}`;

    for (const chatId of telegramIds) {
      try {
        await api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(`[reminder] Error sending to ${chatId}:`, err);
      }
    }

    await supabase
      .from('pet_reminders')
      .update({ sent: true })
      .eq('id', reminder.id);
  }
}

export function startReminderDispatcher(api: Api): void {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await Promise.all([
        dispatchEventReminders(api),
        dispatchPetReminders(api),
      ]);
    } catch (err) {
      console.error('[reminder-dispatcher] Error:', err);
    }
  }, { timezone: TIMEZONE });

  console.log('[cron] Reminder dispatcher started (every 5 min)');
}
