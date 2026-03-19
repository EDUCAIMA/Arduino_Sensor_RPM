#!/usr/bin/env node
// Script para crear la base de datos

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔌 Conectando a MySQL...');
    
    // Conexión sin especificar BD para crearla
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      multipleStatements: true,
      timeout: 60000
    });

    console.log('✅ Conectado a MySQL');

    // Leer schema.sql
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📝 Ejecutando schema.sql...');
    await connection.query(schemaSql);
    console.log('✅ Schema ejecutado correctamente');

    // Leer migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migration-mqtt-broker.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Ejecutando migration-mqtt-broker.sql...');
    await connection.query(migrationSql);
    console.log('✅ Migración ejecutada correctamente');

    console.log('\n✨ Base de datos configurada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('   MySQL no está corriendo o no es accesible');
      console.error('   Verifica: mysql es accesible en localhost:3306');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
