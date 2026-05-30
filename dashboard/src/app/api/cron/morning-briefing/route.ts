import { Api } from 'grammy';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';

async function buildBriefing(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<string> {
  const now          = new Date();
  const todayISO     = now.toISOString();
  const tomorrowISO  = new Date(now.getTime() + 86_400_000).toISOString();

  const [{ data: events }, { data: items }, { data: reminders }] = await Promise.all([
    supabase.from('calendar_events').select('title, start_time, all_day').eq('family_id', FAMILY_ID).gte('start_time', todayISO).lt('start_time', tomorrowISO).order('start_time', { ascending: true }),
    supabase.from('shopping_items').select('name, quantity').eq('family_id', FAMILY_ID).eq('checked', false).order('created_at', { ascending: true }).limit(8),
    supabase.from('event_reminders').select('remind_at, calendar_events(title)').eq('family_id', FAMILY_ID).eq('sent', false).gte('remind_at', todayISO).lt('remind_at', tomorrowISO).order('remind_at', { ascending: true }),
  ]);

  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE });
  const lines: string[] = [
    `🎩 Buenos días. *${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}.*`,
    '',
  ];

  if (events?.length) {
    lines.push('📅 *Agenda de hoy:*');
    for (const ev of events) {
      const time = ev.all_day ? 'Todo el día' : new Date(ev.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
      lines.push(`  • ${ev.title} — ${time}`);
    }
    lines.push('');
  } else {
    lines.push('📅 Día despejado, sin eventos programados.', '');
  }

  if (items?.length) {
    const count = items.length;
    lines.push(`🛒 *Lista de la compra* (${count} pendiente${count !== 1 ? 's' : ''}):`);
    for (const item of items.slice(0, 5)) {
      lines.push(`  • ${item.name}${item.quantity ? ` (${item.quantity})` : ''}`);
    }
    if (count > 5) lines.push(`  … y ${count - 5} más.`);
    lines.push('');
  }

  if (reminders?.length) {
    lines.push('🔔 *Recordatorios de hoy:*');
    for (const r of reminders) {
      const ev = (r as { calendar_events: { title: string } | null }).calendar_events;
      if (ev) lines.push(`  • ${ev.title}`);
    }
    lines.push('');
  }

  lines.push('Que tengan un buen día, señores García.');
  return lines.join('\n');
}

export async function GET(req: Request) {
  const auth = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const api      = new Api(process.env.TELEGRAM_BOT_TOKEN!);

  const { data: members } = await supabase
    .from('family_members')
    .select('telegram_id')
    .eq('family_id', FAMILY_ID)
    .eq('active', true)
    .not('telegram_id', 'is', null);

  if (!members?.length) return Response.json({ ok: true, sent: 0 });

  const text = await buildBriefing(supabase);
  let sent = 0;

  for (const m of members) {
    try { await api.sendMessage(m.telegram_id as number, text, { parse_mode: 'Markdown' }); sent++; }
    catch (err) { console.error('[morning-briefing] error sending to', m.telegram_id, err); }
  }

  return Response.json({ ok: true, sent });
}
