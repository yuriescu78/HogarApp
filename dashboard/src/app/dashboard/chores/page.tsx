import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ChoresPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: chores } = await admin
    .from('chores')
    .select('id, name, frequency, assigned_to')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('name', { ascending: true });

  // Last completion per chore
  const { data: logs } = await admin
    .from('chore_logs')
    .select('chore_id, completed_at')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('completed_at', { ascending: false });

  const lastDone = new Map<string, string>();
  for (const log of logs ?? []) {
    if (!lastDone.has(log.chore_id) && log.completed_at) lastDone.set(log.chore_id, log.completed_at);
  }

  const list = chores ?? [];
  const tz   = 'Europe/Madrid';

  return (
    <div className="pg-app">
      <header className="pg-header">
        <div className="pg-family-row">
          <div className="pg-avatar" aria-hidden="true">G</div>
          <span className="pg-family-name">Familia García</span>
        </div>
        <h1 className="pg-title">Tareas</h1>
        {list.length > 0 && (
          <p className="pg-subtitle">{list.length} tarea{list.length !== 1 ? 's' : ''} registradas</p>
        )}
      </header>

      <main className="pg-main">
        {list.length === 0 ? (
          <p className="pg-empty">
            <strong>Sin tareas aún</strong>
            Dile a JARVIS "añade la tarea de…" para crear una.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
              role="list">
            {list.map(chore => {
              const done = lastDone.get(chore.id);
              return (
                <li key={chore.id} className="pg-note-card" style={{ gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {chore.name}
                    </span>
                    {chore.frequency && (
                      <span className="pg-recipe-badge">{chore.frequency}</span>
                    )}
                  </div>
                  {done ? (
                    <span className="pg-note-date">
                      Última vez: {new Date(done).toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'long', timeZone: tz,
                      })}
                    </span>
                  ) : (
                    <span className="pg-note-date" style={{ color: 'var(--red)', opacity: .7 }}>
                      Pendiente
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
