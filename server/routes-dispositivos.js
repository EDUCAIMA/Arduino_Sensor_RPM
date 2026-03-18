// ============================================================
//  Rutas API REST — Dispositivos
// ============================================================

const express = require('express');
const router  = express.Router();
const db      = require('./db');

// ──────────────────────────────────────
//  GET /api/dispositivos
// ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.*,
        (SELECT COUNT(*) FROM procesos WHERE dispositivo_id = d.id) AS total_procesos
      FROM dispositivos d
      ORDER BY d.ultimo_contacto DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────
//  PUT /api/dispositivos/:id
// ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { nombre } = req.body;
    await db.execute('UPDATE dispositivos SET nombre = ? WHERE id = ?', [nombre, req.params.id]);
    const [rows] = await db.execute('SELECT * FROM dispositivos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
