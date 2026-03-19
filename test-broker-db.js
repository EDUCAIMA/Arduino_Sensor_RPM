const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rpm_dashboard'
  });
  
  await connection.execute(`INSERT INTO mqtt_broker 
       (nombre, servidor, puerto, usuario, contrasena, protocolo, topic_rpm, topic_estado, activo, verificar_cert, descripcion)
       VALUES ('A', 'A', 1, 'A', 'A', 'A', 'A', 'A', 0, 0, 'A')`);
       
  const [rows] = await connection.execute('SELECT * FROM mqtt_broker ORDER BY id DESC LIMIT 1');
  console.log("DB returned object keys:", Object.keys(rows[0]));
  console.log("DB returned object:", rows[0]);
  
  await connection.execute(`DELETE FROM mqtt_broker WHERE id=?`, [rows[0].id]);
  process.exit();
}
check();
