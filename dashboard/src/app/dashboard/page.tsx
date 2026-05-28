import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: items } = await admin
    .from('shopping_items')
    .select('id, name, quantity, checked')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .eq('checked', false)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">JARVIS — Panel familiar</h1>
      <section>
        <h2 className="text-lg font-medium mb-3">Lista de la compra</h2>
        {!items?.length ? (
          <p className="text-gray-500">Lista vacía.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item.id} className="flex gap-2 border rounded px-3 py-2">
                <span className="flex-1">{item.name}</span>
                {item.quantity && (
                  <span className="text-gray-400 text-sm">{item.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
