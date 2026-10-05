import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, SlashCommandBuilder,
} from 'discord.js';
import {
  addChannel, ensurePlayer, getGame, getPlayer, logAction, spendTicket, updatePlayer, addCounter,
} from '../db.js';
import { announce, dm, fetchMember, gmLog, isSuspect, reply } from '../guards.js';
import {
  ACTIVE, COMATOSE, CURE_IMMUNITY_DAYS, availableCommands, canBeComa, canBeImpeded, checkUse,
  displayState, isComatose, protectionDay, resolveTarget,
} from '../game/rules.js';
import {
  CURED_DM, ORDER_RECEIVED, QUERY_WARNING, REFUSALS, TARGET_UNAVAILABLE, comaAlert, cureAlert, protectedDM,
} from '../messages.js';
import { config } from '../config.js';
import { openRequest } from '../interactions/requests.js';
import { createPrivateChannel } from '../setup.js';

const targets = (sub, verb) => sub
  .addUserOption((o) => o.setName('cible1').setDescription(`Cible principale à ${verb}`).setRequired(true))
  .addUserOption((o) => o.setName('cible2').setDescription('Première cible de secours'))
  .addUserOption((o) => o.setName('cible3').setDescription('Dernière cible de secours'));

export const data = new SlashCommandBuilder()
  .setName('root')
  .setDescription('ROOT // FORTY2 PROTOCOL')
  .setContexts(InteractionContextType.BotDM)
  .addSubcommand((s) => s.setName('status').setDescription('Vos tickets, votre état et vos commandes'))
  .addSubcommand((s) => s.setName('query').setDescription('Poser une question fermée au GM (1 ticket)')
    .addStringOption((o) => o.setName('question').setDescription('Votre question').setRequired(true).setMaxLength(1000)))
  .addSubcommand((s) => s.setName('verify').setDescription('Faire vérifier un indice par le GM (1 ticket)'))
  .addSubcommand((s) => s.setName('protect').setDescription('Protéger secrètement un joueur (1 ticket)')
    .addUserOption((o) => o.setName('joueur').setDescription('Joueur à protéger').setRequired(true)))
  .addSubcommand((s) => s.setName('cure').setDescription('Sortir un joueur du coma (1 ticket)')
    .addUserOption((o) => o.setName('joueur').setDescription('Joueur à soigner').setRequired(true)))
  .addSubcommand((s) => targets(s.setName('impede').setDescription('Empêcher un joueur de gagner aujourd\'hui (1 ticket)'), 'bloquer'))
  .addSubcommand((s) => targets(s.setName('coma').setDescription('Plonger un joueur dans le coma (1 ticket)'), 'plonger dans le coma'))
  .addSubcommand((s) => s.setName('corrupt').setDescription('Demande de corruption au GM (1 ticket)'))
  .addSubcommandGroup((g) => g.setName('canal').setDescription('Canaux privés entre joueurs')
    .addSubcommand((s) => {
      s.setName('create').setDescription('Créer un canal privé avec d\'autres joueurs');
      for (let i = 1; i <= 9; i++) {
        s.addUserOption((o) => o.setName(`joueur${i}`).setDescription(`Joueur ${i}`).setRequired(i === 1));
      }
      return s.addStringOption((o) => o.setName('nom').setDescription('Nom du canal').setMaxLength(90));
    }));

// Common checks. Returns { player, game } or null after replying with the refusal.
async function prepare(interaction, command) {
  const game = getGame();
  if (!game.started) return void reply(interaction, REFUSALS.notStarted);
  const member = await fetchMember(interaction.client, interaction.user.id);
  if (!isSuspect(member)) return void reply(interaction, REFUSALS.notPlayer);
  const player = ensurePlayer(interaction.user.id);
  if (command) {
    const refusal = checkUse(command, player, { locked: game.locked });
    if (refusal) return void reply(interaction, REFUSALS[refusal]);
  }
  return { player, game };
}

// Validates user options as suspects. Returns ids or null after replying.
async function suspectIds(interaction, users) {
  const ids = users.filter(Boolean).map((u) => u.id);
  if (new Set(ids).size !== ids.length) return void reply(interaction, REFUSALS.duplicateTargets);
  for (const id of ids) {
    if (!isSuspect(await fetchMember(interaction.client, id))) return void reply(interaction, REFUSALS.invalidTarget);
  }
  for (const id of ids) ensurePlayer(id);
  return ids;
}

const pendingQueries = new Map();

const handlers = {
  async status(interaction) {
    const ctx = await prepare(interaction);
    if (!ctx) return;
    const { player, game } = ctx;
    const lines = [
      '```',
      `TICKETS : ${player.tickets}${player.pending_tickets ? ` (+${player.pending_tickets} actif à 00:00)` : ''}`,
      `ÉTAT    : ${displayState(player, game.day)}`,
      `JOUR    : ${game.day}${game.locked ? ' — VERROUILLÉ jusqu\'à 00:00' : ''}`,
      '```',
      `**Commandes disponibles :** ${availableCommands(player).map((c) => `\`${c}\``).join(', ')}`,
    ];
    if (player.protected_day === game.day + 1) lines.push('🛡️ Vous serez protégé demain.');
    return reply(interaction, lines.join('\n'));
  },

  async query(interaction) {
    if (!(await prepare(interaction, 'query'))) return;
    pendingQueries.set(interaction.user.id, interaction.options.getString('question'));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('query:confirm').setLabel('Dépenser 1 ticket').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('query:cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    );
    return reply(interaction, QUERY_WARNING, { components: [row] });
  },

  async verify(interaction) {
    if (!(await prepare(interaction, 'verify'))) return;
    await interaction.deferReply();
    if (!spendTicket(interaction.user.id)) return reply(interaction, REFUSALS.noTicket);
    try {
      const channel = await openRequest(interaction.client, 'verify', interaction.user);
      logAction({ day: getGame().day, authorId: interaction.user.id, type: 'verify' });
      return reply(interaction, `Canal de vérification ouvert : ${channel}`);
    } catch (err) {
      addCounter(interaction.user.id, 'tickets', 1);
      throw err;
    }
  },

  async protect(interaction) {
    const ctx = await prepare(interaction, 'protect');
    if (!ctx) return;
    const ids = await suspectIds(interaction, [interaction.options.getUser('joueur')]);
    if (!ids) return;
    if (!spendTicket(interaction.user.id)) return reply(interaction, REFUSALS.noTicket);
    const { day, locked } = ctx.game;
    updatePlayer(ids[0], { protected_day: protectionDay(day, locked) });
    logAction({ day, authorId: interaction.user.id, type: 'protect', targets: ids, result: locked ? 'next-day' : 'ok' });
    await reply(interaction, ORDER_RECEIVED);
    await dm(interaction.client, ids[0], protectedDM(locked));
    await gmLog(interaction.client, `🛡️ <@${interaction.user.id}> protège <@${ids[0]}>${locked ? ' (pour demain)' : ''}.`);
  },

  async cure(interaction) {
    const ctx = await prepare(interaction, 'cure');
    if (!ctx) return;
    const ids = await suspectIds(interaction, [interaction.options.getUser('joueur')]);
    if (!ids) return;
    const [targetId] = ids;
    if (isComatose(ctx.player) && targetId !== interaction.user.id) return reply(interaction, REFUSALS.cureSelfOnly);
    if (getPlayer(targetId).state !== COMATOSE) return reply(interaction, TARGET_UNAVAILABLE);
    if (!spendTicket(interaction.user.id)) return reply(interaction, REFUSALS.noTicket);
    const { day } = ctx.game;
    updatePlayer(targetId, { state: ACTIVE, coma_day: null, immune_until: day + CURE_IMMUNITY_DAYS });
    logAction({ day, authorId: interaction.user.id, type: 'cure', targets: ids, result: 'ok' });
    await reply(interaction, ORDER_RECEIVED);
    await announce(interaction.client, cureAlert(targetId), [targetId]);
    await dm(interaction.client, targetId, CURED_DM);
    await gmLog(interaction.client, `💉 <@${interaction.user.id}> soigne <@${targetId}>.`);
  },

  impede: (interaction) => hostile(interaction, 'impede'),
  coma: (interaction) => hostile(interaction, 'coma'),

  async corrupt(interaction) {
    const ctx = await prepare(interaction, 'corrupt');
    if (!ctx) return;
    if (!spendTicket(interaction.user.id)) return reply(interaction, REFUSALS.noTicket);
    logAction({ day: ctx.game.day, authorId: interaction.user.id, type: 'corrupt' });
    await reply(interaction, ORDER_RECEIVED);
    await gmLog(interaction.client, `<@&${config.gmRoleId}> CORRUPTION REQUESTED BY <@${interaction.user.id}>`, {
      allowedMentions: { roles: [config.gmRoleId] },
    });
  },

  async 'canal create'(interaction) {
    if (!(await prepare(interaction))) return;
    const users = Array.from({ length: 9 }, (_, i) => interaction.options.getUser(`joueur${i + 1}`))
      .filter((u) => u && u.id !== interaction.user.id);
    const ids = await suspectIds(interaction, users);
    if (!ids) return;
    await interaction.deferReply();
    const channel = await createPrivateChannel(interaction.client, {
      categoryKey: 'private_category',
      name: interaction.options.getString('nom') ?? `canal-${interaction.user.username}`,
      memberIds: [interaction.user.id, ...ids],
      topic: 'Canal privé — le créateur gère les membres avec /channel add, /channel kick, /channel delete',
    });
    addChannel(channel.id, 'group', interaction.user.id);
    await channel.send({
      content: `Canal créé par <@${interaction.user.id}> avec ${ids.map((id) => `<@${id}>`).join(', ') || 'personne d\'autre'}.`,
      allowedMentions: { users: [interaction.user.id, ...ids] },
    });
    await gmLog(interaction.client, `💬 Canal privé ${channel} créé par <@${interaction.user.id}>.`);
    return reply(interaction, `Canal créé : ${channel}`);
  },
};

// coma / impede: up to 3 targets in priority order, the first eligible one is hit.
// The ticket is spent and the reply is identical whatever happens.
async function hostile(interaction, command) {
  const ctx = await prepare(interaction, command);
  if (!ctx) return;
  const ids = await suspectIds(interaction, ['cible1', 'cible2', 'cible3'].map((n) => interaction.options.getUser(n)));
  if (!ids) return;
  if (!spendTicket(interaction.user.id)) return reply(interaction, REFUSALS.noTicket);

  const { day } = ctx.game;
  const eligible = command === 'coma' ? (p) => canBeComa(p, day) : (p) => canBeImpeded(p, day);
  const hit = resolveTarget(ids.map(getPlayer), eligible);
  if (hit && command === 'coma') updatePlayer(hit.id, { state: COMATOSE, coma_day: day });
  if (hit && command === 'impede') updatePlayer(hit.id, { impeded_day: day });
  logAction({ day, authorId: interaction.user.id, type: command, targets: ids, result: hit ? hit.id : 'fail' });

  await reply(interaction, ORDER_RECEIVED);
  const list = ids.map((id) => `<@${id}>`).join(' → ');
  await gmLog(interaction.client, `${command === 'coma' ? '🗡️ COMA' : '⛔ IMPEDE'} par <@${interaction.user.id}> `
    + `[${list}] : ${hit ? `touche <@${hit.id}>` : 'échec (toutes les cibles indisponibles)'}`);
  if (hit && command === 'coma') await announce(interaction.client, comaAlert(hit.id), [hit.id]);
}

export async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  return handlers[group ? `${group} ${sub}` : sub](interaction);
}

// Confirmation buttons of /root query.
export async function handleQueryButton(interaction) {
  const question = pendingQueries.get(interaction.user.id);
  pendingQueries.delete(interaction.user.id);
  if (interaction.customId === 'query:cancel' || !question) {
    return interaction.update({ content: question ? 'Requête annulée.' : 'Requête expirée, relancez `/root query`.', components: [] });
  }
  const ctx = await prepare(interaction, 'query');
  if (!ctx) return;
  await interaction.update({ content: 'Ouverture de la requête…', components: [] });
  if (!spendTicket(interaction.user.id)) return interaction.editReply(REFUSALS.noTicket);
  try {
    const channel = await openRequest(interaction.client, 'query', interaction.user, question);
    logAction({ day: ctx.game.day, authorId: interaction.user.id, type: 'query', result: question });
    return interaction.editReply(`Requête ouverte : ${channel}`);
  } catch (err) {
    addCounter(interaction.user.id, 'tickets', 1);
    throw err;
  }
}
