import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands/index.js';

// Global registration: guild-scoped commands cannot appear in the bot's DMs.
const rest = new REST().setToken(config.token);
const body = [...commands.values()].map((c) => c.data.toJSON());

await rest.put(Routes.applicationCommands(config.clientId), { body });
// Remove leftovers from any earlier guild-scoped registration.
await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: [] });
console.log(`${body.length} commandes enregistrées : ${body.map((c) => `/${c.name}`).join(', ')}`);
