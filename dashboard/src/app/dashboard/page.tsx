import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();

  const [{ data: items }, { data: events }, { data: notes }] = await Promise.all([
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
    admin
      .from('notes')
      .select('id, title, content, created_at')
      .eq('family_id', process.env.FAMILY_ID ?? '')
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const tz = 'Europe/Madrid';

  return (
    <div className="pg-app">
      <header className="pg-header">
        <div className="pg-family-row">
          <div className="pg-avatar" aria-hidden="true">G</div>
          <span className="pg-family-name">Familia García</span>
        </div>
        <h1 className="pg-title">Panel familiar</h1>
      </header>

      <main className="pg-main">

        {/* Compra */}
        <section>
          <div className="pg-home-section-header">
            <h2 className="pg-home-section-title">🛒 La compra</h2>
            <Link href="/dashboard/shopping" className="pg-home-link">Ver todo →</Link>
          </div>
          {!items?.length ? (
            <p className="pg-home-empty">Lista vacía.</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="pg-home-item">
                <span style={{ flex: 1 }}>{item.name}</span>
                {item.quantity && <span className="pg-home-item-meta">{item.quantity}</span>}
              </div>
            ))
          )}
        </section>

        {/* Agenda */}
        <section>
          <div className="pg-home-section-header">
            <h2 className="pg-home-section-title">📅 Próximos eventos</h2>
            <Link href="/dashboard/calendar" className="pg-home-link">Ver todo →</Link>
          </div>
          {!events?.length ? (
            <p className="pg-home-empty">Sin eventos próximos.</p>
          ) : (
            events.map(event => (
              <div key={event.id} className="pg-home-item">
                <span style={{ flex: 1 }}>{event.title}</span>
                <span className="pg-home-item-meta">
                  {new Date(event.start_time).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', timeZone: tz,
                  })}
                </span>
              </div>
            ))
          )}
        </section>

        {/* Notas recientes */}
        <section>
          <div className="pg-home-section-header">
            <h2 className="pg-home-section-title">📝 Notas recientes</h2>
            <Link href="/dashboard/notes" className="pg-home-link">Ver todo →</Link>
          </div>
          {!notes?.length ? (
            <p className="pg-home-empty">Sin notas aún.</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="pg-home-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '4px' }}>
                {note.title && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{note.title}</span>
                )}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {note.content}
                </span>
              </div>
            ))
          )}
        </section>

      </main>
    </div>
  );
}
