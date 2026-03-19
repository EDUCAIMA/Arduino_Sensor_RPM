const mysql = require('mysql2/promise');
require('dotenv').config();

async function testBrokerDB() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rpm_dashboard'
  });

  try {
    console.log("Checking if brokers exists...");
    const [rows] = await connection.execute('SHOW TABLES LIKE "mqtt_broker"');
    if (rows.length === 0) {
      console.log("Table mqtt_broker does not exist!");
    } else {
      console.log("Table exists.");
    }

    const [insertResult] = await connection.execute(
      `INSERT INTO mqtt_broker 
       (nombre, servidor, puerto, usuario, contrasena, protocolo, topic_rpm, topic_estado, activo, verificar_cert, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Test', 'test.mosquitto.org', 1883, 'user', 'pass', 'mqtt', 'rpm/datos', 'rpm/estado', false, false, 'Descripción']
    );

    console.log("Insert result:", insertResult);

    const [updateResult] = await connection.execute(
      `UPDATE mqtt_broker SET nombre=? WHERE id=?`,
      ['Test Updated', insertResult.insertId]
    );

    console.log("Update result:", updateResult);

    await connection.execute(`DELETE FROM mqtt_broker WHERE id=?`, [insertResult.insertId]);

    console.log("Deleted cleanly.");

  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await connection.end();
  }
}

testBrokerDB();
