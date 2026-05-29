import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();

  const [{ data: items }, { data: events }] = await Promise.all([
    admin
      .from('shopping_items')
      .select('id, name, quantity')
      .eq('family_id', process.env.FAMILY_ID ?? '')
      .eq('checked', false)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('calendar_events')
      .select('id, title, start_time')
      .eq('family_id', process.env.FAMILY_ID ?? '')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(3),
  ]);

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">JARVIS — Panel familiar</h1>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">Lista de la compra</h2>
          <Link href="/dashboard/shopping" className="text-sm text-gray-500 hover:underline">
            Ver todo →
          </Link>
        </div>
        {!items?.length ? (
          <p className="text-gray-400 text-sm">Lista vacía.</p>
        ) : (
          <ul className="space-y-1">
            {items.map(item => (
              <li key={item.id} className="flex gap-2 border rounded px-3 py-2 text-sm">
                <span className="flex-1">{item.name}</span>
                {item.quantity && <span className="text-gray-400">{item.quantity}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">Próximos eventos</h2>
          <Link href="/dashboard/calendar" className="text-sm text-gray-500 hover:underline">
            Ver todo →
          </Link>
        </div>
        {!events?.length ? (
          <p className="text-gray-400 text-sm">Sin eventos próximos.</p>
        ) : (
          <ul className="space-y-1">
            {events.map(event => (
              <li key={event.id} className="border rounded px-3 py-2 text-sm">
                <span className="font-medium">{event.title}</span>
                <span className="text-gray-400 ml-2">
                  {new Date(event.start_time).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', timeZone: 'Europe/Madrid',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
