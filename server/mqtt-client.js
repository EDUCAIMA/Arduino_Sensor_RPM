// ============================================================
//  Cliente MQTT → suscripción a EMQX Cloud (TLS)
//  Recibe datos del ESP32 y los almacena en MySQL
// ============================================================

const mqtt = require('mqtt');
const db   = require('./db');
require('dotenv').config();

let wsBroadcast = null;         // se inyecta desde index.js
let procesoActivo = null;       // cache del proceso activo

// ============================================================
//  Buscar o crear dispositivo
// ============================================================
async function getOrCreateDevice(clientId) {
  const [rows] = await db.execute(
    'SELECT id FROM dispositivos WHERE client_id = ?', [clientId]
  );
  if (rows.length > 0) return rows[0].id;

  const [result] = await db.execute(
    'INSERT INTO dispositivos (client_id, nombre) VALUES (?, ?)',
    [clientId, `Sensor ${clientId}`]
  );
  return result.insertId;
}

// ============================================================
//  Obtener proceso activo
// ============================================================
async function getProcesoActivo() {
  const [rows] = await db.execute(
    `SELECT id, dispositivo_id, nombre FROM procesos
     WHERE estado = 'activo' ORDER BY id DESC LIMIT 1`
  );
  return rows.length > 0 ? rows[0] : null;
}

// ============================================================
//  Conectar MQTT
// ============================================================
function connectMQTT(broadcastFn) {
  wsBroadcast = broadcastFn;

  const options = {
    port:     parseInt(process.env.MQTT_PORT || '8883'),
    protocol: 'mqtts',
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    clientId: `dashboard-${Date.now()}`,
    rejectUnauthorized: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };

  const url = `mqtts://${process.env.MQTT_SERVER}`;
  console.log(`🔌 Conectando MQTT a ${url}:${options.port}...`);

  const client = mqtt.connect(url, options);

  client.on('connect', () => {
    console.log('✅ MQTT conectado a EMQX Cloud');
    client.subscribe(process.env.MQTT_TOPIC_RPM    || 'rpm/datos');
    client.subscribe(process.env.MQTT_TOPIC_STATUS  || 'rpm/estado');
  });

  client.on('error', err => {
    console.error('❌ MQTT error:', err.message);
  });

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());

      if (topic === (process.env.MQTT_TOPIC_RPM || 'rpm/datos')) {
        await handleRPM(data);
      } else if (topic === (process.env.MQTT_TOPIC_STATUS || 'rpm/estado')) {
        await handleStatus(data);
      }
    } catch (err) {
      console.error('Error procesando mensaje MQTT:', err.message);
    }
  });

  return client;
}

// ============================================================
//  Manejar lectura RPM
// ============================================================
async function handleRPM(data) {
  // Refresh proceso activo cache
  if (!procesoActivo) {
    procesoActivo = await getProcesoActivo();
  }
  if (!procesoActivo) {
    // No hay proceso activo — no guardar pero sí reenviar al WS
    if (wsBroadcast) {
      wsBroadcast(JSON.stringify({ type: 'rpm_live', ...data, sinProceso: true }));
    }
    return;
  }

  // Insertar lectura
  await db.execute(
    `INSERT INTO lecturas_rpm (proceso_id, dispositivo_id, pulsos, rpm, uptime_seg)
     VALUES (?, ?, ?, ?, ?)`,
    [procesoActivo.id, procesoActivo.dispositivo_id,
     data.pulsos || 0, data.rpm || 0, data.up || 0]
  );

  // Actualizar estadísticas del proceso
  await db.execute(
    `UPDATE procesos SET
       total_lecturas = total_lecturas + 1,
       rpm_promedio = (rpm_promedio * (total_lecturas - 1) + ?) / total_lecturas,
       rpm_max = GREATEST(rpm_max, ?),
       rpm_min = CASE WHEN rpm_min = 0 THEN ? ELSE LEAST(rpm_min, ?) END
     WHERE id = ?`,
    [data.rpm || 0, data.rpm || 0, data.rpm || 0, data.rpm || 0, procesoActivo.id]
  );

  // Broadcast en tiempo real via WebSocket
  if (wsBroadcast) {
    wsBroadcast(JSON.stringify({
      type: 'rpm_live',
      procesoId: procesoActivo.id,
      ...data,
      timestamp: new Date().toISOString()
    }));
  }
}

// ============================================================
//  Manejar estado del dispositivo
// ============================================================
async function handleStatus(data) {
  // Actualizar dispositivo
  await db.execute(
    `UPDATE dispositivos SET ip = ?, rssi = ?, ultimo_up = ?, ultimo_contacto = NOW()
     WHERE client_id LIKE 'RPM-%'
     ORDER BY id DESC LIMIT 1`,
    [data.ip || '', data.rssi || 0, data.up || 0]
  );

  if (wsBroadcast) {
    wsBroadcast(JSON.stringify({ type: 'device_status', ...data, timestamp: new Date().toISOString() }));
  }
}

// ============================================================
//  Reset cache del proceso activo
// ============================================================
function resetProcesoCache() {
  procesoActivo = null;
}

module.exports = { connectMQTT, resetProcesoCache };
