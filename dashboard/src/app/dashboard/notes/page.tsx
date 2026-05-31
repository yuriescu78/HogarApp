import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function NotesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: notes } = await admin
    .from('notes')
    .select('id, title, content, created_at')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('created_at', { ascending: false })
    .limit(50);

  const list = notes ?? [];

  return (
    <div className="pg-app">
      <header className="pg-header">
        <div className="pg-family-row">
          <div className="pg-avatar" aria-hidden="true">G</div>
          <span className="pg-family-name">Familia García</span>
        </div>
        <h1 className="pg-title">Bitácora</h1>
        {list.length > 0 && (
          <p className="pg-subtitle">{list.length} nota{list.length !== 1 ? 's' : ''}</p>
        )}
      </header>

      <main className="pg-main">
        {list.length === 0 ? (
          <p className="pg-empty">
            <strong>Sin notas aún</strong>
            Dile a JARVIS &ldquo;anota que…&rdquo; para guardar algo aquí.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}
              role="list">
            {list.map(note => (
              <li key={note.id} className="pg-note-card">
                {note.title && <div className="pg-note-title">{note.title}</div>}
                <div className="pg-note-content">{note.content}</div>
                <time className="pg-note-date" dateTime={note.created_at ?? undefined}>
                  {note.created_at
                    ? new Date(note.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        timeZone: 'Europe/Madrid',
                      })
                    : null}
                </time>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
