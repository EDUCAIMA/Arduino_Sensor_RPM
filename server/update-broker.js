#!/usr/bin/env node
// Script para actualizar datos del broker

const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateBroker() {
  let connection;
  
  try {
    console.log('🔌 Conectando a MySQL...');
    
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'rpm_iot'
    });

    console.log('✅ Conectado a MySQL');

    // Actualizar con los datos RFC del usuario
    const updateQuery = `
      UPDATE mqtt_broker SET
        servidor = 'b1d5a8ad.ala.us-east-1.emqxsl.com',
        puerto = 8883,
        usuario = 'RPM',
        contraseña = '987654321',
        topic_rpm = 'rpm/datos',
        topic_estado = 'rpm/estado',
        protocolo = 'mqtts',
        nombre = 'Broker EMQX Principal'
      WHERE id = 1;
    `;

    console.log('📝 Ejecutando actualización...');
    const [result] = await connection.execute(updateQuery);
    console.log('✅ Datos actualizados correctamente');
    console.log(`   Filas afectadas: ${result.affectedRows}`);

    // Verificar los datos
    console.log('\n📊 Verificando datos actualizados...');
    const [rows] = await connection.query(`
      SELECT 
        id,
        nombre,
        servidor,
        puerto,
        usuario,
        protocolo,
        topic_rpm,
        topic_estado,
        activo
      FROM mqtt_broker 
      WHERE id = 1
    `);

    if (rows.length > 0) {
      const broker = rows[0];
      console.log('\n✅ DATOS EN BASE DE DATOS:');
      console.log(`   ID:            ${broker.id}`);
      console.log(`   Nombre:        ${broker.nombre}`);
      console.log(`   Servidor:      ${broker.servidor}`);
      console.log(`   Puerto:        ${broker.puerto}`);
      console.log(`   Usuario:       ${broker.usuario}`);
      console.log(`   Protocolo:     ${broker.protocolo}`);
      console.log(`   Topic RPM:     ${broker.topic_rpm}`);
      console.log(`   Topic Estado:  ${broker.topic_estado}`);
      console.log(`   Activo:        ${broker.activo ? 'SÍ ✓' : 'NO'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateBroker();
