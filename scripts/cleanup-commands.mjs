// One-shot command cleanup — run from the repo root:
//   docker compose exec bot node scripts/cleanup-commands.mjs
// Wipes guild-scoped leftovers first (independent of global sync), then
// bulk-overwrites global commands from the actual build, preserving true
// Entry Point commands verbatim.
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID;

const { CommandHandler } = await import('../dist/handlers/commandHandler.js');
const handler = new CommandHandler();
const commands = await handler.loadCommandsForRegistration();
const names = () => commands.map(c => c.name).join(', ');

// Resolve guild list: env config, or a brief gateway login to enumerate.
const envGuilds = (process.env.GUILD_IDS || process.env.GUILD_ID || '')
  .split(',').map(s => s.trim()).filter(Boolean);
let guilds = envGuilds.map((gid, i) => ({ id: gid, name: envGuilds.length > 1 ? `guild ${i + 1}` : 'configured guild' }));

if (!guilds.length) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
    client.login(process.env.DISCORD_TOKEN);
  });
  guilds = [...client.guilds.cache.values()].map(g => ({ id: g.id, name: g.name }));
  client.destroy();
}

// 1) guild wipe — runs first so a global-PUT failure can't skip the actual fix
for (const g of guilds) {
  await rest.put(Routes.applicationGuildCommands(clientId, g.id), { body: [] });
  console.log(`[guild ${g.id} "${g.name}"] wiped`);
}

// 2) global bulk overwrite. Only type 4 commands are true Entry Points —
// integration_types containing 1 is just the user-install flag (old commands
// carry it too; keeping them resurrected dead commands and broke the PUT).
const existing = await rest.get(Routes.applicationCommands(clientId));
const entryPoints = existing.filter(c => c.type === 4);
const epNames = entryPoints.map(c => c.name);
for (const ep of entryPoints) console.log(`[global] preserving Entry Point: ${ep.name}`);

const body = [...commands.filter(c => !epNames.includes(c.name)), ...entryPoints];
const bodyNames = new Set(body.map(c => c.name));
const deleted = existing.filter(c => !bodyNames.has(c.name)).map(c => c.name);
if (deleted.length) console.log(`[global] deleting: ${deleted.join(', ')}`);

try {
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`[global] synced ${body.length} commands: ${body.map(c => c.name).join(', ')}`);
} catch (err) {
  console.error('[global] sync FAILED (guild wipe above already applied — re-run to retry global):', err.message);
  process.exit(1);
}

console.log('DONE — Discord now shows only:', names(), '+ entry points');
process.exit(0);
