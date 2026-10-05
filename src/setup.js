import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { getSetting, setSetting } from './db.js';
import { getGuild } from './guards.js';

const { ViewChannel, SendMessages, ReadMessageHistory, ManageChannels } = PermissionFlagsBits;
export const MEMBER_ALLOW = ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'AddReactions'];

// Overwrites for a hidden channel: nobody but the GM, the bot and `memberIds`.
export function privateOverwrites(guild, memberIds) {
  return [
    { id: guild.roles.everyone.id, deny: [ViewChannel] },
    { id: config.gmRoleId, allow: MEMBER_ALLOW },
    { id: guild.client.user.id, allow: [...MEMBER_ALLOW, ManageChannels] },
    ...memberIds.map((id) => ({ id, allow: MEMBER_ALLOW })),
  ];
}

const LAYOUT = [
  {
    key: 'requests_category',
    name: 'ROOT – REQUÊTES',
    type: ChannelType.GuildCategory,
    overwrites: (guild) => privateOverwrites(guild, []),
  },
  {
    key: 'private_category',
    name: 'CANAUX PRIVÉS',
    type: ChannelType.GuildCategory,
    overwrites: (guild) => privateOverwrites(guild, []),
  },
  {
    key: 'root_channel',
    name: 'root',
    type: ChannelType.GuildText,
    overwrites: (guild) => [
      { id: guild.roles.everyone.id, allow: [ViewChannel, ReadMessageHistory], deny: [SendMessages] },
      { id: guild.client.user.id, allow: [ViewChannel, SendMessages] },
    ],
  },
  {
    key: 'gm_log_channel',
    name: 'gm-log',
    type: ChannelType.GuildText,
    overwrites: (guild) => privateOverwrites(guild, []),
  },
];

// Idempotent: only (re)creates what is missing. Returns a human summary.
export async function runSetup(client) {
  const guild = await getGuild(client);
  const lines = [];
  for (const item of LAYOUT) {
    const existingId = getSetting(item.key);
    const existing = existingId ? await guild.channels.fetch(existingId).catch(() => null) : null;
    if (existing) {
      lines.push(`✔️ ${existing} existe déjà`);
      continue;
    }
    const created = await guild.channels.create({
      name: item.name,
      type: item.type,
      permissionOverwrites: item.overwrites(guild),
    });
    setSetting(item.key, created.id);
    lines.push(`🆕 ${created} créé`);
  }
  return lines.join('\n');
}

export async function createPrivateChannel(client, { categoryKey, name, memberIds, topic }) {
  const guild = await getGuild(client);
  return guild.channels.create({
    name,
    topic,
    type: ChannelType.GuildText,
    parent: getSetting(categoryKey) ?? undefined,
    permissionOverwrites: privateOverwrites(guild, memberIds),
  });
}
