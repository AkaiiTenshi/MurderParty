import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getChannel, removeChannel } from '../db.js';
import { fetchMember, gmLog, isSuspect, reply } from '../guards.js';
import { MEMBER_ALLOW } from '../setup.js';

// Management of player group channels, only from inside the channel, creator only.

export const data = new SlashCommandBuilder()
  .setName('channel')
  .setDescription('Gérer votre canal privé (à utiliser dans le canal)')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName('add').setDescription('Ajouter un joueur au canal')
    .addUserOption((o) => o.setName('joueur').setDescription('Joueur à ajouter').setRequired(true)))
  .addSubcommand((s) => s.setName('kick').setDescription('Retirer un joueur du canal')
    .addUserOption((o) => o.setName('joueur').setDescription('Joueur à retirer').setRequired(true)))
  .addSubcommand((s) => s.setName('delete').setDescription('Supprimer le canal'));

export async function execute(interaction) {
  const row = getChannel(interaction.channelId);
  if (!row || row.kind !== 'group' || row.owner_id !== interaction.user.id) {
    return reply(interaction, 'Cette commande ne fonctionne que dans un canal privé que vous avez créé.');
  }
  const channel = interaction.channel;
  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser('joueur');

  if (sub === 'add') {
    if (!isSuspect(await fetchMember(interaction.client, target.id))) {
      return reply(interaction, 'Cible invalide : elle doit faire partie des suspects.');
    }
    await channel.permissionOverwrites.edit(target.id, Object.fromEntries(MEMBER_ALLOW.map((p) => [p, true])));
    await reply(interaction, 'Joueur ajouté.');
    await channel.send({ content: `<@${target.id}> a été ajouté au canal.`, allowedMentions: { users: [target.id] } });
    return;
  }

  if (sub === 'kick') {
    if (target.id === interaction.user.id) return reply(interaction, 'Vous ne pouvez pas vous retirer de votre propre canal.');
    await channel.permissionOverwrites.delete(target.id);
    await reply(interaction, 'Joueur retiré.');
    await channel.send({ content: `<@${target.id}> a été retiré du canal.`, allowedMentions: { parse: [] } });
    return;
  }

  await reply(interaction, 'Suppression du canal…');
  await gmLog(interaction.client, `🗑️ Canal privé #${channel.name} supprimé par <@${interaction.user.id}>.`);
  removeChannel(channel.id);
  await channel.delete();
}

