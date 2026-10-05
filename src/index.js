import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands/index.js';
import { handleQueryButton } from './commands/root.js';
import { handleRequestButton } from './interactions/requests.js';
import { startScheduler } from './game/scheduler.js';
import { onMessage } from './safety-net.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  await startScheduler(c);
});

client.on(Events.MessageCreate, (message) => onMessage(message).catch(console.error));

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await commands.get(interaction.commandName)?.execute(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('query:')) await handleQueryButton(interaction);
      else if (interaction.customId.startsWith('req:')) await handleRequestButton(interaction);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: 'Erreur interne, prévenez le GM.', flags: MessageFlags.Ephemeral };
    if (interaction.isRepliable()) {
      await (interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload))
        .catch(() => {});
    }
  }
});

client.login(config.token);
