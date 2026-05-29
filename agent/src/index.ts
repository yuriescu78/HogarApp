import 'dotenv/config';
import { createBot } from './agent/loop.js';
import { startReminderDispatcher } from './cron/reminder-dispatcher.js';
import { startMorningBriefing }    from './cron/morning-briefing.js';

const required = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'FAMILY_ID',
] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const bot = createBot();

startReminderDispatcher(bot.api);
startMorningBriefing(bot.api);

bot.start({
  onStart: () => console.log('JARVIS online'),
});

process.once('SIGINT',  () => bot.stop());
process.once('SIGTERM', () => bot.stop());
