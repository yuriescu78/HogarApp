import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const checkShoppingItemSchema = z.object({
  item_name: z.string().min(1),
  checked:   z.boolean().optional().default(true),
});

export type CheckShoppingItemInput = z.infer<typeof checkShoppingItemSchema>;

export async function checkShoppingItem(
  input: CheckShoppingItemInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { data: found } = await supabase
    .from('shopping_items')
    .select('id')
    .eq('family_id', familyId)
    .ilike('name', input.item_name)
    .limit(1);

  if (!found?.length) {
    return { success: false, error: `No encontré "${input.item_name}" en la lista.` };
  }

  const { error } = await supabase
    .from('shopping_items')
    .update({ checked: input.checked })
    .eq('id', found[0].id);

  if (error) return { success: false, error: error.message };

  const action = input.checked ? 'marcado como comprado' : 'desmarcado';
  return { success: true, message: `"${input.item_name}" ${action}.` };
}

export const checkShoppingItemDeclaration = {
  name:        'check_shopping_item',
  description: 'Marca o desmarca un artículo de la lista de la compra como comprado.',
  parameters: {
    type: 'OBJECT',
    properties: {
      item_name: { type: 'STRING', description: 'Nombre del artículo a marcar.' },
      checked:   { type: 'BOOLEAN', description: 'true para marcar comprado, false para desmarcar. Por defecto true.' },
    },
    required: ['item_name'],
  },
};
