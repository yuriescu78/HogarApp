import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources';
import { tools, type ToolContext } from '../tools/index.js';

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export interface GeminiResult {
  text:      string;
  tokensIn:  number;
  tokensOut: number;
  model:     string;
}

// Gemini declarations use uppercase types (OBJECT, STRING, ARRAY…).
// OpenAI expects JSON Schema lowercase (object, string, array…).
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
  const MODEL      = 'gpt-4o-mini';
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
          const { runClaudeForMenu } = await import('./claude.js');
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
