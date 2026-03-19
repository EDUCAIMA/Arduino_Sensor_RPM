const db = require('./server/db');

async function fixConfig() {
  try {
    console.log('🔧 Reparando configuración...\n');

    // 1. Verificar brokers existentes
    console.log('📋 Brokers en BD:');
    const [allBrokers] = await db.execute('SELECT id, nombre, activo, servidor FROM mqtt_broker');
    
    if (allBrokers.length === 0) {
      console.log('   ❌ NO hay brokers en BD. Insertando broker de EMQX...\n');
      
      const [result] = await db.execute(`
        INSERT INTO mqtt_broker (
          nombre, servidor, puerto, usuario, contraseña, protocolo,
          topic_rpm, topic_estado, verificar_cert, activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'EMQX Cloud (MQTT Seguro)',
        'b1d5a8ad.ala.us-east-1.emqxsl.com',
        8883,
        'RPM',
        '987654321',
        'mqtts',
        'rpm/datos',
        'rpm/estado',
        1,
        1
      ]);
      
      console.log(`   ✅ Broker creado e INSERTARSE PROCESS (ID: ${result.insertId})\n`);
    } else {
      console.log(`   ✓ Total: ${allBrokers.length} broker(s) en BD`);
      allBrokers.forEach(b => {
        console.log(`     ${b.activo ? '✅' : '❌'} ${b.nombre} (${b.servidor})`);
      });
      
      // Activar el primero si ninguno está activo
      const activeBrokers = allBrokers.filter(b => b.activo);
      if (activeBrokers.length === 0) {
        console.log('\n   ⚠️  Activando primer broker...');
        await db.execute('UPDATE mqtt_broker SET activo = 1 WHERE id = ?', [allBrokers[0].id]);
        console.log(`   ✅ Broker "${allBrokers[0].nombre}" ACTIVADO\n`);
      }
    }

    // 2. Crear proceso activo
    console.log('📋 Creando proceso activo...\n');
    const [result] = await db.execute(`
      INSERT INTO procesos (
        nombre, descripcion, estado, dispositivo_id
      ) VALUES (?, ?, ?, ?)
    `, [
      'Monitoreo Automático MQTT',
      'Proceso automático para capturar datos del broker MQTT',
      'activo',
      1
    ]);
    
    console.log(`   ✅ Proceso creado (ID: ${result.insertId})\n`);

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║              ✨ CONFIGURACIÓN REPARADA                 ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n✅ Ahora:');
    console.log('   1. Recarga la página en el navegador');
    console.log('   2. Ve a "Configuración" para ver el broker activo');
    console.log('   3. Los datos MQTT empezarán a llegar si hay sensores');
    console.log('   4. Ve a "Procesos" para ver el proceso activo\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixConfig();
