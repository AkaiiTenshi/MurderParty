import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import {
  addCounter, allPlayers, dailyScores, ensurePlayer, getGame, getPlayer, logAction, startGame, updatePlayer,
} from '../db.js';
import { fetchMember, getGuild, gmLog, isGM, isSuspect } from '../guards.js';
import { parisNow } from '../game/clock.js';
import { ACTIVE, COMATOSE, displayState } from '../game/rules.js';
import { endDay, midnight } from '../game/scheduler.js';
import { runSetup } from '../setup.js';
import { REFUSALS } from '../messages.js';

const player = (s) => s.addUserOption((o) => o.setName('joueur').setDescription('Joueur').setRequired(true));
const amount = (s) => player(s).addIntegerOption((o) => o.setName('nombre').setDescription('Nombre').setRequired(true).setMinValue(1));

export const data = new SlashCommandBuilder()
  .setName('rootgm')
  .setDescription('Commandes du GM')
  // Hidden from everyone but administrators; the GM role is allowed in the server's
  // Integrations settings. DMs ignore these permissions, so the command stays server-only.
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0)
  .addSubcommand((s) => s.setName('setup').setDescription('Créer les salons du jeu (sans effet sur ceux qui existent)'))
  .addSubcommand((s) => s.setName('start').setDescription('⚠️ Remet TOUT à zéro et démarre le jour 1 aujourd\'hui')
    .addBooleanOption((o) => o.setName('confirmer').setDescription('Confirmer la remise à zéro').setRequired(true)))
  .addSubcommandGroup((g) => g.setName('killer').setDescription('Gérer les tueurs')
    .addSubcommand((s) => player(s.setName('add').setDescription('Désigner un tueur')))
    .addSubcommand((s) => player(s.setName('remove').setDescription('Retirer un tueur')))
    .addSubcommand((s) => s.setName('list').setDescription('Lister les tueurs')))
  .addSubcommandGroup((g) => g.setName('points').setDescription('Points du jour')
    .addSubcommand((s) => amount(s.setName('add').setDescription('Ajouter des points')))
    .addSubcommand((s) => amount(s.setName('remove').setDescription('Retirer des points'))))
  .addSubcommandGroup((g) => g.setName('ticket').setDescription('Tickets')
    .addSubcommand((s) => amount(s.setName('add').setDescription('Ajouter des tickets')))
    .addSubcommand((s) => amount(s.setName('remove').setDescription('Retirer des tickets'))))
  .addSubcommand((s) => player(s.setName('state').setDescription('Forcer l\'état d\'un joueur'))
    .addStringOption((o) => o.setName('etat').setDescription('Nouvel état').setRequired(true)
      .addChoices({ name: 'active', value: ACTIVE }, { name: 'comatose', value: COMATOSE })))
  .addSubcommand((s) => s.setName('rank').setDescription('Classement du jour (points, tickets, états)'))
  .addSubcommand((s) => s.setName('grank').setDescription('Historique : points et gagnants de chaque jour'))
  .addSubcommand((s) => s.setName('endday').setDescription('Forcer le traitement de 23:42 (tests / urgence)'))
  .addSubcommand((s) => s.setName('reset').setDescription('Forcer le passage à minuit (tests / urgence)'));

// Ephemeral, split in chunks under Discord's 2000-character limit.
async function send(interaction, text) {
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (current.length + line.length + 1 > 1900) {
      chunks.push(current);
      current = '';
    }
    current += `${line}\n`;
  }
  chunks.push(current);
  const flags = MessageFlags.Ephemeral;
  const allowedMentions = { parse: [] };
  if (interaction.deferred) await interaction.editReply({ content: chunks[0], allowedMentions });
  else await interaction.reply({ content: chunks[0], flags, allowedMentions });
  for (const chunk of chunks.slice(1)) await interaction.followUp({ content: chunk, flags, allowedMentions });
}

async function targetPlayer(interaction) {
  const user = interaction.options.getUser('joueur');
  if (!isSuspect(await fetchMember(interaction.client, user.id))) return null;
  return ensurePlayer(user.id);
}

function rankText() {
  const { day, locked } = getGame();
  const rows = allPlayers().sort((a, b) => b.points - a.points);
  const lines = [`**Jour ${day}**${locked ? ' (verrouillé)' : ''} — points / tickets / gains`];
  for (const p of rows) {
    const flags = [
      displayState(p, day),
      p.impeded_day === day ? 'IMPEDED' : null,
      p.is_killer ? 'KILLER' : null,
    ].filter(Boolean).join(', ');
    const pending = p.pending_tickets ? ` (+${p.pending_tickets})` : '';
    lines.push(`<@${p.id}> — ${p.points} pts · ${p.tickets}${pending} 🎟️ · ${p.wins} 🏆 · ${flags}`);
  }
  return lines.join('\n');
}

function grankText() {
  const byDay = new Map();
  for (const s of dailyScores()) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day).push(s);
  }
  if (!byDay.size) return 'Aucune journée terminée.';
  const lines = [];
  for (const [day, scores] of byDay) {
    lines.push(`**Jour ${day}**`);
    for (const s of scores) {
      lines.push(`${s.winner ? '🏆' : '·'} <@${s.player_id}> — ${s.points} pts${s.impeded ? ' (impeded)' : ''}`);
    }
  }
  return lines.join('\n');
}

const handlers = {
  async setup(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return send(interaction, await runSetup(interaction.client));
  },

  async start(interaction) {
    if (!interaction.options.getBoolean('confirmer')) return send(interaction, 'Démarrage annulé.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = await getGuild(interaction.client);
    const members = await guild.members.fetch();
    const ids = members.filter(isSuspect).map((m) => m.id);
    startGame(parisNow().date, ids);
    await gmLog(interaction.client, `🚀 Partie démarrée — jour 1, ${ids.length} suspects.`);
    return send(interaction, `Partie démarrée : jour 1, ${ids.length} suspects enregistrés.`);
  },

  async 'killer add'(interaction) {
    const p = await targetPlayer(interaction);
    if (!p) return send(interaction, REFUSALS.invalidTarget);
    updatePlayer(p.id, { is_killer: 1 });
    return send(interaction, `<@${p.id}> est désormais tueur.`);
  },

  async 'killer remove'(interaction) {
    const p = await targetPlayer(interaction);
    if (!p) return send(interaction, REFUSALS.invalidTarget);
    updatePlayer(p.id, { is_killer: 0 });
    return send(interaction, `<@${p.id}> n'est plus tueur.`);
  },

  async 'killer list'(interaction) {
    const killers = allPlayers().filter((p) => p.is_killer);
    return send(interaction, killers.length ? killers.map((p) => `<@${p.id}>`).join(', ') : 'Aucun tueur.');
  },

  'points add': (i) => counter(i, 'points', 1),
  'points remove': (i) => counter(i, 'points', -1),
  'ticket add': (i) => counter(i, 'tickets', 1),
  'ticket remove': (i) => counter(i, 'tickets', -1),

  async state(interaction) {
    const p = await targetPlayer(interaction);
    if (!p) return send(interaction, REFUSALS.invalidTarget);
    const state = interaction.options.getString('etat');
    const { day } = getGame();
    updatePlayer(p.id, state === COMATOSE ? { state, coma_day: day } : { state, coma_day: null });
    logAction({ day, authorId: interaction.user.id, type: 'gm-state', targets: [p.id], result: state });
    return send(interaction, `<@${p.id}> est maintenant ${state}.`);
  },

  rank: (interaction) => send(interaction, rankText()),
  grank: (interaction) => send(interaction, grankText()),

  async endday(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const winners = await endDay(interaction.client);
    return send(interaction, winners ? `Fin de journée traitée (${winners.length} gagnant(s)).` : 'Déjà traitée ou partie non démarrée.');
  },

  async reset(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await midnight(interaction.client);
    return send(interaction, `Passage à minuit effectué : jour ${getGame().day}.`);
  },
};

async function counter(interaction, column, sign) {
  const p = await targetPlayer(interaction);
  if (!p) return send(interaction, REFUSALS.invalidTarget);
  const n = interaction.options.getInteger('nombre') * sign;
  addCounter(p.id, column, n);
  logAction({ day: getGame().day, authorId: interaction.user.id, type: `gm-${column}`, targets: [p.id], result: String(n) });
  return send(interaction, `<@${p.id}> : ${getPlayer(p.id)[column]} ${column === 'points' ? 'points' : 'ticket(s)'}.`);
}

export async function execute(interaction) {
  if (!isGM(await fetchMember(interaction.client, interaction.user.id))) return send(interaction, REFUSALS.notGM);
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  return handlers[group ? `${group} ${sub}` : sub](interaction);
}
