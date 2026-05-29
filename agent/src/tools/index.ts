import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodTypeAny, z } from 'zod';
import { addShoppingItems, addShoppingItemsDeclaration, addShoppingItemsSchema } from './shopping.js';
import { queryShoppingItems, queryShoppingItemsDeclaration, queryShoppingItemsSchema } from './query-shopping.js';
import { checkShoppingItem, checkShoppingItemDeclaration, checkShoppingItemSchema } from './check-shopping.js';
import { clearCheckedItems, clearCheckedItemsDeclaration, clearCheckedItemsSchema } from './clear-checked.js';
import { addCalendarEvent, addCalendarEventDeclaration, addCalendarEventSchema } from './calendar.js';
import { queryCalendar, queryCalendarDeclaration, queryCalendarSchema } from './calendar.js';
import { addReminder, addReminderDeclaration, addReminderSchema } from './reminder.js';
import { createNote, createNoteDeclaration, createNoteSchema } from './notes.js';
import { queryNotes, queryNotesDeclaration, queryNotesSchema } from './notes.js';
import { addRecipe, addRecipeDeclaration, addRecipeSchema } from './recipes.js';
import { suggestMenuDeclaration, suggestMenuSchema } from './menu.js';
import { addWeeklyMenu, addWeeklyMenuDeclaration, addWeeklyMenuSchema } from './menu.js';
import { saveKnowledge, saveKnowledgeDeclaration, saveKnowledgeSchema } from './knowledge.js';
import { searchKnowledge, searchKnowledgeDeclaration, searchKnowledgeSchema } from './knowledge.js';
import { addChore, addChoreDeclaration, addChoreSchema } from './chores.js';
import { queryChores, queryChoresDeclaration, queryChoresSchema } from './chores.js';
import { logChore, logChoreDeclaration, logChoreSchema } from './chores.js';
import { addPet, addPetDeclaration, addPetSchema } from './pets.js';
import { addPetDiaryEntry, addPetDiaryEntryDeclaration, addPetDiaryEntrySchema } from './pets.js';
import { addPetReminder, addPetReminderDeclaration, addPetReminderSchema } from './pets.js';
import { queryPet, queryPetDeclaration, queryPetSchema } from './pets.js';
import { saveInvestmentNote, saveInvestmentNoteDeclaration, saveInvestmentNoteSchema } from './investments.js';
import { queryInvestmentNotes, queryInvestmentNotesDeclaration, queryInvestmentNotesSchema } from './investments.js';

export interface ToolContext {
  supabase:  SupabaseClient;
  familyId:  string;
  memberId?: string;
}

export interface ToolDefinition<S extends ZodTypeAny = ZodTypeAny> {
  name:             string;
  description:      string;
  schema:           S;
  handler:          (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
  declaration:      Record<string, unknown>;
  useClaudeInstead: boolean;
}

export const tools: ToolDefinition[] = [
  {
    name: 'add_shopping_items', description: 'Añade artículos a la lista de la compra',
    schema: addShoppingItemsSchema,
    handler: (input, ctx) => addShoppingItems(input, ctx.supabase, ctx.familyId),
    declaration: addShoppingItemsDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_shopping', description: 'Consulta la lista de la compra',
    schema: queryShoppingItemsSchema,
    handler: (input, ctx) => queryShoppingItems(input, ctx.supabase, ctx.familyId),
    declaration: queryShoppingItemsDeclaration, useClaudeInstead: false,
  },
  {
    name: 'check_shopping_item', description: 'Marca un artículo como comprado',
    schema: checkShoppingItemSchema,
    handler: (input, ctx) => checkShoppingItem(input, ctx.supabase, ctx.familyId),
    declaration: checkShoppingItemDeclaration, useClaudeInstead: false,
  },
  {
    name: 'clear_checked_items', description: 'Limpia los artículos comprados de la lista',
    schema: clearCheckedItemsSchema,
    handler: (input, ctx) => clearCheckedItems(input, ctx.supabase, ctx.familyId),
    declaration: clearCheckedItemsDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_calendar_event', description: 'Añade un evento al calendario',
    schema: addCalendarEventSchema,
    handler: (input, ctx) => addCalendarEvent(input, ctx.supabase, ctx.familyId),
    declaration: addCalendarEventDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_calendar', description: 'Consulta los próximos eventos del calendario',
    schema: queryCalendarSchema,
    handler: (input, ctx) => queryCalendar(input, ctx.supabase, ctx.familyId),
    declaration: queryCalendarDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_reminder', description: 'Añade un recordatorio',
    schema: addReminderSchema,
    handler: (input, ctx) => addReminder(input, ctx.supabase, ctx.familyId),
    declaration: addReminderDeclaration, useClaudeInstead: false,
  },
  {
    name: 'create_note', description: 'Guarda una nota en la bitácora',
    schema: createNoteSchema,
    handler: (input, ctx) => createNote(input, ctx.supabase, ctx.familyId),
    declaration: createNoteDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_notes', description: 'Busca notas en la bitácora',
    schema: queryNotesSchema,
    handler: (input, ctx) => queryNotes(input, ctx.supabase, ctx.familyId),
    declaration: queryNotesDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_recipe', description: 'Guarda una receta',
    schema: addRecipeSchema,
    handler: (input, ctx) => addRecipe(input, ctx.supabase, ctx.familyId),
    declaration: addRecipeDeclaration, useClaudeInstead: false,
  },
  {
    name: 'suggest_menu', description: 'Sugiere menú semanal personalizado (Claude Sonnet)',
    schema: suggestMenuSchema,
    handler: async () => ({ suggestion: 'Handled by Claude' }),
    declaration: suggestMenuDeclaration, useClaudeInstead: true,
  },
  {
    name: 'add_weekly_menu', description: 'Guarda el menú semanal',
    schema: addWeeklyMenuSchema,
    handler: (input, ctx) => addWeeklyMenu(input, ctx.supabase, ctx.familyId),
    declaration: addWeeklyMenuDeclaration, useClaudeInstead: false,
  },
  {
    name: 'save_knowledge', description: 'Guarda en la base de conocimiento',
    schema: saveKnowledgeSchema,
    handler: (input, ctx) => saveKnowledge(input, ctx.supabase, ctx.familyId),
    declaration: saveKnowledgeDeclaration, useClaudeInstead: false,
  },
  {
    name: 'search_knowledge', description: 'Búsqueda semántica en conocimiento',
    schema: searchKnowledgeSchema,
    handler: (input, ctx) => searchKnowledge(input, ctx.supabase, ctx.familyId),
    declaration: searchKnowledgeDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_chore', description: 'Añade una tarea doméstica',
    schema: addChoreSchema,
    handler: (input, ctx) => addChore(input, ctx.supabase, ctx.familyId),
    declaration: addChoreDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_chores', description: 'Consulta las tareas domésticas',
    schema: queryChoresSchema,
    handler: (input, ctx) => queryChores(input, ctx.supabase, ctx.familyId),
    declaration: queryChoresDeclaration, useClaudeInstead: false,
  },
  {
    name: 'log_chore', description: 'Registra una tarea como completada',
    schema: logChoreSchema,
    handler: (input, ctx) => logChore(input, ctx.supabase, ctx.familyId),
    declaration: logChoreDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_pet', description: 'Registra una mascota',
    schema: addPetSchema,
    handler: (input, ctx) => addPet(input, ctx.supabase, ctx.familyId),
    declaration: addPetDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_pet_diary_entry', description: 'Añade entrada al diario de una mascota',
    schema: addPetDiaryEntrySchema,
    handler: (input, ctx) => addPetDiaryEntry(input, ctx.supabase, ctx.familyId),
    declaration: addPetDiaryEntryDeclaration, useClaudeInstead: false,
  },
  {
    name: 'add_pet_reminder', description: 'Añade recordatorio para una mascota',
    schema: addPetReminderSchema,
    handler: (input, ctx) => addPetReminder(input, ctx.supabase, ctx.familyId),
    declaration: addPetReminderDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_pet', description: 'Consulta info y diario de una mascota',
    schema: queryPetSchema,
    handler: (input, ctx) => queryPet(input, ctx.supabase, ctx.familyId),
    declaration: queryPetDeclaration, useClaudeInstead: false,
  },
  {
    name: 'save_investment_note', description: 'Guarda nota de inversión o finanzas',
    schema: saveInvestmentNoteSchema,
    handler: (input, ctx) => saveInvestmentNote(input, ctx.supabase, ctx.familyId),
    declaration: saveInvestmentNoteDeclaration, useClaudeInstead: false,
  },
  {
    name: 'query_investment_notes', description: 'Consulta notas de inversión (enmascaradas)',
    schema: queryInvestmentNotesSchema,
    handler: (input, ctx) => queryInvestmentNotes(input, ctx.supabase, ctx.familyId),
    declaration: queryInvestmentNotesDeclaration, useClaudeInstead: false,
  },
];

export function findTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}
