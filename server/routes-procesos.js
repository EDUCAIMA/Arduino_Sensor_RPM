// ============================================================
//  Rutas API REST — Procesos
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('./db');
const { resetProcesoCache } = require('./mqtt-client');

// ──────────────────────────────────────
//  GET /api/procesos — listar todos
// ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, d.nombre AS dispositivo_nombre, d.client_id
      FROM procesos p
      LEFT JOIN dispositivos d ON p.dispositivo_id = d.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error listando procesos:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  GET /api/procesos/:id — detalle
// ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, d.nombre AS dispositivo_nombre, d.client_id
      FROM procesos p
      LEFT JOIN dispositivos d ON p.dispositivo_id = d.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Proceso no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  POST /api/procesos — crear nuevo
// ──────────────────────────────────────
router.post('/', async (req, res) => {
  console.log('📥 Petición recibida: POST /api/procesos', req.body);
  try {
    const { nombre, descripcion, dispositivo_id } = req.body;

    if (!nombre) {
      console.warn('⚠️ Intento de creación sin nombre');
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Verificar que no haya otro proceso activo
    const [activos] = await db.execute(
      `SELECT id FROM procesos WHERE estado = 'activo'`
    );
    if (activos.length > 0) {
      console.warn('⚠️ Ya hay un proceso activo:', activos[0].id);
      return res.status(409).json({
        error: 'Ya existe un proceso activo. Finalícelo primero.',
        procesoActivo: activos[0].id
      });
    }

    // Asegurar que exista al menos un dispositivo
    let devId = dispositivo_id;
    if (!devId) {
      const [devices] = await db.execute('SELECT id FROM dispositivos LIMIT 1');
      if (devices.length === 0) {
        console.log('🆕 No hay dispositivos, creando uno por defecto...');
        const [result] = await db.execute(
          `INSERT INTO dispositivos (client_id, nombre) VALUES ('RPM-DEFAULT', 'Sensor RPM Principal')`
        );
        devId = result.insertId;
        console.log('✅ Dispositivo creado id:', devId);
      } else {
        devId = devices[0].id;
      }
    }

    console.log('📝 Insertando proceso en db con dispositivo_id:', devId);
    const [result] = await db.execute(
      `INSERT INTO procesos (dispositivo_id, nombre, descripcion, fecha_inicio)
       VALUES (?, ?, ?, NOW())`,
      [devId, nombre, descripcion || '']
    );

    console.log('✅ Proceso insertado correctamente id:', result.insertId);
    resetProcesoCache();

    const [newProc] = await db.execute('SELECT * FROM procesos WHERE id = ?', [result.insertId]);
    res.status(201).json(newProc[0]);
  } catch (err) {
    console.error('❌ Error fatal creando proceso:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  PUT /api/procesos/:id/finalizar
// ──────────────────────────────────────
router.put('/:id/finalizar', async (req, res) => {
  try {
    await db.execute(
      `UPDATE procesos SET estado = 'finalizado', fecha_fin = NOW() WHERE id = ? AND estado = 'activo'`,
      [req.params.id]
    );
    resetProcesoCache();

    const [rows] = await db.execute('SELECT * FROM procesos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  PUT /api/procesos/:id/pausar
// ──────────────────────────────────────
router.put('/:id/pausar', async (req, res) => {
  try {
    await db.execute(
      `UPDATE procesos SET estado = 'pausado' WHERE id = ? AND estado = 'activo'`,
      [req.params.id]
    );
    resetProcesoCache();

    const [rows] = await db.execute('SELECT * FROM procesos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  PUT /api/procesos/:id/reanudar
// ──────────────────────────────────────
router.put('/:id/reanudar', async (req, res) => {
  try {
    // Check for other active
    const [activos] = await db.execute(
      `SELECT id FROM procesos WHERE estado = 'activo'`
    );
    if (activos.length > 0) {
      return res.status(409).json({ error: 'Ya hay un proceso activo' });
    }

    await db.execute(
      `UPDATE procesos SET estado = 'activo' WHERE id = ? AND estado = 'pausado'`,
      [req.params.id]
    );
    resetProcesoCache();

    const [rows] = await db.execute('SELECT * FROM procesos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  DELETE /api/procesos/:id
// ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM procesos WHERE id = ?', [req.params.id]);
    resetProcesoCache();
    res.json({ message: 'Proceso eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
