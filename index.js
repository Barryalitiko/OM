const readline = require("readline");
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { crearSubBot } = require("./utils/subbot");

// Leer desde consola
function question(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

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
    printQRInTerminal: false,
    getMessage: async () => ({ conversation: "mensaje no encontrado" }),
  });

  sock.ev.on("creds.update", saveCreds);

  let yaPidioCodigo = false;

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log(`✅ Bot "${nombre}" conectado correctamente.`);
    }

    if (!yaPidioCodigo && !sock.authState.creds.registered && connection === "open") {
      yaPidioCodigo = true;
      const phone = await question("📱 Ingresa tu número con código de país (ej: +34612345678): ");
      const code = await sock.requestPairingCode(phone.replace(/\D/g, ""));
      console.log(`🔗 Ingresa el siguiente código en WhatsApp: ${code}`);
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("♻️ Reconectando...");
        iniciarBot(nombre);
      } else {
        console.log("⚠️ Sesión cerrada. Reinicia el bot para vincular nuevamente.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
    const from = m.key.remoteJid;

    if (body.startsWith("!subbot crear")) {
      const parts = body.split(" ");
      const subbotName = parts[2] || `subbot_${Date.now()}`;

      await sock.sendMessage(from, { text: `🛠️ Creando subbot: ${subbotName}...` });
      crearSubBot(subbotName, from, sock);
    }
  });

  return sock;
}

iniciarBot();