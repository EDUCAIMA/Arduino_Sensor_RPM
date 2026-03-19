const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'rpm_iot'
  });
  
  // Check if it already exists
  const [existing] = await connection.execute('SELECT * FROM mqtt_broker LIMIT 1');
  if (existing.length === 0) {
    console.log("Inserting default EMQX broker into DB...");
    await connection.execute(`
      INSERT INTO mqtt_broker 
      (nombre, servidor, puerto, usuario, contrasena, protocolo, topic_rpm, topic_estado, activo, verificar_cert, descripcion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'EMQX Cloud Principal',
      process.env.MQTT_SERVER || 'b1d5a8ad.ala.us-east-1.emqxsl.com',
      process.env.MQTT_PORT || 8883,
      process.env.MQTT_USER || 'RPM',
      process.env.MQTT_PASS || '987654321',
      'mqtts',
      process.env.MQTT_TOPIC_RPM || 'rpm/datos',
      process.env.MQTT_TOPIC_STATUS || 'rpm/estado',
      true,  // activo
      true,  // verificar_cert
      'Broker principal configurado desde variables de entorno.'
    ]);
    console.log("Successfully seeded.");
  } else {
    console.log("A broker already exists. Not seeding.");
  }
  
  process.exit();
}
seed();
