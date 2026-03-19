-- ============================================================
--  Base de Datos: Medidor de RPM IoT
--  Con integridad referencial completa
-- ============================================================

CREATE DATABASE IF NOT EXISTS rpm_iot
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rpm_iot;

-- ============================================================
--  Tabla 1: dispositivos
--  Registra cada sensor/ESP32 que se conecta
-- ============================================================
CREATE TABLE IF NOT EXISTS dispositivos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     VARCHAR(50)  NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL DEFAULT 'Sensor RPM',
  ip            VARCHAR(45),
  rssi          INT,
  ultimo_up     BIGINT UNSIGNED DEFAULT 0,
  ultimo_contacto DATETIME DEFAULT CURRENT_TIMESTAMP,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_client_id (client_id),
  INDEX idx_activo    (activo)
) ENGINE=InnoDB;

-- ============================================================
--  Tabla 2: procesos
--  Cada proceso de medición con fecha inicio/fin
-- ============================================================
CREATE TABLE IF NOT EXISTS procesos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  dispositivo_id  INT NOT NULL,
  nombre          VARCHAR(200) NOT NULL,
  descripcion     TEXT,
  fecha_inicio    DATETIME NOT NULL,
  fecha_fin       DATETIME DEFAULT NULL,
  estado          ENUM('activo', 'pausado', 'finalizado', 'cancelado')
                    NOT NULL DEFAULT 'activo',
  rpm_promedio    FLOAT DEFAULT 0,
  rpm_max         FLOAT DEFAULT 0,
  rpm_min         FLOAT DEFAULT 0,
  total_lecturas  INT DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_proceso_dispositivo
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_dispositivo (dispositivo_id),
  INDEX idx_estado      (estado),
  INDEX idx_fechas      (fecha_inicio, fecha_fin)
) ENGINE=InnoDB;

-- ============================================================
--  Tabla 3: lecturas_rpm
--  Cada lectura individual de RPM
-- ============================================================
CREATE TABLE IF NOT EXISTS lecturas_rpm (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  proceso_id    INT NOT NULL,
  dispositivo_id INT NOT NULL,
  pulsos        INT NOT NULL DEFAULT 0,
  rpm           FLOAT NOT NULL DEFAULT 0,
  uptime_seg    BIGINT UNSIGNED DEFAULT 0,
  timestamp     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT fk_lectura_proceso
    FOREIGN KEY (proceso_id) REFERENCES procesos(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_lectura_dispositivo
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_proceso   (proceso_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_proc_time (proceso_id, timestamp)
) ENGINE=InnoDB;

-- ============================================================
--  Tabla 4: alertas
--  Registro de alertas cuando RPM excede umbrales
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  proceso_id    INT NOT NULL,
  dispositivo_id INT NOT NULL,
  tipo          ENUM('rpm_alta', 'rpm_baja', 'desconexion', 'reconexion', 'otro')
                  NOT NULL DEFAULT 'otro',
  mensaje       VARCHAR(500) NOT NULL,
  rpm_valor     FLOAT DEFAULT NULL,
  resuelta      BOOLEAN DEFAULT FALSE,
  timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_alerta_proceso
    FOREIGN KEY (proceso_id) REFERENCES procesos(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_alerta_dispositivo
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_proceso_alerta (proceso_id),
  INDEX idx_tipo           (tipo),
  INDEX idx_no_resuelta    (resuelta, timestamp)
) ENGINE=InnoDB;

-- ============================================================
--  Tabla 5: configuracion
--  Parámetros globales del sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clave         VARCHAR(100) NOT NULL UNIQUE,
  valor         TEXT NOT NULL,
  descripcion   VARCHAR(500),
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  Tabla 6: mqtt_broker
--  Configuración del broker MQTT (credenciales, servidor, etc)
-- ============================================================
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
) ENGINE=InnoDB;

-- Insertar configuración por defecto
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('rpm_alerta_alta',  '5000', 'Umbral RPM alto para generar alerta'),
  ('rpm_alerta_baja',  '100',  'Umbral RPM bajo para generar alerta'),
  ('intervalo_lectura', '1000', 'Intervalo de lectura en ms'),
  ('mqtt_topic_rpm',   'rpm/datos', 'Topic MQTT para datos de RPM'),
  ('mqtt_topic_status','rpm/estado', 'Topic MQTT para estado del dispositivo');
