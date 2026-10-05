// Every player-facing text lives here so it can be tweaked without touching the logic.
// Themed system strings are kept in English on purpose.

export const ORDER_RECEIVED = 'Your order has been received.';
export const TARGET_UNAVAILABLE = 'TARGET UNAVAILABLE AT THIS TIME';
export const CURED_DM = 'You have been cured. Welcome back!';

export const REFUSALS = {
  unavailable: 'Commande non disponible.',
  comatose: 'Vous êtes COMATOSE : votre ticket ne peut servir qu\'à `/root cure` sur vous-même.',
  locked: 'Le système est verrouillé entre 23:42 et 00:00. Seul `/root protect` reste disponible (effet le lendemain).',
  noTicket: 'Vous n\'avez aucun ticket disponible.',
  notStarted: 'La partie n\'a pas encore commencé.',
  notPlayer: 'Vous ne faites pas partie des suspects.',
  notGM: 'Commande réservée au GM.',
  invalidTarget: 'Cible invalide : elle doit faire partie des suspects.',
  duplicateTargets: 'Les cibles doivent être des joueurs différents.',
  cureSelfOnly: 'Vous êtes COMATOSE : vous ne pouvez soigner que vous-même.',
};

export const comaAlert = (userId) => `SYSTEM ALERT — <@${userId}> is now COMATOSE.`;
export const cureAlert = (userId) => `SYSTEM ALERT — <@${userId}> is no longer COMATOSE.`;
export const wakeAlert = (userId) => `SYSTEM ALERT — <@${userId}> has woken up from COMA.`;

export const protectedDM = (nextDay) => nextDay
  ? '🛡️ Vous serez **protégé** demain, de 00:00 à 23:42.'
  : '🛡️ Vous êtes **protégé** jusqu\'à la fin de la journée.';

export const winnerDM = '🎟️ Vous avez remporté la journée. **1 ROOT TICKET** en attente — utilisable à partir de 00:00.';

export const QUERY_WARNING = [
  '**Avant de dépenser un ticket :**',
  'Le GM ne peut répondre que **YES**, **NO** ou **INVALID QUERY**.',
  'Une question est **invalide** si elle sert à identifier directement ou indirectement une personne',
  '(sexe du coupable, initiale, prénom, apparence, groupe de suspects…).',
  'En cas de INVALID QUERY, le ticket n\'est pas remboursé mais vous pouvez reformuler dans le même canal.',
].join('\n');

export const dailyReport = () => [
  '# ROOT // FORTY2 PROTOCOL',
  '## Daily ticket attribution report',
  '```',
  '23:42:00',
  'DAILY SCORE ANALYSIS...',
  'PROCESSING RESULTS...',
  'RANKING LOCKED',
  'TICKET OWNER IDENTIFIED',
  'SUBJECT: [UNKNOWN]',
  'REWARD: 1 ROOT TICKET',
  'STATUS: PENDING ACTIVATION',
  'ACTIVATION WINDOW: 00:00',
  'AUTHORIZED USE: AFTER MIDNIGHT',
  '```',
].join('\n');

export const SAFETY_NET_DM = '⚠️ Votre message commençant par `/root` a été supprimé du serveur. '
  + 'Les commandes `/root` s\'utilisent uniquement ici, en message privé avec le bot.';
