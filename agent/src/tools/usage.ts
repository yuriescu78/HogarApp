import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const queryUsageCostSchema = z.object({
  period: z.enum(['hoy', 'semana', 'mes', 'total']).default('mes'),
});

export const queryUsageCostDeclaration = {
  name:        'query_usage_cost',
  description: 'Consulta el coste acumulado en euros de uso de APIs de IA (Gemini). Útil para preguntas como "¿cuánto llevamos gastado este mes?"',
  parameters: {
    type: 'OBJECT',
    properties: {
      period: {
        type:        'STRING',
        enum:        ['hoy', 'semana', 'mes', 'total'],
        description: 'Período a consultar. Por defecto: mes en curso.',
      },
    },
  },
};

const USD_TO_EUR = 0.92;

function periodFilter(period: string): string {
  const tz = process.env.TIMEZONE ?? 'Europe/Madrid';
  switch (period) {
    case 'hoy':
      return `AND created_at >= (NOW() AT TIME ZONE '${tz}')::date`;
    case 'semana':
      return `AND created_at >= date_trunc('week', NOW() AT TIME ZONE '${tz}')`;
    case 'mes':
      return `AND created_at >= date_trunc('month', NOW() AT TIME ZONE '${tz}')`;
    default:
      return '';
  }
}

export async function queryUsageCost(
  input: z.infer<typeof queryUsageCostSchema>,
  supabase: SupabaseClient,
  familyId: string
): Promise<{
  period: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  costEur: number;
  summary: string;
}> {
  const { data, error } = await supabase.rpc('get_usage_cost', {
    p_family_id: familyId,
    p_period:    input.period,
  });

  if (error) {
    // Fallback: direct query if RPC not available
    return fallbackQuery(input.period, supabase, familyId);
  }

  return formatResult(input.period, data);
}

async function fallbackQuery(
  period: string,
  supabase: SupabaseClient,
  familyId: string
) {
  let query = supabase
    .from('voice_logs')
    .select('tokens_input, tokens_output, cost_usd')
    .eq('family_id', familyId)
    .not('cost_usd', 'is', null);

  const now  = new Date();
  if (period === 'hoy') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    query = query.gte('created_at', start);
  } else if (period === 'semana') {
    const day   = now.getDay();
    const diff  = now.getDate() - (day === 0 ? 6 : day - 1);
    const start = new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
    query = query.gte('created_at', start);
  } else if (period === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('created_at', start);
  }

  const { data } = await query;
  const rows = data ?? [];

  const requests  = rows.length;
  const tokensIn  = rows.reduce((s, r) => s + (r.tokens_input  ?? 0), 0);
  const tokensOut = rows.reduce((s, r) => s + (r.tokens_output ?? 0), 0);
  const costUsd   = rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const costEur   = costUsd * USD_TO_EUR;

  return formatResult(period, { requests, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd, cost_eur: costEur });
}

function formatResult(period: string, data: Record<string, unknown>) {
  const requests  = Number(data.requests  ?? 0);
  const tokensIn  = Number(data.tokens_in ?? 0);
  const tokensOut = Number(data.tokens_out ?? 0);
  const costUsd   = Number(data.cost_usd  ?? 0);
  const costEur   = Number(data.cost_eur  ?? costUsd * USD_TO_EUR);

  const periodLabel: Record<string, string> = {
    hoy:    'hoy',
    semana: 'esta semana',
    mes:    'este mes',
    total:  'en total',
  };

  const summary = requests === 0
    ? `No hay registros de uso ${periodLabel[period] ?? period} (puede que el logging de tokens sea reciente).`
    : `${periodLabel[period] ?? period}: ${requests} mensajes, ${(tokensIn + tokensOut).toLocaleString('es-ES')} tokens totales (${tokensIn.toLocaleString('es-ES')} entrada + ${tokensOut.toLocaleString('es-ES')} salida). Coste estimado: ${costEur.toFixed(4)} € (${costUsd.toFixed(4)} USD).`;

  return { period, requests, tokensIn, tokensOut, costUsd, costEur, summary };
}
