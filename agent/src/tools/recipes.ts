import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addRecipeSchema = z.object({
  name:         z.string().min(1),
  ingredients:  z.array(z.string()).default([]),
  instructions: z.string().optional(),
  servings:     z.number().int().positive().optional(),
  prep_minutes: z.number().int().positive().optional(),
});

export type AddRecipeInput = z.input<typeof addRecipeSchema>;

export async function addRecipe(
  input: AddRecipeInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('recipes').insert({
    family_id:    familyId,
    name:         input.name,
    ingredients:  input.ingredients ?? [],
    instructions: input.instructions ?? null,
    servings:     input.servings ?? null,
    prep_minutes: input.prep_minutes ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Receta "${input.name}" guardada.` };
}

export const addRecipeDeclaration = {
  name:        'add_recipe',
  description: 'Guarda una receta en el recetario familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name:         { type: 'STRING', description: 'Nombre de la receta.' },
      ingredients:  { type: 'ARRAY',  description: 'Lista de ingredientes.', items: { type: 'STRING' } },
      instructions: { type: 'STRING', description: 'Instrucciones de preparación.' },
      servings:     { type: 'NUMBER', description: 'Número de raciones.' },
      prep_minutes: { type: 'NUMBER', description: 'Tiempo de preparación en minutos.' },
    },
    required: ['name'],
  },
};
