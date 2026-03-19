const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  try {
    console.log("Creating new broker...");
    const postData = {
      nombre: 'Autotest Broker',
      servidor: 'test.mosquitto.org',
      puerto: 1883,
      usuario: 'testuser',
      contrasena: 'password',
      protocolo: 'mqtt',
      topic_rpm: 'rpm/autotest',
      topic_estado: 'estado/autotest',
      descripcion: 'Testing CRUD',
      verificar_cert: false,
      activo: false
    };

    const postOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/config/broker',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(postData))
      }
    };

    const data = await request(postOptions, postData);
    console.log("POST Result:", data);

    if (data.id) {
      console.log("Modifying broker...");
      const putData = { nombre: 'Autotest Modified' };
      const putOptions = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/config/broker/${data.id}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(putData))
        }
      };
      
      const data2 = await request(putOptions, putData);
      console.log("PUT Result:", data2);

      console.log("Deleting broker...");
      const delOptions = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/config/broker/${data.id}`,
        method: 'DELETE'
      };
      const data3 = await request(delOptions);
      console.log("DELETE Result:", data3);
    }
  } catch (err) {
    console.error("API test failed:", err);
  }
}

run();
