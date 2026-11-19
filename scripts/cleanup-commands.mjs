// One-shot command cleanup — run from the repo root:
//   docker compose exec bot node scripts/cleanup-commands.mjs
// Syncs global commands to what's actually in the build, then wipes every
// guild-scoped command (they shadow globals and survive global bulk-overwrites).
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID;

const { CommandHandler } = await import('../dist/handlers/commandHandler.js');
const handler = new CommandHandler();
const commands = await handler.loadCommandsForRegistration();
const names = () => commands.map(c => c.data.name).join(', ');

// Entry Point commands (type 4 / user-install) must be re-sent verbatim in any
// bulk update, or Discord rejects the whole PUT with code 50240.
const existing = await rest.get(Routes.applicationCommands(clientId));
const entryPoints = existing.filter(c => c.type === 4 || (c.integration_types || []).includes(1));
for (const ep of entryPoints) console.log(`[global] preserving Entry Point: ${ep.name}`);

// 1) global: bulk-overwrite with the real set
await rest.put(Routes.applicationCommands(clientId), { body: [...commands, ...entryPoints] });
console.log(`[global] synced ${commands.length} commands: ${names()}`);

// 2) guild scope: wipe everywhere the bot can see
const envGuilds = (process.env.GUILD_IDS || process.env.GUILD_ID || '')
  .split(',').map(s => s.trim()).filter(Boolean);

if (envGuilds.length) {
  for (const gid of envGuilds) {
    await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: [] });
    console.log(`[guild ${gid}] wiped`);
  }
} else {
  // no guild ids configured — log in briefly to enumerate guilds
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
    client.login(process.env.DISCORD_TOKEN);
  });
  for (const [gid, guild] of client.guilds.cache) {
    await rest.put(Routes.applicationGuildCommands(clientId, gid), { body: [] });
    console.log(`[guild ${gid} "${guild.name}"] wiped`);
  }
  client.destroy();
}

console.log('DONE — Discord now shows only:', names());
process.exit(0);
