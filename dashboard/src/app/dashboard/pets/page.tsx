import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function PetsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: pets } = await admin
    .from('pets')
    .select('id, name, species, breed, birth_date')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('name', { ascending: true });

  const list = pets ?? [];

  // Fetch last 3 diary entries per pet in one query
  const { data: diary } = await admin
    .from('pet_diary')
    .select('id, pet_id, entry, category, created_at')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('created_at', { ascending: false })
    .limit(30);

  const diaryByPet = new Map<string, typeof diary>();
  for (const entry of diary ?? []) {
    const existing = diaryByPet.get(entry.pet_id) ?? [];
    if (existing.length < 3) {
      existing.push(entry);
      diaryByPet.set(entry.pet_id, existing);
    }
  }

  const tz = 'Europe/Madrid';

  const categoryEmoji: Record<string, string> = {
    salud: '🩺', alimentación: '🍖', comportamiento: '🐾', vacuna: '💉', visita: '🏥',
  };

  return (
    <div className="pg-app">
      <header className="pg-header">
        <div className="pg-family-row">
          <div className="pg-avatar" aria-hidden="true">G</div>
          <span className="pg-family-name">Familia García</span>
        </div>
        <h1 className="pg-title">Mascotas</h1>
        {list.length > 0 && (
          <p className="pg-subtitle">{list.length} mascota{list.length !== 1 ? 's' : ''}</p>
        )}
      </header>

      <main className="pg-main">
        {list.length === 0 ? (
          <p className="pg-empty">
            <strong>Sin mascotas registradas</strong>
            Dile a JARVIS "registra a mi mascota…" para añadir una.
          </p>
        ) : (
          list.map(pet => {
            const entries = diaryByPet.get(pet.id) ?? [];
            const age = pet.birth_date
              ? Math.floor((Date.now() - new Date(pet.birth_date as string).getTime()) / (365.25 * 24 * 3600 * 1000))
              : null;

            return (
              <section key={pet.id} className="pg-recipe-card" style={{ gap: '14px' }}>
                {/* Pet header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-sub)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0,
                  }}>
                    {pet.species === 'perro' ? '🐶' : pet.species === 'gato' ? '🐱' : '🐾'}
                  </div>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {pet.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {pet.breed ? `${pet.breed} · ` : ''}{pet.species}
                      {age !== null ? ` · ${age} año${age !== 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                </div>

                {/* Diary */}
                {entries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p className="pg-section-label" style={{ padding: 0, paddingBottom: '2px' }}>Diario reciente</p>
                    {entries.map(e => (
                      <div key={e.id} style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: '4px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {e.category && (
                            <span style={{ fontSize: '14px' }}>
                              {categoryEmoji[e.category.toLowerCase()] ?? '📋'}
                            </span>
                          )}
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{e.entry}</span>
                        </div>
                        <time style={{ fontSize: '11px', color: 'var(--text-tertiary)' }} dateTime={e.created_at ?? undefined}>
                          {e.created_at
                            ? new Date(e.created_at).toLocaleDateString('es-ES', {
                                day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
                              })
                            : null}
                        </time>
                      </div>
                    ))}
                  </div>
                )}

                {entries.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sin entradas en el diario.</p>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
