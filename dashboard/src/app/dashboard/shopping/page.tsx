import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { toggleItem, clearChecked } from './actions';

export default async function ShoppingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: items } = await admin
    .from('shopping_items')
    .select('id, name, quantity, checked')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('checked', { ascending: true })
    .order('created_at', { ascending: true });

  const pending = items?.filter(i => !i.checked) ?? [];
  const done    = items?.filter(i =>  i.checked) ?? [];

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Header sticky iOS-style */}
      <header
        className="sticky top-0 px-5 pb-4 pt-10"
        style={{
          background: 'rgba(15,15,17,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6e40c9, #c940a0)' }}
          >
            G
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Familia García
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          La compra
        </h1>

        <div className="flex gap-2 mt-1.5">
          {pending.length > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: 'var(--red)' }}
            >
              {pending.length} pendientes
            </span>
          )}
          {done.length > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: 'var(--green)' }}
            >
              {done.length} comprados
            </span>
          )}
        </div>
      </header>

      {/* Contenido */}
      <div className="px-4 py-5 space-y-6">

        {/* Lista vacía */}
        {pending.length === 0 && done.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Lista vacía. Dile a JARVIS por Telegram qué añadir.
          </p>
        )}

        {/* Pendientes */}
        {pending.length > 0 && (
          <section>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Pendientes
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {pending.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 px-4 py-3.5"
                  style={idx > 0 ? { borderTop: '0.5px solid var(--border)' } : undefined}
                >
                  <form action={toggleItem.bind(null, item.id, true)}>
                    <button
                      type="submit"
                      className="w-6 h-6 rounded-full flex-shrink-0"
                      style={{ border: '2px solid #3a3a3c', background: 'transparent' }}
                      aria-label={`Marcar ${item.name} como comprado`}
                    />
                  </form>
                  <div className="flex-1 min-w-0">
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    {item.quantity && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comprados */}
        {done.length > 0 && (
          <section>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Ya en el carrito
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {done.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 px-4 py-3.5 opacity-40"
                  style={idx > 0 ? { borderTop: '0.5px solid var(--border)' } : undefined}
                >
                  <form action={toggleItem.bind(null, item.id, false)}>
                    <button
                      type="submit"
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: 'var(--green)', border: '2px solid var(--green)' }}
                      aria-label={`Desmarcar ${item.name}`}
                    >
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </form>
                  <div className="flex-1 min-w-0">
                    <p className="text-base line-through" style={{ color: 'var(--text-secondary)' }}>
                      {item.name}
                    </p>
                    {item.quantity && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form action={clearChecked} className="mt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--red)',
                }}
              >
                🗑 Limpiar {done.length} comprados
              </button>
            </form>
          </section>
        )}

        {/* Banner JARVIS */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, #2d1f6e, #4a1a5e)',
            border: '1px solid #3d2a7a',
          }}
        >
          <span className="text-2xl flex-shrink-0">🎩</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#c4a8ff' }}>
              JARVIS al habla
            </p>
            <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Dígame por Telegram qué añadir y lo tendré listo al instante.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
