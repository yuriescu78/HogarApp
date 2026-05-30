import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  type Part,
  type FunctionDeclaration,
} from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { tools, type ToolContext } from './tools';

const genai      = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const anthropic  = new Anthropic();

async function runClaudeForMenu(
  input: { days?: number; note?: string },
  supabase: ToolContext['supabase'],
  familyId: string
): Promise<string> {
  const [{ data: members }, { data: recipes }] = await Promise.all([
    supabase.from('family_members').select('name, role').eq('family_id', familyId),
    supabase.from('recipes').select('name, ingredients, servings').eq('family_id', familyId).limit(20),
  ]);

  const familyInfo = members?.map(m => m.name).join(', ') ?? 'familia';
  const recipeList = recipes?.length
    ? recipes.map(r => `- ${r.name} (${(r.ingredients as string[]).slice(0, 3).join(', ')})`).join('\n')
    : 'Sin recetas guardadas aún.';

  const days      = input.days ?? 7;
  const extraNote = input.note ? `\nNota adicional: ${input.note}` : '';

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role:    'user',
      content: `Eres JARVIS, el mayordomo digital de la familia. Sugiere un menú para ${days} días.\n\nMiembros: ${familyInfo}\nRestricciones dietéticas:\n- Elena: dieta Keto estricta (sin cereales, sin azúcar, alta en grasas saludables)\n- Los niños: menú infantil equilibrado y variado\n- Carlos: dieta híbrida (flexible, puede comer de todo con moderación)\n\nRecetas disponibles en el recetario familiar:\n${recipeList}${extraNote}\n\nResponde SOLO con el menú en español, formato conciso por día. Ejemplo:\nLunes — Niños: macarrones | Elena: ensalada de salmón con aguacate | Carlos: pasta con atún`,
    }],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : 'No pude generar el menú en este momento.';
}

export async function runGeminiLoop(
  userMessage: string,
  ctx: ToolContext,
  systemPrompt: string
): Promise<string> {
  const declarations = tools.map(t => t.declaration as unknown as FunctionDeclaration);

  const model = genai.getGenerativeModel({
    model:             'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    tools:             [{ functionDeclarations: declarations }],
    toolConfig:        { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  const chat     = model.startChat();
  let   response = await chat.sendMessage(userMessage);

  let iterations = 0;
  while (response.response.functionCalls()?.length && iterations < 10) {
    iterations++;
    const calls       = response.response.functionCalls()!;
    const resultParts: Part[] = [];

    for (const call of calls) {
      const tool = tools.find(t => t.name === call.name);
      if (!tool) {
        resultParts.push({ functionResponse: { name: call.name, response: { error: `Tool "${call.name}" not found` } } });
        continue;
      }

      const parsed = tool.schema.safeParse(call.args);
      if (!parsed.success) {
        resultParts.push({ functionResponse: { name: call.name, response: { error: parsed.error.message } } });
        continue;
      }

      if (tool.useClaudeInstead) {
        const suggestion = await runClaudeForMenu(parsed.data as { days?: number; note?: string }, ctx.supabase, ctx.familyId);
        resultParts.push({ functionResponse: { name: call.name, response: { suggestion } } });
        continue;
      }

      const result = await tool.handler(parsed.data, ctx);
      resultParts.push({ functionResponse: { name: call.name, response: result as Record<string, unknown> } });
    }

    response = await chat.sendMessage(resultParts);
  }

  return response.response.text();
}
