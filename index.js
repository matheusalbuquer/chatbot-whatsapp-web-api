const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();

app.use(cors());
app.use(express.json());

let qrCodeData = null;
let clientStatus = "starting";
const messages = [];

// ===============================
// WHATSAPP
// ===============================

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },
});

// ===============================
// EVENTOS
// ===============================

client.on("loading_screen", (percent, message) => {
  console.log(`Loading ${percent}% - ${message}`);
});

client.on("change_state", (state) => {
  console.log("State:", state);
});

client.on("qr", async (qr) => {
  clientStatus = "waiting_qr";
  qrCodeData = await qrcode.toDataURL(qr);

  console.log("=================================");
  console.log("QR CODE GERADO");
  console.log("=================================");
});

client.on("authenticated", () => {
  console.log("WhatsApp autenticado!");
});

client.on("ready", () => {
  clientStatus = "connected";
  qrCodeData = null;

  console.log("=================================");
  console.log("WHATSAPP CONECTADO");
  console.log("=================================");
});

client.on("auth_failure", (msg) => {
  clientStatus = "auth_failure";
  console.error("Falha na autenticação:", msg);
});

client.on("disconnected", (reason) => {
  clientStatus = "disconnected";
  console.log("WhatsApp desconectado:", reason);
});

client.on("message", (msg) => {
  messages.push({
    id: msg.id._serialized,
    from: msg.from,
    body: msg.body,
    timestamp: msg.timestamp,
    fromMe: msg.fromMe,
  });

  if (messages.length > 500) {
    messages.shift();
  }
});

// ===============================
// ROTAS
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "WhatsApp API Online",
    status: clientStatus,
  });
});

app.get("/status", (req, res) => {
  res.json({
    status: clientStatus,
    qr: qrCodeData,
  });
});

app.get("/messages", (req, res) => {
  res.json({
    messages,
  });
});

app.post("/send", async (req, res) => {
  try {
    if (clientStatus !== "connected") {
      return res.status(400).json({
        success: false,
        error: "WhatsApp não conectado",
      });
    }

    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: "Número e mensagem obrigatórios",
      });
    }

    const chatId = number.replace(/\D/g, "") + "@c.us";

    await client.sendMessage(chatId, message);

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ===============================
// SERVIDOR
// ===============================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// ===============================
// INICIALIZAÇÃO
// ===============================

(async () => {
  try {
    console.log("Inicializando WhatsApp...");
    await client.initialize();
    console.log("initialize() finalizado.");
  } catch (err) {
    clientStatus = "error";
    console.error("Erro ao iniciar WhatsApp:", err);
  }
})();
