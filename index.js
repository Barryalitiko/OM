const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const { crearSubBot } = require("./utils/subbot");

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
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

  // Actualizar credenciales
  sock.ev.on("creds.update", saveCreds);

  // Si no hay sesión previa, pedir número e iniciar emparejamiento
  if (!state.creds.registered) {
    const phoneNumber = await askQuestion("📱 Ingresa tu número (con + y código de país, ej: +34612345678): ");
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log("\n🔗 Código de vinculación generado:");
      console.log(`➡️ Escribe este código en WhatsApp: ${code}`);
      console.log("➡️ WhatsApp > Dispositivos vinculados > Vincular dispositivo > Ingresar código");
    } catch (err) {
      console.error("❌ Error al generar el código:", err);
    }
  }

  // Eventos
  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log(`✅ Bot "${nombre}" conectado correctamente.`);
    }
    if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      console.log("♻️ Reconectando...");
      iniciarBot(nombre);
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
}

iniciarBot();