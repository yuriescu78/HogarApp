import { Bot, type Context } from 'grammy';
import OpenAI from 'openai';
import { toFile } from 'openai';
import { supabase } from '../utils/supabase.js';
import { containsSensitiveData } from '../utils/masking.js';
import { runGeminiLoop } from './gemini.js';
import { parseFallback } from './fallback-parser.js';
import type { ToolContext } from '../tools/index.js';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';
const openai    = new OpenAI();

function buildSystemPrompt(familyName: string): string {
  const now = new Date().toLocaleString('es-ES', { timeZone: TIMEZONE });
  return `Eres JARVIS, el mayordomo digital de la familia ${familyName}.
- Español con tono de mayordomo británico: formal, cálido, humor sutil y seco
- Adultos: "señor/señora". Niños: por su nombre
- Conciso: respuestas breves y directas
- Si no entiendes: "Disculpe, ¿podría precisar a qué se refiere con...?"
- Proactivo: menciona cosas relevantes que detectes
- Lista de la compra: usa siempre "Lista principal" por defecto, nunca preguntes a qué lista añadir. Solo usa add_shopping_items para artículos de supermercado (alimentos, productos del hogar)
- Calendario: usa SIEMPRE la herramienta add_calendar_event para citas, exámenes, reuniones, eventos con fecha. NUNCA respondas que lo añadiste sin haber llamado a la herramienta primero
- Mascotas: NUNCA pidas el ID de una mascota al usuario. Cuando el usuario mencione una mascota por nombre, llama primero a query_pet con ese nombre para obtener el ID, luego ejecuta la acción solicitada. Si no existe, crea la mascota con add_pet antes de continuar
- Fechas: convierte siempre las fechas en lenguaje natural a ISO 8601 (ej: "el 21 de junio a las 10" → "2026-06-21T10:00:00"). Nunca pidas confirmación si la fecha está clara
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

async function transcribeVoice(fileUrl: string): Promise<string> {
  const res     = await fetch(fileUrl);
  const buffer  = Buffer.from(await res.arrayBuffer());
  const oggFile = await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' });
  const result  = await openai.audio.transcriptions.create({
    file:     oggFile,
    model:    'whisper-1',
    language: 'es',
  });
  return result.text;
}

// Gemini 2.5 Flash pricing (USD per 1M tokens, prompts ≤200k ctx)
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gemini-2.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-2.0-flash': { inputPer1M: 0.10,  outputPer1M: 0.40 },
  'gpt-4o-mini':      { inputPer1M: 0.15,  outputPer1M: 0.60 },
};

async function logCommand(
  inputType: 'text' | 'voice',
  rawInput: string | null,
  toolUsed: string | null,
  success: boolean,
  usage?: { tokensIn: number; tokensOut: number; model: string }
) {
  const pricing  = usage ? (PRICING[usage.model] ?? PRICING['gemini-2.5-flash']) : null;
  const costUsd  = pricing && usage
    ? (usage.tokensIn / 1_000_000) * pricing.inputPer1M
      + (usage.tokensOut / 1_000_000) * pricing.outputPer1M
    : null;

  await supabase.from('voice_logs').insert({
    family_id:     FAMILY_ID,
    input_type:    inputType,
    raw_input:     rawInput,
    tool_used:     toolUsed,
    success,
    tokens_input:  usage?.tokensIn  ?? null,
    tokens_output: usage?.tokensOut ?? null,
    model:         usage?.model     ?? null,
    cost_usd:      costUsd,
  });
}

export function createBot(): Bot {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  bot.on('message', async (ctx: Context) => {
    let text: string | undefined;
    let inputType: 'text' | 'voice' = 'text';

    if (ctx.message?.text) {
      text = ctx.message.text;
    } else if (ctx.message?.voice) {
      inputType = 'voice';
      try {
        const file   = await ctx.getFile();
        const apiUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        text = await transcribeVoice(apiUrl);
      } catch {
        await ctx.reply('Disculpe, no pude transcribir el audio. Por favor escríbame.');
        return;
      }
    }

    if (!text) return;

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
      const result = await runGeminiLoop(text, toolCtx, buildSystemPrompt(familyName));
      await ctx.reply(result.text);
      await logCommand(inputType, text, null, true, {
        tokensIn:  result.tokensIn,
        tokensOut: result.tokensOut,
        model:     result.model,
      });
    } catch {
      // Gemini unavailable — try regex fallback
      const fallback = parseFallback(text);
      if (fallback?.tool === 'add_shopping_items') {
        const { addShoppingItems, addShoppingItemsSchema } = await import('../tools/shopping.js');
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
