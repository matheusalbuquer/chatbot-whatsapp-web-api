const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let qrCodeData = null;
let clientStatus = "disconnected";
const messages = [];

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

client.on("qr", async (qr) => {
  clientStatus = "waiting_qr";
  qrCodeData = await qrcode.toDataURL(qr);
  console.log("QR Code gerado");
});

client.on("ready", () => {
  clientStatus = "connected";
  qrCodeData = null;
  console.log("WhatsApp conectado!");
});

client.on("disconnected", () => {
  clientStatus = "disconnected";
  console.log("WhatsApp desconectado");
});

client.on("message", (msg) => {
  messages.push({
    id: msg.id._serialized,
    from: msg.from,
    body: msg.body,
    timestamp: msg.timestamp,
    fromMe: msg.fromMe,
  });
  if (messages.length > 500) messages.shift(); // limita memória
});

// Endpoints
app.get("/status", (req, res) =>
  res.json({ status: clientStatus, qr: qrCodeData }),
);

app.get("/messages", (req, res) => res.json({ messages }));

app.post("/send", async (req, res) => {
  const { number, message } = req.body;
  const chatId = number.replace(/\D/g, "") + "@c.us";
  await client.sendMessage(chatId, message);
  res.json({ success: true });
});

app.listen(3001, () => console.log("Servidor rodando na porta 3001"));
client.initialize();
