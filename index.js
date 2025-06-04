const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const { crearSubBot } = require("./utils/subbot");

async function iniciarBot(nombre = "principal") {
  const { state, saveCreds } = await useMultiFileAuthState(`./session/${nombre}`);

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
    const from = m.key.remoteJid;

    // Comando para crear subbot
    if (body.startsWith("!subbot crear")) {
      const parts = body.split(" ");
      const subbotName = parts[2] || `subbot_${Date.now()}`;

      await sock.sendMessage(from, { text: `🛠️ Creando subbot: ${subbotName}...` });
      crearSubBot(subbotName, from, sock);
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      iniciarBot(nombre);
    }
  });
}

iniciarBot();