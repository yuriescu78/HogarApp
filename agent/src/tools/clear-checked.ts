import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const clearCheckedItemsSchema = z.object({});

export type ClearCheckedItemsInput = z.infer<typeof clearCheckedItemsSchema>;

export async function clearCheckedItems(
  _input: ClearCheckedItemsInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; cleared: number } | { success: false; error: string }> {
  const { error, count } = await supabase
    .from('shopping_items')
    .delete()
    .eq('family_id', familyId)
    .eq('checked', true);

  if (error) return { success: false, error: error.message };
  return { success: true, cleared: count ?? 0 };
}

export const clearCheckedItemsDeclaration = {
  name:        'clear_checked_items',
  description: 'Elimina de la lista todos los artículos ya marcados como comprados.',
  parameters:  { type: 'OBJECT', properties: {}, required: [] },
};
