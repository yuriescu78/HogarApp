import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodTypeAny, z } from 'zod';
import {
  addShoppingItems,
  addShoppingItemsDeclaration,
  addShoppingItemsSchema,
} from './shopping.js';

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
    name:             'add_shopping_items',
    description:      'Añade artículos a la lista de la compra',
    schema:           addShoppingItemsSchema,
    handler:          (input, ctx) => addShoppingItems(input, ctx.supabase, ctx.familyId),
    declaration:      addShoppingItemsDeclaration,
    useClaudeInstead: false,
  },
];

export function findTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}
