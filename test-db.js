const db = require('./server/db');
async function test() {
  try {
    console.log('--- Probando inserción de dispositivo ---');
    const [resDev] = await db.execute("INSERT INTO dispositivos (client_id, nombre) VALUES ('TEST-DEVICE-01', 'Dispositivo de Prueba')");
    const devId = resDev.insertId;
    console.log('✅ Dispositivo insertado id:', devId);

    console.log('--- Probando inserción de proceso ---');
    const [resProc] = await db.execute(
      "INSERT INTO procesos (dispositivo_id, nombre, descripcion, fecha_inicio) VALUES (?, ?, ?, NOW())",
      [devId, 'Proceso de Prueba Automatizado', 'Descripción de prueba']
    );
    console.log('✅ Proceso insertado id:', resProc.insertId);

    // Limpieza
    await db.execute("DELETE FROM procesos WHERE id = ?", [resProc.insertId]);
    await db.execute("DELETE FROM dispositivos WHERE id = ?", [devId]);
    console.log('🧹 Limpieza completada');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en el test:', err);
    process.exit(1);
  }
}
test();
