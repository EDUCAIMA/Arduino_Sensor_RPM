// ============================================================
//  Servidor Principal — RPM IoT Monitor
//  Express + WebSocket + MQTT
// ============================================================

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { WebSocketServer } = require('ws');
const { connectMQTT }     = require('./mqtt-client');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');
const WS_PORT = parseInt(process.env.WS_PORT || '3001');

// ============================================================
//  Middleware
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================
//  Routes API
// ============================================================
app.use('/api/procesos',      require('./routes-procesos'));
app.use('/api/lecturas',      require('./routes-lecturas'));
app.use('/api/dispositivos',  require('./routes-dispositivos'));
app.use('/api/config',        require('./routes-configuracion'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ============================================================
//  WebSocket Server
// ============================================================
const wss = new WebSocketServer({ port: WS_PORT });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`🔗 WebSocket client conectado (total: ${wsClients.size})`);

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`🔌 WebSocket client desconectado (total: ${wsClients.size})`);
  });
});

function broadcast(message) {
  wsClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// ============================================================
//  Start
// ============================================================
// Error logging middleware
app.use((err, req, res, next) => {
  const logMsg = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${err.stack}\n`;
  require('fs').appendFileSync(path.join(__dirname, 'server-errors.log'), logMsg);
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     🔧 RPM IoT Monitor Dashboard       ║
  ║                                          ║
  ║  HTTP  → http://localhost:${PORT}           ║
  ║  WS    → ws://localhost:${WS_PORT}             ║
  ╚══════════════════════════════════════════╝
  `);
});

// Conectar MQTT pasando la función broadcast
connectMQTT(broadcast);
