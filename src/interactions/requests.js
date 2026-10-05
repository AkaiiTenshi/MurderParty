import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { addChannel, getChannel, removeChannel } from '../db.js';
import { createPrivateChannel } from '../setup.js';
import { fetchMember, gmLog, isGM, reply } from '../guards.js';
import { config } from '../config.js';

// query / verify: one fresh channel per request, player + GM only, closed by the GM.

const ANSWERS = {
  query: [
    { id: 'yes', label: 'YES', style: ButtonStyle.Success },
    { id: 'no', label: 'NO', style: ButtonStyle.Danger },
    { id: 'invalid', label: 'INVALID QUERY', style: ButtonStyle.Secondary },
  ],
  verify: [
    { id: 'clean', label: 'NOT CORRUPTED', style: ButtonStyle.Success },
    { id: 'corrupted', label: 'CORRUPTED', style: ButtonStyle.Danger },
  ],
};

const ANSWER_TEXT = {
  yes: '**YES**',
  no: '**NO**',
  invalid: '**INVALID QUERY** — vous pouvez reformuler votre question ici.',
  clean: '**NOT CORRUPTED**',
  corrupted: '**CORRUPTED**',
};

function buttons(kind) {
  const row = new ActionRowBuilder();
  for (const a of ANSWERS[kind]) {
    row.addComponents(new ButtonBuilder().setCustomId(`req:${a.id}`).setLabel(a.label).setStyle(a.style));
  }
  row.addComponents(new ButtonBuilder().setCustomId('req:close').setLabel('🔒 Fermer').setStyle(ButtonStyle.Secondary));
  return [row];
}

export async function openRequest(client, kind, user, question) {
  const channel = await createPrivateChannel(client, {
    categoryKey: 'requests_category',
    name: `${kind}-${user.username}`,
    memberIds: [user.id],
  });
  addChannel(channel.id, kind, user.id);

  const intro = kind === 'query'
    ? `<@&${config.gmRoleId}> — **QUERY** de <@${user.id}> :\n> ${question}`
    : `<@&${config.gmRoleId}> — **VERIFY** demandé par <@${user.id}>.\n<@${user.id}>, décrivez ici l'indice à vérifier.`;
  await channel.send({
    content: intro,
    components: buttons(kind),
    allowedMentions: { roles: [config.gmRoleId], users: [user.id] },
  });
  await gmLog(client, `📨 ${kind.toUpperCase()} ouverte par <@${user.id}> : ${channel}`);
  return channel;
}

async function transcript(channel) {
  const messages = [];
  let before;
  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last().id;
  }
  return messages
    .reverse()
    .map((m) => {
      const files = m.attachments.map((a) => a.url).join(' ');
      return `[${m.createdAt.toISOString()}] ${m.author.username}: ${m.content}${files ? ` ${files}` : ''}`;
    })
    .join('\n');
}

export async function handleRequestButton(interaction) {
  const row = getChannel(interaction.channelId);
  if (!row || !['query', 'verify'].includes(row.kind)) return reply(interaction, 'Canal de requête inconnu.');
  const member = await fetchMember(interaction.client, interaction.user.id);
  if (!isGM(member)) return reply(interaction, 'Seul le GM peut répondre.');

  const action = interaction.customId.split(':')[1];
  if (action !== 'close') {
    await interaction.reply({ content: `GM : ${ANSWER_TEXT[action]}` });
    await gmLog(interaction.client, `↪️ ${row.kind.toUpperCase()} de <@${row.owner_id}> : ${ANSWER_TEXT[action]}`);
    return;
  }

  await interaction.deferUpdate();
  const channel = interaction.channel;
  const text = await transcript(channel);
  await gmLog(interaction.client, `🔒 ${row.kind.toUpperCase()} de <@${row.owner_id}> fermée (#${channel.name}).`, {
    files: [new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: `${channel.name}.txt` })],
  });
  removeChannel(channel.id);
  await channel.delete();
}
