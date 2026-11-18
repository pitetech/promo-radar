// WhatsApp delivery through Baileys (unofficial WhatsApp Web protocol).
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Opens a WhatsApp session.
 * - Normal runs reuse the session saved in <dataDir>/wa-auth.
 * - `pairing: true` shows a QR code (terminal + <dataDir>/qr.png), or, when the
 *   PAIR_PHONE env var is set (e.g. 5511999999999), prints an 8-character
 *   pairing code to type in WhatsApp > Linked devices > Link with phone number.
 */
export async function connect(cfg, { pairing = false } = {}) {
  const authDir = path.join(cfg.dataDir, 'wa-auth');
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  const pairPhone = process.env.PAIR_PHONE;

  return new Promise((resolve, reject) => {
    const open = () => {
      const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: process.env.WA_LOG || 'silent' }),
        printQRInTerminal: false,
      });
      sock.ev.on('creds.update', saveCreds);
      let codeRequested = false;
      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr && pairing) {
          if (pairPhone) {
            if (!codeRequested) {
              codeRequested = true;
              console.log('PAIRING CODE:', await sock.requestPairingCode(pairPhone));
            }
          } else {
            console.log('Scan the QR code (WhatsApp > Linked devices > Link a device):');
            qrcodeTerminal.generate(qr, { small: true });
            QRCode.toFile(path.join(cfg.dataDir, 'qr.png'), qr, { width: 480, margin: 2 });
          }
        }
        if (connection === 'open') resolve(sock);
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code === DisconnectReason.loggedOut) return reject(new Error('Logged out. Run `npm run pair` again.'));
          if (!pairing && !state.creds.registered) return reject(new Error('No WhatsApp session. Run `npm run pair` first.'));
          open(); // reconnect (e.g. restart right after pairing)
        }
      });
    };
    open();
  });
}

export function toJid(destination) {
  if (destination.includes('@')) return destination;
  return `${destination.replace(/\D/g, '')}@s.whatsapp.net`;
}

export async function sendImage(sock, destination, buffer, caption) {
  await sock.sendMessage(toJid(destination), { image: buffer, caption });
}
