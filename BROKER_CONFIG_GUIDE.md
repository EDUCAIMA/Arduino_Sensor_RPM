# 🔧 Configuración del Broker MQTT — Guía de Usuario

## 📋 Descripción

La aplicación RPM IoT Monitor ahora permite gestionar credenciales del broker MQTT directamente desde la interfaz. Las credenciales se almacenan en la base de datos, permitiendo cambiar de broker sin necesidad de reiniciar la aplicación.

---

## 🚀 Instalación

### 1. Actualizar Base de Datos

Ejecuta el script de migración para crear la tabla de brokers:

```bash
mysql -u root -p rpm_iot < database/migration-mqtt-broker.sql
```

O ejecuta manualmente en MySQL:

```sql
USE rpm_iot;

CREATE TABLE IF NOT EXISTS mqtt_broker (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL DEFAULT 'Broker Principal',
  servidor      VARCHAR(255) NOT NULL,
  puerto        INT NOT NULL DEFAULT 8883,
  usuario       VARCHAR(100) NOT NULL,
  contraseña    VARCHAR(255) NOT NULL,
  protocolo     ENUM('mqtts', 'mqtt') NOT NULL DEFAULT 'mqtts',
  topic_rpm     VARCHAR(100) NOT NULL DEFAULT 'rpm/datos',
  topic_estado  VARCHAR(100) NOT NULL DEFAULT 'rpm/estado',
  activo        BOOLEAN DEFAULT TRUE,
  verificar_cert BOOLEAN DEFAULT TRUE,
  descripcion   TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_activo (activo)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insertar broker por defecto
INSERT INTO mqtt_broker (nombre, servidor, puerto, usuario, contraseña, protocolo)
VALUES (
  'Broker EMQX Cloud',
  'el.tubroker.com',
  8883,
  'tu_usuario',
  'tu_contraseña',
  'mqtts'
);
```

### 2. Reiniciar la Aplicación

```bash
npm run dev
# o
npm start
```

---

## 📱 Uso de la Interfaz

### Navegar a Configuración

1. Haz clic en **"Configuración"** en la barra lateral
2. Se mostrarán dos secciones:
   - **Estado de Conexión MQTT**: Muestra el estado actual de la conexión
   - **Configuración del Broker MQTT**: Lista de brokers configurados

### Visualizar Estado MQTT

En la tarjeta "Estado de Conexión MQTT" verás:

- **Estado**: Conectado o Desconectado
- **Broker**: Nombre del servidor
- **Puerto**: Puerto de conexión
- **Topics**: Tópicos MQTT suscritos

Usa el botón **"Actualizar Estado"** para refrescar la información.

### Agregar Nuevo Broker

1. Haz clic en **"Agregar Broker"**
2. Rellena el formulario:
   - **Nombre del Broker**: Nombre descriptivo (ej: "EMQX Cloud - Prod")
   - **Servidor**: Dirección del broker (ej: `broker.emqx.io`)
   - **Puerto**: Puerto MQTT (por defecto: 8883 para MQTTS)
   - **Protocolo**: MQTTS (TLS) o MQTT (TCP)
   - **Usuario**: Nombre de usuario para autenticación
   - **Contraseña**: Contraseña de autenticación
   - **Topic RPM**: Tópico para datos de RPM (por defecto: `rpm/datos`)
   - **Topic Estado**: Tópico para estado del dispositivo (por defecto: `rpm/estado`)
   - **Descripción**: Notas adicionales
   - **Verificar certificado**: Marcar para validar SSL/TLS

3. Haz clic en **"Guardar Broker"**

### Editar Broker

1. En la lista de brokers, haz clic en **"Editar"**
2. Modifica los campos necesarios
3. **Nota**: Si el campo de contraseña está vacío, se mantiene la actual
4. Haz clic en **"Guardar Broker"**
5. Si era el broker activo, se reconectará automáticamente

### Activar Broker

1. Encuentra el broker que deseas activar
2. Si está inactivo, verás un botón **"Activar Broker"**
3. Haz clic para activarlo
4. La aplicación se reconectará automáticamente con las nuevas credenciales

### Eliminar Broker

1. En la lista de brokers, haz clic en **"Eliminar"**
2. Confirma la eliminación
3. Si era el broker activo, la aplicación volverá a las credenciales del entorno

---

## 🔐 Seguridad

### Credenciales Almacenadas

- ✅ Las contraseñas se almacenan en la base de datos (considera usar encriptación eventual)
- ✅ Las contraseñas NO se muestran en la API responses
- ✅ Solo se requiere usuario y contraseña para acceder

### Buenas Prácticas

- Usa MQTTS (con TLS) en producción
- Usa usuarios/contraseñas fuertes
- Cambia regularmente las credenciales
- Restringe el acceso a la base de datos

---

## 🔄 Fallback a Variables de Entorno

Si no hay broker activo en la base de datos, la aplicación usará las variables de entorno:

```bash
MQTT_SERVER=broker.emqx.io
MQTT_PORT=8883
MQTT_USER=your_username
MQTT_PASS=your_password
MQTT_TOPIC_RPM=rpm/datos
MQTT_TOPIC_STATUS=rpm/estado
```

---

## 📊 Estructura de Datos

### Tabla `mqtt_broker`

```sql
{
  id: INT,                    -- ID único
  nombre: VARCHAR(100),       -- Nombre descriptivo
  servidor: VARCHAR(255),     -- Host del broker
  puerto: INT,                -- Puerto (1-65535)
  usuario: VARCHAR(100),      -- Usuario autenticación
  contraseña: VARCHAR(255),   -- Contraseña (encriptada recomendado)
  protocolo: ENUM,            -- 'mqtts' o 'mqtt'
  topic_rpm: VARCHAR(100),    -- Tópico RPM
  topic_estado: VARCHAR(100), -- Tópico estado
  activo: BOOLEAN,            -- Broker activo (solo 1 por vez)
  verificar_cert: BOOLEAN,    -- Validar certificado SSL/TLS
  descripcion: TEXT,          -- Notas
  created_at: DATETIME,       -- Fecha creación
  updated_at: DATETIME        -- Última actualización
}
```

---

## 🐛 Troubleshooting

### Error: "No hay broker activo configurado"

**Solución**: 
- Ve a Configuración y agrega un broker
- O marca uno como activo

### Error: "Error conectando a MQTT"

**Verificar**:
- ✓ Servidor y puerto correctos
- ✓ Usuario y contraseña válidos
- ✓ Firewall permite conexiones salientes al puerto MQTT
- ✓ Si usas MQTTS, cuenta de certificados válidos
- ✓ De-marca "Verificar certificado" si usas certificado autofirmado

### La conexión se cae después de cambiar broker

**Nota**: Es normal - el sistema está reconectando con las nuevas credenciales.

### Cambios no persisten después de reiniciar

**Solución**: Los cambios se guardaron pero el broker activo necesita estar en la BD.
- Verifica que el broker esté marcado como activo
- Comprueba la tabla: `SELECT * FROM mqtt_broker;`

---

## 🔄 Flujo de Integridad Referencial

```
dispositivos (sensor) ──────┐
                             │
                ┌────────────┤
                │            │
            referencia    referencia
                │            │
                v            v
procesos ────► lecturas_rpm
                │            
                │ (cascada delete)
                v
            alertas
```

**Garantías**:
- ✅ No se puede eliminar dispositivo si tiene procesos activos
- ✅ Al eliminar proceso, se eliminan todas sus lecturas
- ✅ Las alertas se eliminan al eliminar su proceso
- ✅ Broker independiente - no afecta datos existentes

---

## 🚨 API Endpoints

### GET `/api/config/broker`
Obtiene el broker activo actual.

**Response**:
```json
{
  "id": 1,
  "nombre": "Broker EMQX",
  "servidor": "broker.emqx.io",
  "puerto": 8883,
  "usuario": "user123",
  "protocolo": "mqtts",
  "topic_rpm": "rpm/datos",
  "topic_estado": "rpm/estado",
  "activo": true
}
```

### GET `/api/config/brokers`
Lista todos los brokers.

### POST `/api/config/broker`
Crea nuevo broker.

**Body**:
```json
{
  "nombre": "Nuevo Broker",
  "servidor": "broker.example.com",
  "puerto": 8883,
  "usuario": "user",
  "contraseña": "pass",
  "protocolo": "mqtts",
  "activo": false
}
```

### PUT `/api/config/broker/:id`
Actualiza broker existente.

### DELETE `/api/config/broker/:id`
Elimina broker.

### GET `/api/config/mqtt-status`
Estado actual de conexión MQTT.

---

## 📝 Notas

- Solo puede haber un broker **activo** a la vez
- Cambiar de broker provoca reconexión automática
- No se pierden datos al cambiar broker
- El histórico de datos se mantiene independientemente
- Todo completamente compatible con la BD existente

---

## 🎯 Próximas Mejoras (Roadmap)

- [ ] Encriptación de contraseñas en BD
- [ ] Prueba de conexión antes de guardar
- [ ] Historial de cambios de configuración
- [ ] Múltiples brokers activos simultáneamente
- [ ] Balanceo de carga entre brokers
- [ ] Logs detallados de conexión/desconexión

---

**Última actualización**: 2026-03-18  
**Versión**: 1.1.0
