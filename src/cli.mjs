#!/usr/bin/env node
import { commands } from './commands.mjs';
import { log } from './log.mjs';

const HELP = `promo-radar - watches public Facebook/Instagram pages and forwards new posts to WhatsApp

Usage: node src/cli.mjs <command> [options]

Commands:
  run                      Send only new posts since the last run (default)
  collect                  Read-only: print what every source returns
  pair                     Link the WhatsApp number (QR code, or PAIR_PHONE for a pairing code)
  find-group <name> [--save]  List WhatsApp groups matching <name>; --save writes the id to config.json
  send-latest              Send the newest post of every source
  send-post <id:code> ...  Send specific Instagram posts

Options:
  --dry-run                Never connect to WhatsApp or change state (run, send-latest, send-post)
  --help                   Show this help
`;

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => [a.replace(/^--/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase()), true]));
const positional = argv.filter((a) => !a.startsWith('--'));
const name = positional[0] || 'run';

if (flags.help || !commands[name]) {
  console.log(HELP);
  process.exit(flags.help ? 0 : 1);
}

try {
  await commands[name]({ args: positional.slice(1), flags, dryRun: Boolean(flags.dryRun) });
  process.exit(0);
} catch (err) {
  log('ERROR:', err.message);
  process.exit(1);
}
