import { Bot, type Context } from 'grammy';
import { supabase } from '../utils/supabase.js';
import { containsSensitiveData } from '../utils/masking.js';
import { runGeminiLoop } from './gemini.js';
import { parseFallback } from './fallback-parser.js';
import type { ToolContext } from '../tools/index.js';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';

function buildSystemPrompt(familyName: string): string {
  const now = new Date().toLocaleString('es-ES', { timeZone: TIMEZONE });
  return `Eres JARVIS, el mayordomo digital de la familia ${familyName}.
- Español con tono de mayordomo británico: formal, cálido, humor sutil y seco
- Adultos: "señor/señora". Niños: por su nombre
- Conciso: respuestas breves y directas
- Si no entiendes: "Disculpe, ¿podría precisar a qué se refiere con...?"
- Proactivo: menciona cosas relevantes que detectes
- Lista de la compra: usa siempre "Lista principal" por defecto, nunca preguntes a qué lista añadir
- Fecha y hora actual: ${now}`;
}

async function getFamilyName(): Promise<string> {
  const { data } = await supabase
    .from('families')
    .select('name')
    .eq('id', FAMILY_ID)
    .single();
  return data?.name ?? 'García';
}

async function logCommand(
  inputType: 'text' | 'voice',
  rawInput: string | null,
  toolUsed: string | null,
  success: boolean
) {
  await supabase.from('voice_logs').insert({
    family_id:     FAMILY_ID,
    input_type:    inputType,
    raw_input:     rawInput,
    tool_used:     toolUsed,
    success,
  });
}

export function createBot(): Bot {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  bot.on('message', async (ctx: Context) => {
    // Phase 0: text only — voice deferred to Phase 1
    const text = ctx.message?.text;
    if (!text) return;
    const inputType = 'text' as const;

    // Validate sender belongs to this family and is active
    const senderId = ctx.from?.id;
    if (!senderId) return;

    const { data: member } = await supabase
      .from('family_members')
      .select('id, name, active')
      .eq('family_id', FAMILY_ID)
      .eq('telegram_id', senderId)
      .eq('active', true)
      .single();

    if (!member) {
      await ctx.reply('Disculpe, no le reconozco. Este servicio es privado.');
      return;
    }

    // Precheck: block sensitive data before any LLM call (ADR-001)
    if (containsSensitiveData(text)) {
      await ctx.reply(
        'Disculpe, no puedo procesar datos sensibles en este momento. ' +
        'Esta función estará disponible cuando la infraestructura local esté configurada.'
      );
      await logCommand(inputType, null, 'unsupported_sensitive_data', false);
      return;
    }

    const toolCtx: ToolContext = { supabase, familyId: FAMILY_ID, memberId: member.id };
    const familyName = await getFamilyName();

    try {
      const reply = await runGeminiLoop(text, toolCtx, buildSystemPrompt(familyName));
      await ctx.reply(reply);
      await logCommand(inputType, text, null, true);
    } catch {
      // Gemini unavailable — try regex fallback
      const fallback = parseFallback(text);
      if (fallback?.tool === 'add_shopping_items') {
        const { addShoppingItems } = await import('../tools/shopping.js');
        const { addShoppingItemsSchema } = await import('../tools/shopping.js');
        const parsed = addShoppingItemsSchema.parse({ items: fallback.items });
        const result = await addShoppingItems(parsed, supabase, FAMILY_ID);
        const reply = result.success
          ? `Anotado, señor. ${result.added} artículo(s) añadido(s) a la lista.`
          : `Disculpe, no pude añadir los artículos: ${result.error}`;
        await ctx.reply(reply);
        await logCommand(inputType, text, 'add_shopping_items_fallback', result.success);
      } else {
        await ctx.reply('Disculpe, estoy teniendo dificultades técnicas en este momento.');
        await logCommand(inputType, text, null, false);
      }
    }
  });

  return bot;
}
