import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── add_calendar_event ────────────────────────────────────────────────────────

export const addCalendarEventSchema = z.object({
  title:       z.string().min(1),
  start_time:  z.string(),
  end_time:    z.string().optional(),
  all_day:     z.boolean().optional().default(false),
  description: z.string().optional(),
});

export type AddCalendarEventInput = z.input<typeof addCalendarEventSchema>;

export async function addCalendarEvent(
  input: AddCalendarEventInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const { error } = await supabase.from('calendar_events').insert({
    family_id:   familyId,
    title:       input.title,
    start_time:  input.start_time,
    end_time:    input.end_time ?? null,
    all_day:     input.all_day ?? false,
    description: input.description ?? null,
  });

  if (error) return { success: false, error: error.message };

  const date = new Date(input.start_time).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: process.env.TIMEZONE ?? 'Europe/Madrid',
  });
  return { success: true, message: `Evento "${input.title}" registrado para el ${date}.` };
}

export const addCalendarEventDeclaration = {
  name:        'add_calendar_event',
  description: 'Añade un evento al calendario familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title:       { type: 'STRING',  description: 'Título del evento.' },
      start_time:  { type: 'STRING',  description: 'Fecha y hora de inicio en ISO 8601. Ejemplo: "2026-06-21T10:00:00".' },
      end_time:    { type: 'STRING',  description: 'Fecha y hora de fin (opcional).' },
      all_day:     { type: 'BOOLEAN', description: 'true si es un evento de todo el día.' },
      description: { type: 'STRING',  description: 'Notas adicionales (opcional).' },
    },
    required: ['title', 'start_time'],
  },
};

// ── query_calendar ────────────────────────────────────────────────────────────

export const queryCalendarSchema = z.object({
  range: z.enum(['today', 'week', 'month']).optional().default('week'),
});

export type QueryCalendarInput = z.input<typeof queryCalendarSchema>;

type CalendarEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
};

export async function queryCalendar(
  input: QueryCalendarInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; events: CalendarEvent[] } | { success: false; error: string }> {
  const days  = input.range === 'today' ? 1 : input.range === 'month' ? 30 : 7;
  const now   = new Date().toISOString();
  const until = new Date(Date.now() + days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, all_day')
    .eq('family_id', familyId)
    .gte('start_time', now)
    .lte('start_time', until)
    .order('start_time', { ascending: true })
    .limit(10);

  if (error) return { success: false, error: error.message };
  return { success: true, events: (data ?? []) as CalendarEvent[] };
}

export const queryCalendarDeclaration = {
  name:        'query_calendar',
  description: 'Consulta los próximos eventos del calendario familiar.',
  parameters: {
    type: 'OBJECT',
    properties: {
      range: {
        type:        'STRING',
        description: 'Rango: "today" (hoy), "week" (7 días), "month" (30 días). Por defecto "week".',
      },
    },
    required: [],
  },
};
