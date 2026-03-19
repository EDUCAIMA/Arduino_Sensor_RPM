# ✅ Actualización Completada - Configuración del Broker MQTT

## 📦 Resumen de Cambios

Se ha actualizado completamente el backend y frontend para permitir gestionar credenciales del broker MQTT desde la interfaz. Todos los cambios mantienen integridad referencial y flujo normal de información.

---

## 📋 Archivos Modificados/Creados

### Base de Datos
- ✅ **database/schema.sql** - Actualizado con tabla `mqtt_broker`
- ✅ **database/migration-mqtt-broker.sql** - Script de migración

### Backend
- ✅ **server/mqtt-client.js** - Actualizado para cargar credenciales desde BD
- ✅ **server/routes-configuracion.js** - NUEVO - Rutas API para gestionar brokers
- ✅ **server/index.js** - Registrado las nuevas rutas

### Frontend
- ✅ **public/index.html** - Agregada página de configuración + modal
- ✅ **public/app.js** - Agregadas funciones de gestión de brokers
- ✅ **public/styles.css** - Estilos para la nueva página

### Documentación
- ✅ **BROKER_CONFIG_GUIDE.md** - Guía completa de usuario
- ✅ **IMPLEMENTATION_SUMMARY.md** - Este documento

---

## 🚀 Pasos para Puesta en Marcha

### 1. Actualizar Base de Datos

```bash
# Opción A: Ejecutar script SQL
mysql -u root -p rpm_iot < database/migration-mqtt-broker.sql

# Opción B: Ejecutar query manualmente
mysql -u root -p
> USE rpm_iot;
> SOURCE database/migration-mqtt-broker.sql;
```

### 2. Reiniciar la Aplicación

```bash
# Detener la aplicación actual (Ctrl+C si está en ejecución)

# Iniciar con modo watch
npm run dev

# O iniciar modo producción
npm start
```

### 3. Acceder a Configuración

1. Abre el navegador → `http://localhost:3000`
2. Haz clic en **"Configuración"** en la barra lateral
3. Verás el estado MQTT actual y los brokers configurados

### 4. Agregar/Modificar Brokers

- Click en **"Agregar Broker"** para crear uno nuevo
- Rellena los datos del broker (servidor, puerto, usuario, contraseña)
- Los cambios se aplican inmediatamente sin reiniciar

---

## 🔄 Características Implementadas

### ✅ Almacenamiento de Credenciales

- Las credenciales del broker se guardan en la tabla `mqtt_broker`
- Las contraseñas NO se retornan en las respuestas de API
- Solo se requiere usuario y contraseña para acceder

### ✅ Gestión desde Interfaz

- Ver estado actual de conexión MQTT
- Listar todos los brokers configurados
- Crear nuevos brokers
- Editar brokers existentes
- Activar/cambiar entre brokers
- Eliminar brokers
- Todos los cambios sin reiniciar la app

### ✅ Integridad Referencial

```
Relaciones:
- dispositivos (1) ←→ (N) procesos
- procesos (1) ←→ (N) lecturas_rpm
- dispositivos (1) ←→ (N) lecturas_rpm
- procesos (1) ←→ (N) alertas

Constraints:
- FOREIGN KEY con ON DELETE RESTRICT para dispositivos
- FOREIGN KEY con ON DELETE CASCADE para procesos
- Indices en campos frequently queried
```

### ✅ Flujo de Información

```
ESP32 (Sensor)
    ↓ (MQTT)
Broker MQTT (Configurado en BD)
    ↓ (Suscripción)
mqtt-client.js (Node.js)
    ↓ (INSERT)
MySQL Database
    ├─ sensores/lecturas
    ├─ procesos
    └─ alertas
    ↓ (query)
API REST
    ↓ (HTTP)
Frontend (React-like / Vanilla JS)
    ↓ (WebSocket)
Dashboard en tiempo real
```

### ✅ Caída del Broker

Si la conexión MQTT falla:
1. Se intenta reconectar automáticamente cada 5 segundos
2. Los datos recientes NO se pierden
3. Se muestra estado "Desconectado" en la UI
4. Al reconectar, continúa recibiendo datos normalmente

---

## 📊 Datos Técnicos

### Nueva Tabla: `mqtt_broker`

```sql
CREATE TABLE mqtt_broker (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(100),
  servidor        VARCHAR(255),
  puerto          INT (1-65535),
  usuario         VARCHAR(100),
  contraseña      VARCHAR(255),  -- Encriptar recomendado
  protocolo       ENUM('mqtts', 'mqtt'),
  topic_rpm       VARCHAR(100),
  topic_estado    VARCHAR(100),
  activo          BOOLEAN,
  verificar_cert  BOOLEAN,
  descripcion     TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE
);
```

### API Endpoints Nuevos

```
GET    /api/config/broker              → Obtener broker activo
GET    /api/config/brokers             → Listar todos los brokers
POST   /api/config/broker              → Crear nuevo broker
PUT    /api/config/broker/:id          → Actualizar broker
DELETE /api/config/broker/:id          → Eliminar broker
GET    /api/config/mqtt-status         → Estado de conexión MQTT
```

---

## 🔐 Seguridad

### Credenciales
- ✅ Almacenadas en BD (no visibles en frontend)
- ⚠️ Considera agregar encriptación (bcrypt/AES)
- ✅ Contraseñas no se logean

### Acceso
- Vía HTTP REST (considera HTTPS en producción)
- Sin autenticación adicional (agrega si necesitas)
- WebSocket unencriptado (agregar WSS si necesitas)

### Recomendaciones
1. Usa MQTTS (TLS) en producción
2. Contraseñas fuertes (mínimo 16 caracteres)
3. Restringe acceso a base de datos
4. Backup regular de la BD
5. Monitorea logs de conexión

---

## 🧪 Testing Rápido

### 1. Verificar Base de Datos

```sql
USE rpm_iot;
SHOW TABLES;
DESC mqtt_broker;
SELECT * FROM mqtt_broker;
```

### 2. Verificar Rutas API

```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Probar API
curl http://localhost:3000/api/config/broker
curl http://localhost:3000/api/config/mqtt-status
curl http://localhost:3000/api/config/brokers

# Ver respuestas en JSON
```

### 3. Probar UI

1. Abre http://localhost:3000
2. Navega a "Configuración"
3. Verifica que carga el estado MQTT
4. Intenta agregar/editar un broker
5. Verifica que los cambios se aplican

---

## 🐛 Posibles Errores y Soluciones

### Error: "Table smtp_broker doesn't exist"

**Causa**: No se ejecutó el script de migración

**Solución**:
```bash
mysql -u root -p rpm_iot < database/migration-mqtt-broker.sql
```

### Error: "Cannot connect to MQTT"

**Verificación**:
- Servidor y puerto correctos
- Usuario y contraseña válidos
- Firewall permite conexiones salientes
- Certificado válido si usas MQTTS

### Error: "Contraseña no se actualiza"

**Nota**: Si dejas vacío el campo de contraseña en edición, se mantiene la actual. Completa para cambiarla.

### Error: "Cambios no se aplican"

- Verifica que no hay errores en navegador (F12 → Console)
- Comprueba que el broker está marcado como activo
- Verifica la tabla: `SELECT * FROM mqtt_broker;`

---

## 🎯 Checklist de Validación

- [ ] Base de datos actualizada con tabla `mqtt_broker`
- [ ] Aplicación inicia sin errores
- [ ] Frontend carga página Configuración
- [ ] Se muestra estado MQTT actual
- [ ] Se puede agregar nuevo broker
- [ ] Se puede editar broker existente
- [ ] Se puede activar/cambiar broker
- [ ] Se puede eliminar broker
- [ ] Cambios persisten al recargar página
- [ ] MQTT se reconecta al cambiar credenciales
- [ ] El histórico de datos no se afecta

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisa logs del servidor**:
   ```bash
   # Terminal donde está npm run dev
   # Verás mensajes de conexión/error
   ```

2. **Revisa console del navegador** (F12):
   - Errores JavaScript
   - Fallos de API

3. **Verifica base de datos**:
   ```sql
   SELECT * FROM mqtt_broker;
   SELECT * FROM dispositivos LIMIT 5;
   SELECT * FROM procesos LIMIT 5;
   ```

4. **Reinicia la aplicación**:
   ```bash
   Ctrl+C
   npm run dev
   ```

---

## 📚 Documentación Adicional

- [BROKER_CONFIG_GUIDE.md](./BROKER_CONFIG_GUIDE.md) - Guía completa de usuario
- [database/schema.sql](./database/schema.sql) - Esquema completo de BD
- [server/routes-configuracion.js](./server/routes-configuracion.js) - API endpoints

---

## 🎉 ¡Listo!

La aplicación está completamente actualizada. La integridad referencial se mantiene, el flujo de información es normal, y ahora puedes modificar las credenciales del broker sin reiniciar.

**Próximos pasos**:
1. Ejecuta la migración SQL
2. Reinicia la aplicación
3. ¡Disfruta de tu nuevo panel de configuración!

---

**Actualizado**: 2026-03-18  
**Versión**: 1.1.0
