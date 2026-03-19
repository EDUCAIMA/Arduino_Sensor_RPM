// ============================================================
//  Rutas API REST — Configuración de MQTT Broker
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('./db');
const { reconnectMQTT, loadBrokerConfig } = require('./mqtt-client');

// ──────────────────────────────────────
//  GET /api/config/broker — obtener broker activo
// ──────────────────────────────────────
router.get('/broker', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, nombre, servidor, puerto, usuario, protocolo, 
              topic_rpm, topic_estado, activo, verificar_cert, descripcion
       FROM mqtt_broker
       WHERE activo = TRUE
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'No hay broker activo configurado',
        fallback: {
          servidor: process.env.MQTT_SERVER || 'broker.emqx.io',
          puerto: parseInt(process.env.MQTT_PORT || '8883'),
          protocolo: 'mqtts'
        }
      });
    }

    // No retornar la contraseña
    const broker = rows[0];
    delete broker.contraseña;
    res.json(broker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  GET /api/config/brokers — listar todos
// ──────────────────────────────────────
router.get('/brokers', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, nombre, servidor, puerto, usuario, protocolo, 
              topic_rpm, topic_estado, activo, verificar_cert, descripcion, 
              created_at, updated_at
       FROM mqtt_broker
       ORDER BY activo DESC, created_at DESC`
    );

    // No retornar contraseñas
    const brokers = rows.map(b => {
      delete b.contraseña;
      return b;
    });

    res.json(brokers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  POST /api/config/broker — crear nuevo broker
// ──────────────────────────────────────
router.post('/broker', async (req, res) => {
  try {
    const {
      nombre,
      servidor,
      puerto,
      usuario,
      contraseña,
      protocolo = 'mqtts',
      topic_rpm = 'rpm/datos',
      topic_estado = 'rpm/estado',
      activo = false,
      verificar_cert = true,
      descripcion
    } = req.body;

    if (!servidor || !usuario || !contraseña) {
      return res.status(400).json({ 
        error: 'Servidor, usuario y contraseña son obligatorios' 
      });
    }

    // Si se intenta activar este broker, desactivar otros
    if (activo) {
      await db.execute('UPDATE mqtt_broker SET activo = FALSE');
    }

    const [result] = await db.execute(
      `INSERT INTO mqtt_broker 
       (nombre, servidor, puerto, usuario, contraseña, protocolo, 
        topic_rpm, topic_estado, activo, verificar_cert, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre || 'Broker ' + new Date().toISOString().slice(0, 10),
        servidor,
        puerto || 8883,
        usuario,
        contraseña,
        protocolo,
        topic_rpm,
        topic_estado,
        activo,
        verificar_cert,
        descripcion || ''
      ]
    );

    // Si se activó, reconectar MQTT
    if (activo) {
      await reconnectMQTT();
    }

    const [newBroker] = await db.execute(
      'SELECT * FROM mqtt_broker WHERE id = ?',
      [result.insertId]
    );

    const broker = newBroker[0];
    delete broker.contraseña;
    res.status(201).json(broker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  PUT /api/config/broker/:id — actualizar broker
// ──────────────────────────────────────
router.put('/broker/:id', async (req, res) => {
  try {
    const {
      nombre,
      servidor,
      puerto,
      usuario,
      contraseña,
      protocolo,
      topic_rpm,
      topic_estado,
      activo,
      verificar_cert,
      descripcion
    } = req.body;

    // Obtener broker actual
    const [current] = await db.execute(
      'SELECT * FROM mqtt_broker WHERE id = ?',
      [req.params.id]
    );

    if (current.length === 0) {
      return res.status(404).json({ error: 'Broker no encontrado' });
    }

    const updateData = {
      nombre: nombre !== undefined ? nombre : current[0].nombre,
      servidor: servidor || current[0].servidor,
      puerto: puerto !== undefined ? puerto : current[0].puerto,
      usuario: usuario || current[0].usuario,
      contraseña: contraseña || current[0].contraseña,
      protocolo: protocolo || current[0].protocolo,
      topic_rpm: topic_rpm || current[0].topic_rpm,
      topic_estado: topic_estado || current[0].topic_estado,
      verificar_cert: verificar_cert !== undefined ? verificar_cert : current[0].verificar_cert,
      descripcion: descripcion !== undefined ? descripcion : current[0].descripcion
    };

    let wasActive = current[0].activo;
    if (activo !== undefined && activo !== current[0].activo) {
      if (activo === true) {
        // Desactivar otros brokers
        await db.execute('UPDATE mqtt_broker SET activo = FALSE');
        updateData.activo = true;
      } else {
        updateData.activo = false;
      }
    }

    await db.execute(
      `UPDATE mqtt_broker SET
       nombre = ?, servidor = ?, puerto = ?, usuario = ?, 
       contraseña = ?, protocolo = ?, topic_rpm = ?, topic_estado = ?,
       verificar_cert = ?, descripcion = ?, activo = ?
       WHERE id = ?`,
      [
        updateData.nombre,
        updateData.servidor,
        updateData.puerto,
        updateData.usuario,
        updateData.contraseña,
        updateData.protocolo,
        updateData.topic_rpm,
        updateData.topic_estado,
        updateData.verificar_cert,
        updateData.descripcion,
        updateData.activo,
        req.params.id
      ]
    );

    // Reconectar si cambió configuración activa
    if (updateData.activo || wasActive) {
      await reconnectMQTT();
    }

    const [updated] = await db.execute(
      'SELECT * FROM mqtt_broker WHERE id = ?',
      [req.params.id]
    );

    const broker = updated[0];
    delete broker.contraseña;
    res.json(broker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  DELETE /api/config/broker/:id — eliminar broker
// ──────────────────────────────────────
router.delete('/broker/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT activo FROM mqtt_broker WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Broker no encontrado' });
    }

    const wasActive = rows[0].activo;

    await db.execute('DELETE FROM mqtt_broker WHERE id = ?', [req.params.id]);

    // Si era el activo, reconectar (usará env vars como fallback)
    if (wasActive) {
      await reconnectMQTT();
    }

    res.json({ success: true, message: 'Broker eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  GET /api/config/mqtt-status — estado conexión MQTT
// ──────────────────────────────────────
router.get('/mqtt-status', async (req, res) => {
  try {
    const { getMQTTClient, loadBrokerConfig } = require('./mqtt-client');
    const client = getMQTTClient();
    const config = await loadBrokerConfig();

    res.json({
      connected: client && client.connected,
      broker: config.servidor,
      puerto: config.puerto,
      topics: {
        rpm: config.topic_rpm,
        estado: config.topic_estado
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
