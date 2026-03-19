// ============================================================
//  Cliente MQTT → suscripción a EMQX Cloud (TLS)
//  Recibe datos del ESP32 y los almacena en MySQL
//  Credenciales cargadas desde BD
// ============================================================

const mqtt = require('mqtt');
const db   = require('./db');
require('dotenv').config();

let wsBroadcast = null;         // se inyecta desde index.js
let procesoActivo = null;       // cache del proceso activo
let mqttClient = null;          // cliente MQTT global
let brokerConfig = null;        // configuración activa del broker

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
//  Cargar configuración del broker desde BD
// ============================================================
async function loadBrokerConfig() {
  try {
    // Buscar broker activo
    const [rows] = await db.execute(
      `SELECT * FROM mqtt_broker WHERE activo = TRUE LIMIT 1`
    );

    if (rows.length === 0) {
      console.warn('⚠️  No hay broker activo en BD. Usando variables de entorno.');
      return {
        servidor: process.env.MQTT_SERVER || 'broker.emqx.io',
        puerto: parseInt(process.env.MQTT_PORT || '8883'),
        usuario: process.env.MQTT_USER || '',
        contraseña: process.env.MQTT_PASS || '',
        protocolo: 'mqtts',
        topic_rpm: process.env.MQTT_TOPIC_RPM || 'rpm/datos',
        topic_estado: process.env.MQTT_TOPIC_STATUS || 'rpm/estado',
        verificar_cert: true
      };
    }

    brokerConfig = rows[0];
    return brokerConfig;
  } catch (err) {
    console.error('❌ Error cargando config de broker:', err.message);
    // Fallback a env vars
    return {
      servidor: process.env.MQTT_SERVER || 'broker.emqx.io',
      puerto: parseInt(process.env.MQTT_PORT || '8883'),
      usuario: process.env.MQTT_USER || '',
      contraseña: process.env.MQTT_PASS || '',
      protocolo: 'mqtts',
      topic_rpm: process.env.MQTT_TOPIC_RPM || 'rpm/datos',
      topic_estado: process.env.MQTT_TOPIC_STATUS || 'rpm/estado',
      verificar_cert: true
    };
  }
}

// ============================================================
//  Conectar MQTT con credenciales de BD
// ============================================================
function connectMQTT(broadcastFn) {
  wsBroadcast = broadcastFn;
  
  // Cargar config y conectar
  loadBrokerConfig().then(config => {
    connectWithConfig(config);
  });
}

// ============================================================
//  Conectar con configuración específica
// ============================================================
function connectWithConfig(config) {
  const options = {
    port: config.puerto,
    protocol: config.protocolo || 'mqtts',
    username: config.usuario,
    password: config.contraseña,
    clientId: `dashboard-rpm-${Date.now()}`,
    rejectUnauthorized: config.verificar_cert !== false,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };

  const url = `${config.protocolo}://${config.servidor}`;
  console.log(`🔌 Conectando MQTT a ${url}:${options.port}...`);

  // Desconectar cliente anterior si existe
  if (mqttClient) {
    mqttClient.end();
  }

  mqttClient = mqtt.connect(url, options);

  mqttClient.on('connect', () => {
    console.log('✅ MQTT conectado exitosamente');
    mqttClient.subscribe(config.topic_rpm);
    mqttClient.subscribe(config.topic_estado);
    
    if (wsBroadcast) {
      wsBroadcast(JSON.stringify({
        type: 'mqtt_status',
        status: 'connected',
        broker: config.servidor,
        timestamp: new Date().toISOString()
      }));
    }
  });

  mqttClient.on('error', err => {
    console.error('❌ MQTT error:', err.message);
    if (wsBroadcast) {
      wsBroadcast(JSON.stringify({
        type: 'mqtt_status',
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString()
      }));
    }
  });

  mqttClient.on('disconnect', () => {
    console.log('⚠️  MQTT desconectado');
    if (wsBroadcast) {
      wsBroadcast(JSON.stringify({
        type: 'mqtt_status',
        status: 'disconnected',
        timestamp: new Date().toISOString()
      }));
    }
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());

      if (topic === config.topic_rpm) {
        await handleRPM(data);
      } else if (topic === config.topic_estado) {
        await handleStatus(data);
      }
    } catch (err) {
      console.error('Error procesando mensaje MQTT:', err.message);
    }
  });

  return mqttClient;
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

// ============================================================
//  Reconectar MQTT (cuando cambia configuración del broker)
// ============================================================
async function reconnectMQTT() {
  console.log('🔄 Reconectando MQTT con nueva configuración...');
  const config = await loadBrokerConfig();
  connectWithConfig(config);
}

// ============================================================
//  Obtener estado del cliente MQTT
// ============================================================
function getMQTTClient() {
  return mqttClient;
}

module.exports = { 
  connectMQTT, 
  resetProcesoCache,
  reconnectMQTT,
  loadBrokerConfig,
  getMQTTClient
};
