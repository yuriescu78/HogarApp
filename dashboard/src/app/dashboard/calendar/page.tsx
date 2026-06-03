import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const now   = new Date().toISOString();
  const until = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const { data: events } = await admin
    .from('calendar_events')
    .select('id, title, start_time, end_time, all_day, description')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .gte('start_time', now)
    .lte('start_time', until)
    .order('start_time', { ascending: true })
    .limit(20);

  const tz     = 'Europe/Madrid';
  const locale = 'es-ES';

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Agenda — próximos 30 días</h1>

      {!events?.length ? (
        <p className="text-gray-400">Sin eventos próximos. Dile a JARVIS que añada uno.</p>
      ) : (
        <ul className="space-y-3">
          {events.map(event => {
            const date    = new Date(event.start_time);
            const dateStr = event.all_day
              ? date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
              : date.toLocaleString(locale,     { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz });
            return (
              <li key={event.id} className="border rounded px-4 py-3">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-gray-500 mt-1">{dateStr}</p>
                {event.description && (
                  <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
