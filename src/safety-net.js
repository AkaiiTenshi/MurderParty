import { dm } from './guards.js';
import { SAFETY_NET_DM } from './messages.js';
import { config } from './config.js';

// A mistyped slash command ends up as a plain message: delete it before others read it.
export async function onMessage(message) {
  if (message.author.bot || message.guildId !== config.guildId) return;
  if (!message.content.trimStart().toLowerCase().startsWith('/root')) return;
  await message.delete().catch(() => {});
  await dm(message.client, message.author.id, SAFETY_NET_DM);
}
