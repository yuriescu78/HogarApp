import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources';
import Anthropic from '@anthropic-ai/sdk';
import { tools, type ToolContext } from './tools';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

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

  const message = await getAnthropic().messages.create({
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

export interface GeminiResult {
  text:      string;
  tokensIn:  number;
  tokensOut: number;
  model:     string;
}

function convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') {
      out[k] = v.toLowerCase();
    } else if ((k === 'properties' || k === 'items') && v && typeof v === 'object') {
      if (k === 'properties') {
        const props: Record<string, unknown> = {};
        for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
          props[pk] = convertSchema(pv as Record<string, unknown>);
        }
        out[k] = props;
      } else {
        out[k] = convertSchema(v as Record<string, unknown>);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function toOpenAITool(decl: Record<string, unknown>): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name:        decl.name        as string,
      description: decl.description as string,
      parameters:  convertSchema(decl.parameters as Record<string, unknown>),
    },
  };
}

export async function runGeminiLoop(
  userMessage: string,
  ctx: ToolContext,
  systemPrompt: string
): Promise<GeminiResult> {
  const MODEL       = 'gpt-4o-mini';
  const openaiTools = tools.map(t => toOpenAITool(t.declaration as Record<string, unknown>));

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMessage  },
  ];

  let tokensIn  = 0;
  let tokensOut = 0;
  let iterations = 0;

  while (iterations < 10) {
    const response = await getOpenAI().chat.completions.create({
      model:       MODEL,
      messages,
      tools:       openaiTools,
      tool_choice: 'auto',
    });

    tokensIn  += response.usage?.prompt_tokens     ?? 0;
    tokensOut += response.usage?.completion_tokens ?? 0;

    const message = response.choices[0].message;
    messages.push(message as ChatCompletionMessageParam);

    if (!message.tool_calls?.length) {
      return { text: message.content ?? '', tokensIn, tokensOut, model: MODEL };
    }

    iterations++;

    for (const call of message.tool_calls) {
      const tool = tools.find(t => t.name === call.function.name);
      let result: unknown;

      if (!tool) {
        result = { error: `Tool "${call.function.name}" not found` };
      } else {
        const args   = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const parsed = tool.schema.safeParse(args);

        if (!parsed.success) {
          result = { error: parsed.error.message };
        } else if (tool.useClaudeInstead) {
          const suggestion = await runClaudeForMenu(
            parsed.data as { days?: number; note?: string },
            ctx.supabase,
            ctx.familyId
          );
          result = { suggestion };
        } else {
          result = await tool.handler(parsed.data, ctx);
        }
      }

      messages.push({
        role:         'tool',
        tool_call_id: call.id,
        content:      JSON.stringify(result),
      });
    }
  }

  return { text: 'Disculpe, no pude completar la operación.', tokensIn, tokensOut, model: MODEL };
}
