// ============================================================
//  Rutas API REST — Lecturas RPM
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('./db');

// ──────────────────────────────────────
//  GET /api/lecturas/:procesoId — por proceso
// ──────────────────────────────────────
router.get('/:procesoId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const offset = parseInt(req.query.offset) || 0;

    const [rows] = await db.execute(`
      SELECT id, pulsos, rpm, uptime_seg, timestamp
      FROM lecturas_rpm
      WHERE proceso_id = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `, [req.params.procesoId, limit, offset]);

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM lecturas_rpm WHERE proceso_id = ?`,
      [req.params.procesoId]
    );

    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  GET /api/lecturas/:procesoId/stats — estadísticas
// ──────────────────────────────────────
router.get('/:procesoId/stats', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(rpm), 2) AS promedio,
        ROUND(MAX(rpm), 2) AS maximo,
        ROUND(MIN(rpm), 2) AS minimo,
        ROUND(STDDEV(rpm), 2) AS desviacion,
        MIN(timestamp) AS primera_lectura,
        MAX(timestamp) AS ultima_lectura
      FROM lecturas_rpm
      WHERE proceso_id = ?
    `, [req.params.procesoId]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  GET /api/lecturas/:procesoId/chart — datos agrupados para gráficas
// ──────────────────────────────────────
router.get('/:procesoId/chart', async (req, res) => {
  try {
    const interval = req.query.interval || 'minute'; // second, minute, hour
    let groupBy;

    switch (interval) {
      case 'second':
        groupBy = "DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s')";
        break;
      case 'hour':
        groupBy = "DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')";
        break;
      default:
        groupBy = "DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00')";
    }

    const [rows] = await db.execute(`
      SELECT
        ${groupBy} AS periodo,
        ROUND(AVG(rpm), 2) AS rpm_avg,
        ROUND(MAX(rpm), 2) AS rpm_max,
        ROUND(MIN(rpm), 2) AS rpm_min,
        COUNT(*) AS lecturas
      FROM lecturas_rpm
      WHERE proceso_id = ?
      GROUP BY periodo
      ORDER BY periodo ASC
      LIMIT 1000
    `, [req.params.procesoId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  GET /api/lecturas/:procesoId/latest — últimas N lecturas
// ──────────────────────────────────────
router.get('/:procesoId/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 60;

    const [rows] = await db.execute(`
      SELECT id, pulsos, rpm, uptime_seg, timestamp
      FROM lecturas_rpm
      WHERE proceso_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, [req.params.procesoId, limit]);

    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
