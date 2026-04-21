const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const dotenv = require('dotenv');
const { Client, LocalAuth } = require('whatsapp-web.js');
const bot = require('./bot');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WhatsApp client setup
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

// WhatsApp event wiring
client.on('qr', async (qr) => {
  try {
    const base64QR = await QRCode.toDataURL(qr);
    io.emit('qr', { qr: base64QR });
    io.emit('status', 'qr_ready');
  } catch (err) {
    console.error('QR generation error:', err);
  }
});

client.on('authenticated', () => {
  io.emit('status', 'authenticated');
});

client.on('ready', () => {
  io.emit('status', 'ready');
  console.log('WhatsApp Client Ready');
});

client.on('message', async (message) => {
  try {
    await bot.handleMessage(client, message);
  } catch (err) {
    console.error('Message handling error:', err);
  }
});

client.on('disconnected', (reason) => {
  io.emit('status', 'disconnected');
  console.log('WhatsApp Client Disconnected:', reason);

  // Attempt to reinitialize after 10 seconds
  setTimeout(() => {
    client.initialize();
  }, 10000);
});

client.on('connecting', () => {
  io.emit('status', 'connecting');
});

// Initialize WhatsApp client
client.initialize();

// Start HTTP server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io };
