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
  const isEmpty = pending.length === 0 && done.length === 0;

  return (
    <div className="sl-app">

      <header className="sl-header">
        <div className="sl-family-row">
          <div className="sl-avatar" aria-hidden="true">G</div>
          <span className="sl-family-name">Familia García</span>
        </div>

        <h1 className="sl-title">La compra</h1>

        <div className="sl-badges" role="status" aria-live="polite">
          {pending.length > 0 && (
            <span className="sl-badge sl-badge-pending">{pending.length} pendientes</span>
          )}
          {done.length > 0 && (
            <span className="sl-badge sl-badge-done">{done.length} comprados</span>
          )}
        </div>
      </header>

      <main className="sl-main">

        {isEmpty && (
          <p className="sl-empty">
            <strong>Lista vacía</strong>
            Dile a JARVIS por Telegram qué añadir.
          </p>
        )}

        {pending.length > 0 && (
          <section className="sl-section" aria-labelledby="lbl-pending">
            <h2 id="lbl-pending" className="sl-section-label">Pendientes</h2>
            <ul className="sl-card" role="list">
              {pending.map(item => (
                <li key={item.id} className="sl-item">
                  <form action={toggleItem.bind(null, item.id, true)} className="sl-form-inline">
                    <button
                      type="submit"
                      className="sl-check"
                      aria-label={`Marcar ${item.name} como comprado`}
                    />
                  </form>
                  <div className="sl-item-body">
                    <div className="sl-item-name">{item.name}</div>
                    {item.quantity && <div className="sl-item-qty">{item.quantity}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {done.length > 0 && (
          <section className="sl-section" aria-labelledby="lbl-done">
            <h2 id="lbl-done" className="sl-section-label">Ya en el carrito</h2>
            <ul className="sl-card" role="list">
              {done.map(item => (
                <li key={item.id} className="sl-item sl-item-done">
                  <form action={toggleItem.bind(null, item.id, false)} className="sl-form-inline">
                    <button
                      type="submit"
                      className="sl-check sl-check-done"
                      aria-label={`Desmarcar ${item.name}`}
                    >
                      <svg viewBox="0 0 12 10" fill="none" aria-hidden="true">
                        <path d="M1.5 5L4.5 7.5L10.5 1.5"
                              stroke="#fff" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </form>
                  <div className="sl-item-body">
                    <div className="sl-item-name">{item.name}</div>
                    {item.quantity && <div className="sl-item-qty">{item.quantity}</div>}
                  </div>
                </li>
              ))}
            </ul>

            <form action={clearChecked}>
              <button
                type="submit"
                className="sl-clear-btn"
                aria-label={`Limpiar ${done.length} artículos comprados`}
              >
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1.5 3.5h11M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M3 3.5l.6 8.4a1 1 0 001 .9h4.8a1 1 0 001-.9l.6-8.4"
                        stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Limpiar {done.length} comprados
              </button>
            </form>
          </section>
        )}

        <aside className="sl-jarvis" role="note">
          <div className="sl-jarvis-icon" aria-hidden="true">🎩</div>
          <div className="sl-jarvis-text">
            <strong>JARVIS al habla</strong>
            <span>Dígame por Telegram qué añadir y lo tendré listo al instante.</span>
          </div>
        </aside>

      </main>
    </div>
  );
}
