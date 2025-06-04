const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const { crearSubBot } = require("./utils/subbot");

async function iniciarBot(nombre = "principal") {
  const { state, saveCreds } = await useMultiFileAuthState(`./session/${nombre}`);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    browser: ["KRAMPUSS", "Chrome", "1.0"],
    printQRInTerminal: false, // ❌ No usamos QR
    getMessage: async (key) => ({
      conversation: "mensaje no encontrado",
    }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, code }) => {
    if (code) {
      console.log("🔗 Código de vinculación generado:");
      console.log(`➡️ Escribe este código en WhatsApp: ${code}`);
      console.log("➡️ WhatsApp > Dispositivos vinculados > Vincular dispositivo > Ingresar código");
    }

    if (connection === "open") {
      console.log(`✅ Bot "${nombre}" conectado correctamente.`);
    }

    if (
      connection === "close" &&
      (!lastDisconnect?.error || lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut)
    ) {
      console.log("♻️ Reconectando...");
      iniciarBot(nombre);
    }
  });

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
}

iniciarBot();