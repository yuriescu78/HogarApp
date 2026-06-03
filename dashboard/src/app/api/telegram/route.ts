import { Bot } from 'grammy';
import OpenAI, { toFile } from 'openai';
import { waitUntil } from '@vercel/functions';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { containsSensitiveData } from '@/lib/jarvis/tools';
import { runGeminiLoop } from '@/lib/jarvis/gemini';

const FAMILY_ID = process.env.FAMILY_ID!;
const TIMEZONE  = process.env.TIMEZONE ?? 'Europe/Madrid';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

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
- Fechas: convierte siempre las fechas en lenguaje natural a ISO 8601 (ej: "el 21 de junio a las 10" → "2026-06-21T10:00:00"). Nunca pidas confirmación si la fecha está clara
- Fecha y hora actual: ${now}`;
}

// Lazy bot initialization — deferred so Next.js build doesn't fail without env vars.
// Returns a Promise so bot.init() (required by grammY for webhook mode) runs once.
let _botPromise: Promise<Bot> | null = null;
function getBot(): Promise<Bot> {
  if (!_botPromise) {
    _botPromise = (async () => {
      const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
      _bot = bot;

    _bot.on('message', async (ctx) => {
      const supabase = createSupabaseAdminClient();

      // Auth: verify sender belongs to this family
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

      let text: string | undefined;
      let inputType: 'text' | 'voice' = 'text';

      if (ctx.message?.text) {
        text = ctx.message.text;
      } else if (ctx.message?.voice) {
        inputType = 'voice';
        try {
          const file   = await ctx.getFile();
          const apiUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
          const res    = await fetch(apiUrl);
          const buffer = Buffer.from(await res.arrayBuffer());
          const ogg    = await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' });
          const result = await getOpenAI().audio.transcriptions.create({ file: ogg, model: 'whisper-1', language: 'es' });
          text = result.text;
        } catch {
          await ctx.reply('Disculpe, no pude transcribir el audio. Por favor escríbame.');
          return;
        }
      }

      if (!text) return;

      // Sensitive data precheck (ADR-001)
      if (containsSensitiveData(text)) {
        await ctx.reply('Disculpe, no puedo procesar datos sensibles en este momento. Esta función estará disponible cuando la infraestructura local esté configurada.');
        await supabase.from('voice_logs').insert({ family_id: FAMILY_ID, input_type: inputType, raw_input: null, tool_used: 'unsupported_sensitive_data', success: false });
        return;
      }

      const { data: family } = await supabase.from('families').select('name').eq('id', FAMILY_ID).single();
      const familyName = family?.name ?? 'García';
      const toolCtx    = { supabase, familyId: FAMILY_ID, memberId: member.id };

      // Gemini 2.5 Flash pricing (USD per 1M tokens)
      const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
        'gemini-2.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
      };

      try {
        const result   = await runGeminiLoop(text, toolCtx, buildSystemPrompt(familyName));
        await ctx.reply(result.text);
        const pricing  = PRICING[result.model] ?? PRICING['gemini-2.5-flash'];
        const costUsd  = (result.tokensIn / 1_000_000) * pricing.inputPer1M
                       + (result.tokensOut / 1_000_000) * pricing.outputPer1M;
        await supabase.from('voice_logs').insert({
          family_id:     FAMILY_ID,
          input_type:    inputType,
          raw_input:     text,
          tool_used:     null,
          success:       true,
          tokens_input:  result.tokensIn,
          tokens_output: result.tokensOut,
          model:         result.model,
          cost_usd:      costUsd,
        });
      } catch (err) {
        console.error('[jarvis] runGeminiLoop error:', err);
        await ctx.reply('Disculpe, estoy teniendo dificultades técnicas en este momento.');
        await supabase.from('voice_logs').insert({ family_id: FAMILY_ID, input_type: inputType, raw_input: text, tool_used: null, success: false });
      }
    });
      await bot.init();
      return bot;
    })();
  }
  return _botPromise;
}

// Keep a reference for type narrowing (unused at runtime — _botPromise is the source of truth)
let _bot: Bot | null = null;

export async function POST(req: Request) {
  // Verify Telegram secret token if configured
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const body = await req.json();
    // waitUntil keeps the function alive after response is sent (Vercel hobby: 10s max)
    waitUntil(getBot().then(bot => bot.handleUpdate(body)));
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[telegram/webhook] error:', err);
    // Always return 200 to prevent Telegram retries on non-retryable errors
    return Response.json({ ok: false, error: String(err) });
  }
}
