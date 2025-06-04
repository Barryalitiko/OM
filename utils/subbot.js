const { exec } = require("child_process");
const path = require("path");

function crearSubBot(nombre, jid, sock) {
  const repo = "https://github.com/usuario/whatsapp-bot"; // Cambia por el tuyo
  const comando = `
    git clone ${repo} ${nombre} &&
    cd ${nombre} &&
    npm install &&
    node index.js "${nombre}"
  `;

  exec(comando, (error, stdout, stderr) => {
    if (error) {
      console.error("Error al crear subbot:", error);
      sock.sendMessage(jid, { text: `❌ Error al crear subbot: ${error.message}` });
      return;
    }
    console.log(`✅ Subbot ${nombre} iniciado`);
    sock.sendMessage(jid, { text: `✅ Subbot ${nombre} iniciado correctamente` });
  });
}

module.exports = { crearSubBot };