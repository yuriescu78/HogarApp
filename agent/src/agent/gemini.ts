import {
  GoogleGenerativeAI,
  type Part,
  type FunctionDeclaration,
} from '@google/generative-ai';

import { tools, type ToolContext } from '../tools/index.js';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runGeminiLoop(
  userMessage: string,
  ctx: ToolContext,
  systemPrompt: string
): Promise<string> {
  const declarations = tools
    .filter(t => !t.useClaudeInstead)
    .map(t => t.declaration as unknown as FunctionDeclaration);

  const model = genai.getGenerativeModel({
    model:             'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    tools:             [{ functionDeclarations: declarations }],
  });

  const chat = model.startChat();
  let response = await chat.sendMessage(userMessage);


  let iterations = 0;
  while (response.response.functionCalls()?.length && iterations < 10) {
    iterations++;
    const calls = response.response.functionCalls()!;
    const resultParts: Part[] = [];

    for (const call of calls) {
      const tool = tools.find(t => t.name === call.name);
      if (!tool) {
        resultParts.push({
          functionResponse: {
            name:     call.name,
            response: { error: `Tool "${call.name}" not found` },
          },
        });
        continue;
      }

      const parsed = tool.schema.safeParse(call.args);
      if (!parsed.success) {
        resultParts.push({
          functionResponse: {
            name:     call.name,
            response: { error: parsed.error.message },
          },
        });
        continue;
      }

      const result = await tool.handler(parsed.data, ctx);
      resultParts.push({
        functionResponse: {
          name:     call.name,
          response: result as Record<string, unknown>,
        },
      });
    }

    response = await chat.sendMessage(resultParts);
  }

  return response.response.text();
}
