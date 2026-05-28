import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const queryShoppingItemsSchema = z.object({
  include_checked: z.boolean().optional().default(false),
  list_name:       z.string().optional().default('Lista principal'),
});

export type QueryShoppingItemsInput = z.input<typeof queryShoppingItemsSchema>;

type QueryResult =
  | { success: true;  items: { id: string; name: string; quantity: string | null; checked: boolean }[] }
  | { success: false; error: string };

export async function queryShoppingItems(
  input: QueryShoppingItemsInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<QueryResult> {
  let q = supabase
    .from('shopping_items')
    .select('id, name, quantity, checked')
    .eq('family_id', familyId);

  if (!input.include_checked) {
    q = q.eq('checked', false);
  }

  const { data, error } = await q
    .order('created_at', { ascending: true })
    .limit(30);
  if (error) return { success: false, error: error.message };
  return { success: true, items: data ?? [] };
}

export const queryShoppingItemsDeclaration = {
  name:        'query_shopping',
  description: 'Consulta los artículos de la lista de la compra.',
  parameters: {
    type: 'OBJECT',
    properties: {
      include_checked: {
        type:        'BOOLEAN',
        description: 'Si true, incluye artículos ya marcados como comprados. Por defecto false.',
      },
    },
    required: [],
  },
};
