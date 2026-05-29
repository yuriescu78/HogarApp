import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const addReminderSchema = z.object({
  title:     z.string().min(1),
  remind_at: z.string(),
  event_id:  z.string().uuid().optional(),
});

export type AddReminderInput = z.input<typeof addReminderSchema>;

export async function addReminder(
  input: AddReminderInput,
  supabase: SupabaseClient,
  familyId: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  let eventId = input.event_id;

  if (!eventId) {
    const { data: event, error: evErr } = await supabase
      .from('calendar_events')
      .insert({ family_id: familyId, title: input.title, start_time: input.remind_at })
      .select('id')
      .single();

    if (evErr || !event) return { success: false, error: evErr?.message ?? 'Error creando evento' };
    eventId = event.id;
  }

  const { error } = await supabase.from('event_reminders').insert({
    family_id: familyId,
    event_id:  eventId,
    remind_at: input.remind_at,
  });

  if (error) return { success: false, error: error.message };

  const date = new Date(input.remind_at).toLocaleString('es-ES', {
    timeZone: process.env.TIMEZONE ?? 'Europe/Madrid',
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
  return { success: true, message: `Recordatorio "${input.title}" fijado para el ${date}.` };
}

export const addReminderDeclaration = {
  name:        'add_reminder',
  description: 'Añade un recordatorio. Puede ser independiente o vinculado a un evento del calendario.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title:     { type: 'STRING', description: 'Texto del recordatorio.' },
      remind_at: { type: 'STRING', description: 'Fecha y hora del recordatorio en ISO 8601.' },
      event_id:  { type: 'STRING', description: 'UUID del evento existente al que vincularlo (opcional).' },
    },
    required: ['title', 'remind_at'],
  },
};
