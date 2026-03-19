const db = require('./server/db');
require('dotenv').config();

async function checkFlow() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       VERIFICACIÓN DE FLUJO MQTT Y SUSCRIPCIÓN                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar broker configurado
    console.log('📡 1. BROKER MQTT CONFIGURADO:');
    const [brokers] = await db.execute('SELECT * FROM mqtt_broker WHERE activo = TRUE');
    if (brokers.length === 0) {
      console.log('   ❌ NO hay broker ACTIVO en la BD');
    } else {
      const b = brokers[0];
      console.log(`   ✓ Servidor: ${b.servidor}:${b.puerto}`);
      console.log(`   ✓ Usuario: ${b.usuario}`);
      console.log(`   ✓ Topics: ${b.topic_rpm} | ${b.topic_estado}`);
      console.log(`   ✓ Protocolo: ${b.protocolo}`);
    }

    // 2. Verificar proceso activo
    console.log('\n📋 2. PROCESO ACTIVO:');
    const [procesos] = await db.execute(
      `SELECT id, nombre, estado, total_lecturas FROM procesos 
       WHERE estado = 'activo' ORDER BY id DESC LIMIT 1`
    );
    if (procesos.length === 0) {
      console.log('   ❌ NO hay proceso ACTIVO');
      console.log('   ⚠️  Sin proceso activo, los datos MQTT no se guardarán en BD');
    } else {
      const p = procesos[0];
      console.log(`   ✓ Proceso: ${p.nombre} (ID: ${p.id})`);
      console.log(`   ✓ Estado: ${p.estado}`);
      console.log(`   ✓ Lecturas capturadas: ${p.total_lecturas}`);
    }

    // 3. Verificar dispositivos
    console.log('\n🔌 3. DISPOSITIVOS REGISTRADOS:');
    const [devices] = await db.execute('SELECT id, nombre, client_id, ultimo_contacto FROM dispositivos');
    if (devices.length === 0) {
      console.log('   ❌ NO hay dispositivos registrados');
    } else {
      console.log(`   ✓ Total: ${devices.length} dispositivo(s)`);
      devices.forEach(d => {
        console.log(`     - ${d.nombre} (${d.client_id}) - Último contacto: ${d.ultimo_contacto || 'Nunca'}`);
      });
    }

    // 4. Últimas lecturas
    console.log('\n📊 4. ÚLTIMAS LECTURAS:');
    const [lecturas] = await db.execute(
      `SELECT l.rpm, l.pulsos, l.timestamp 
       FROM lecturas_rpm l 
       ORDER BY l.timestamp DESC LIMIT 5`
    );
    if (lecturas.length === 0) {
      console.log('   ❌ NO hay lecturas en la BD');
    } else {
      console.log(`   ✓ Total: ${lecturas.length} lectura(s)`);
      lecturas.forEach(l => {
        console.log(`     - RPM: ${l.rpm} | Pulsos: ${l.pulsos} | ${new Date(l.timestamp).toLocaleTimeString()}`);
      });
    }

    // 5. Variables de entorno
    console.log('\n🔑 5. VARIABLES DE ENTORNO (Fallback):');
    console.log(`   MQTT_SERVER: ${process.env.MQTT_SERVER || '(no definido)'}`);
    console.log(`   MQTT_PORT: ${process.env.MQTT_PORT || '(no definido)'}`);
    console.log(`   MQTT_USER: ${process.env.MQTT_USER || '(no definido)'}`);
    console.log(`   MQTT_PASS: ${process.env.MQTT_PASS ? '***' : '(no definido)'}`);

    // 6. Recomendaciones
    console.log('\n✨ CHECKLIST DE REQUISITOS:');
    console.log(`   ${brokers.length > 0 ? '✅' : '❌'} Broker MQTT activo en BD`);
    console.log(`   ${procesos.length > 0 ? '✅' : '❌'} Proceso activo en BD`);
    console.log(`   ${devices.length > 0 ? '✅' : '❌'} Dispositivo(s) registrado(s)`);
    console.log(`   ${lecturas.length > 0 ? '✅' : '❌'} Datos siendo recibidos`);

    if (procesos.length === 0) {
      console.log('\n⚠️  SOLUCIÓN: Crea un proceso activo en la aplicación:');
      console.log('   1. Ve a "Procesos" en la UI');
      console.log('   2. Click en "Nuevo Proceso"');
      console.log('   3. Completa el formulario y guarda');
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkFlow();
