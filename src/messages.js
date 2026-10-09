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

export const PROTECTED_AGAIN_DM = '🛡️ Vous avez reçu une autre protection, vos alliés sont nombreux !';

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
  'SUBJECT:				[UNKNOWN]',
  'REWARD:				1 ROOT TICKET',
  'STATUS:				PENDING ACTIVATION',
  'ACTIVATION WINDOW:	00:00',
  'AUTHORIZED USE:		AFTER MIDNIGHT',
  '```',
].join('\n');

export const SAFETY_NET_DM = '⚠️ Votre message commençant par `/root` a été supprimé du serveur. '
  + 'Les commandes `/root` s\'utilisent uniquement ici, en message privé avec le bot.';

// /root man — help pages. `killer` commands are only usable by killers.
export const MAN_PAGES = {
  status: {
    summary: 'Vos tickets, votre état et vos commandes disponibles. Gratuit.',
    text: [
      '**/root status** — gratuit',
      'Affiche vos tickets (et ceux en attente jusqu\'à 00:00), votre état (ACTIVE, COMATOSE, protégé…), le jour en cours et les commandes que vous pouvez utiliser.',
    ],
  },
  query: {
    summary: 'Poser une question fermée au GM (1 ticket).',
    text: [
      '**/root query question:** — 1 ticket',
      'Ouvre un canal privé avec le GM, qui répond **YES**, **NO** ou **INVALID QUERY**.',
      'Une question est invalide si elle aide à identifier une personne (sexe, initiale, prénom, apparence, groupe de suspects…). Dans ce cas le ticket n\'est pas remboursé, mais vous pouvez reformuler dans le même canal.',
      'Un écran de confirmation s\'affiche avant de dépenser le ticket.',
    ],
  },
  verify: {
    summary: 'Faire vérifier un indice par le GM (1 ticket).',
    text: [
      '**/root verify** — 1 ticket',
      'Ouvre un canal privé avec le GM. Décrivez votre indice : le GM répond **NOT CORRUPTED** ou **CORRUPTED**.',
    ],
  },
  protect: {
    summary: 'Protéger secrètement un joueur (1 ticket).',
    text: [
      '**/root protect joueur:** — 1 ticket',
      'Protège un joueur (vous-même inclus) jusqu\'à 23:42 : il ne peut être ni plongé dans le coma ni empêché de gagner.',
      'Entre 23:42 et 00:00, la protection s\'applique au jour suivant. C\'est la seule commande à ticket disponible pendant ce verrouillage.',
      'La cible est prévenue en privé, sans savoir qui l\'a protégée.',
    ],
  },
  cure: {
    summary: 'Sortir un joueur du coma (1 ticket).',
    text: [
      '**/root cure joueur:** — 1 ticket',
      'Soigne un joueur COMATOSE : annonce publique dans #root et MP à la cible. Elle ne peut plus être plongée dans le coma pendant 2 jours.',
      'Si la cible n\'est pas dans le coma, `TARGET UNAVAILABLE AT THIS TIME` et aucun ticket n\'est dépensé.',
      'Si vous êtes COMATOSE, vous ne pouvez vous soigner que vous-même.',
    ],
  },
  impede: {
    summary: 'Empêcher un joueur de gagner aujourd\'hui (1 ticket).',
    text: [
      '**/root impede cible1: [cible2:] [cible3:]** — 1 ticket',
      'La cible ne peut pas gagner aujourd\'hui. Personne n\'est prévenu.',
      'Les 3 cibles sont classées par priorité : la première qui peut être touchée l\'est. Sont ignorées : les joueurs protégés, dans le coma, ou empêchés hier.',
      'Si aucune cible n\'est valide, le ticket est quand même dépensé. Vous recevez toujours la même réponse.',
    ],
  },
  coma: {
    killer: true,
    summary: 'Plonger un joueur dans le coma (1 ticket).',
    text: [
      '**/root coma cible1: [cible2:] [cible3:]** — 1 ticket — *tueurs uniquement*',
      'Plonge la première cible valide dans le coma : annonce publique dans #root. Sont ignorés : les joueurs protégés, déjà dans le coma, ou fraîchement soignés (2 jours d\'immunité).',
      'Sans intervention, la cible se réveille seule à 00:00 trois jours plus tard.',
      'Un tueur dans le coma ne peut pas utiliser cette commande. Si aucune cible n\'est valide, le ticket est quand même dépensé.',
    ],
  },
  corrupt: {
    killer: true,
    summary: 'Demande de corruption au GM (1 ticket).',
    text: [
      '**/root corrupt** — 1 ticket — *tueurs uniquement*',
      'Envoie une demande de corruption au GM, qui s\'occupe du reste.',
    ],
  },
  channel: {
    summary: 'Créer un canal privé avec d\'autres joueurs. Gratuit.',
    text: [
      '**/root channel create joueur1: … [joueur9:] [nom:]** — gratuit, illimité',
      'Crée un canal privé avec jusqu\'à 9 joueurs, même si vous êtes dans le coma.',
      'Dans ce canal, vous seul (le créateur) pouvez utiliser `/channel add`, `/channel kick` et `/channel delete`. Le GM voit tous les canaux privés.',
    ],
  },
};

export const manOverview = () => [
  '**ROOT // MANUEL** — `/root man commande:<nom>` pour le détail d\'une commande.',
  '',
  '**Tous les suspects**',
  ...['status', 'query', 'verify', 'protect', 'cure', 'impede', 'channel']
    .map((k) => `• \`/root ${k === 'channel' ? 'channel create' : k}\` — ${MAN_PAGES[k].summary}`),
  '',
  '**Tueurs uniquement**',
  ...['coma', 'corrupt'].map((k) => `• \`/root ${k}\` — ${MAN_PAGES[k].summary}`),
  '',
  'Chaque commande coûte 1 ticket, sauf `status` et `channel`. Tout est bloqué de 23:42 à 00:00, sauf `protect`.',
].join('\n');
