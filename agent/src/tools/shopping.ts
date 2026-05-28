import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addShoppingItemsSchema = z.object({
  items: z.array(
    z.object({
      name:     z.string().min(1),
      quantity: z.string().optional(),
    })
  ).min(1),
  list_name: z.string().optional().default('Lista principal'),
});

export type AddShoppingItemsInput = z.infer<typeof addShoppingItemsSchema>;

export async function addShoppingItems(
  input: AddShoppingItemsInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; added: number } | { success: false; error: string }> {
  let listId: string;

  const { data: existingList } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('family_id', familyId)
    .eq('name', input.list_name)
    .single();

  if (existingList) {
    listId = existingList.id;
  } else {
    const { data: newList, error: createError } = await supabase
      .from('shopping_lists')
      .insert({ family_id: familyId, name: input.list_name })
      .select('id')
      .single();
    if (createError || !newList) {
      return { success: false, error: createError?.message ?? 'Could not create list' };
    }
    listId = newList.id;
  }

  const rows = input.items.map(item => ({
    family_id: familyId,
    list_id:   listId,
    name:      item.name,
    quantity:  item.quantity ?? null,
  }));

  const { error } = await supabase.from('shopping_items').insert(rows);
  if (error) return { success: false, error: error.message };

  return { success: true, added: input.items.length };
}

export const addShoppingItemsDeclaration = {
  name:        'add_shopping_items',
  description: 'Añade uno o más artículos a la lista de la compra familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      items: {
        type: 'ARRAY',
        description: 'Lista de artículos a añadir',
        items: {
          type: 'OBJECT',
          properties: {
            name:     { type: 'STRING', description: 'Nombre del artículo' },
            quantity: { type: 'STRING', description: 'Cantidad opcional, p.ej. "2 kg"' },
          },
          required: ['name'],
        },
      },
      list_name: {
        type: 'STRING',
        description: 'Nombre de la lista. Por defecto: "Lista principal"',
      },
    },
    required: ['items'],
  },
};
