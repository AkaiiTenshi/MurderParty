import { MessageFlags } from 'discord.js';
import { config } from './config.js';
import { getSetting } from './db.js';

// Discord helpers shared by every command. In DMs there is no `interaction.member`,
// so roles are always checked against the guild member.

export async function getGuild(client) {
  return client.guilds.cache.get(config.guildId) ?? client.guilds.fetch(config.guildId);
}

export async function fetchMember(client, userId) {
  const guild = await getGuild(client);
  return guild.members.fetch(userId).catch(() => null);
}

export const isGM = (member) => Boolean(member?.roles.cache.has(config.gmRoleId));
export const isSuspect = (member) => Boolean(member?.roles.cache.has(config.suspectRoleId)) && !isGM(member);

// Private reply: ephemeral in the guild; DMs are private already and stay readable.
export function reply(interaction, content, extra = {}) {
  const payload = { content, allowedMentions: { parse: [] }, ...extra };
  if (interaction.inGuild()) payload.flags = MessageFlags.Ephemeral;
  return interaction.deferred || interaction.replied ? interaction.editReply(payload) : interaction.reply(payload);
}

async function settingChannel(client, key) {
  const id = getSetting(key);
  if (!id) return null;
  return client.channels.fetch(id).catch(() => null);
}

export async function gmLog(client, content, extra = {}) {
  const channel = await settingChannel(client, 'gm_log_channel');
  if (!channel) {
    console.log('[gm-log]', content);
    return;
  }
  await channel.send({ content, allowedMentions: { parse: [] }, ...extra });
}

// Public post in #root. `ping` lists user ids that should actually be notified.
export async function announce(client, content, ping = []) {
  const channel = await settingChannel(client, 'root_channel');
  if (!channel) {
    console.log('[root]', content);
    return;
  }
  const message = await channel.send({
    content: `@everyone ${content}`, allowedMentions: { parse: ['everyone'], users: ping },
  });
  await message.edit({ content, allowedMentions: { parse: [] } }).catch(console.error);
}

// Public embed in #root that pings @everyone invisibly: the mention is sent in the content,
// then removed by an edit. The notification is already out, so only the embed stays visible.
// Needs the "Mention Everyone" permission in the channel.
export async function announceEmbed(client, embed) {
  const channel = await settingChannel(client, 'root_channel');
  if (!channel) {
    console.log('[root]', embed.data.title ?? '', embed.data.description);
    return false;
  }
  const message = await channel.send({
    content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] },
  });
  await message.edit({ content: '', allowedMentions: { parse: [] } }).catch(console.error);
  return true;
}

export async function dm(client, userId, content) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(content);
  } catch {
    await gmLog(client, `⚠️ Impossible d'envoyer un MP à <@${userId}> : « ${content} »`);
  }
}
