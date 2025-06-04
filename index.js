const readline = require("readline");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { crearSubBot } = require("./utils/subbot");

// Función para leer línea por consola (promesas)
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
    getMessage: async (key) => ({ conversation: "mensaje no encontrado" }),
  });

  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState.creds.registered) {
    console.log("📱 Ingresa tu número con código de país (ejemplo +34612345678):");
    const phoneNumber = await question("> ");
    const onlyDigits = phoneNumber.replace(/\D/g, "");
    const code = await sock.requestPairingCode(onlyDigits);
    console.log("🔗 Código de emparejamiento generado:");
    console.log(`➡️ Ingrésalo en WhatsApp > Dispositivos vinculados > Vincular dispositivo > Ingresar código: ${code}`);
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log(`✅ Bot "${nombre}" conectado correctamente.`);
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("♻️ Reconectando...");
        iniciarBot(nombre);
      } else {
        console.log("⚠️ Sesión cerrada. Reinicia el bot para volver a vincular.");
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