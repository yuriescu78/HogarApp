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
  const checked = items?.filter(i =>  i.checked) ?? [];

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Lista de la compra</h1>
        {checked.length > 0 && (
          <form action={clearChecked}>
            <button type="submit" className="text-sm text-gray-500 hover:text-red-500 underline">
              Limpiar comprados ({checked.length})
            </button>
          </form>
        )}
      </div>

      {pending.length === 0 && checked.length === 0 && (
        <p className="text-gray-400">Lista vacía. Pídele a JARVIS que añada algo.</p>
      )}

      <ul className="space-y-2">
        {pending.map(item => (
          <li key={item.id} className="flex items-center gap-3 border rounded px-4 py-3">
            <form action={toggleItem.bind(null, item.id, true)}>
              <button type="submit"
                className="w-5 h-5 rounded border border-gray-300 hover:border-black flex-shrink-0" />
            </form>
            <span className="flex-1">{item.name}</span>
            {item.quantity && <span className="text-gray-400 text-sm">{item.quantity}</span>}
          </li>
        ))}
        {checked.map(item => (
          <li key={item.id} className="flex items-center gap-3 border rounded px-4 py-3 opacity-50">
            <form action={toggleItem.bind(null, item.id, false)}>
              <button type="submit"
                className="w-5 h-5 rounded border border-gray-400 bg-gray-400 flex-shrink-0" />
            </form>
            <span className="flex-1 line-through">{item.name}</span>
            {item.quantity && <span className="text-gray-400 text-sm">{item.quantity}</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
