import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

export async function runClaudeForMenu(
  input: { days?: number; note?: string },
  supabase: SupabaseClient,
  familyId: string
): Promise<string> {
  // Load family context: members + available recipes
  const [{ data: members }, { data: recipes }] = await Promise.all([
    supabase.from('family_members').select('name, role').eq('family_id', familyId),
    supabase.from('recipes').select('name, ingredients, servings').eq('family_id', familyId).limit(20),
  ]);

  const familyInfo = members?.map(m => m.name).join(', ') ?? 'familia';
  const recipeList = recipes?.length
    ? recipes.map(r => `- ${r.name} (${(r.ingredients as string[]).slice(0, 3).join(', ')})`).join('\n')
    : 'Sin recetas guardadas aún.';

  const days = input.days ?? 7;
  const extraNote = input.note ? `\nNota adicional: ${input.note}` : '';

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role:    'user',
        content: `Eres JARVIS, el mayordomo digital de la familia. Sugiere un menú para ${days} días.

Miembros: ${familyInfo}
Restricciones dietéticas:
- Elena: dieta Keto estricta (sin cereales, sin azúcar, alta en grasas saludables)
- Los niños: menú infantil equilibrado y variado
- Carlos: dieta híbrida (flexible, puede comer de todo con moderación)

Recetas disponibles en el recetario familiar:
${recipeList}${extraNote}

Responde SOLO con el menú en español, formato conciso por día. Ejemplo:
Lunes — Niños: macarrones | Elena: ensalada de salmón con aguacate | Carlos: pasta con atún`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : 'No pude generar el menú en este momento.';
}
