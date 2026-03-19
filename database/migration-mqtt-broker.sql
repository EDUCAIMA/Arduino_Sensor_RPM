-- ============================================================
--  Migration: Add MQTT Broker Configuration Table
--  Date: 2026-03-18
--  Description: Adds support for storing MQTT broker credentials
--               in the database for dynamic configuration
-- ============================================================

USE rpm_iot;

-- Create mqtt_broker table if it doesn't exist
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
) ENGINE=InnoDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ============================================================
--  Insert default broker from environment variables
--  Note: Update with your actual credentials!
-- ============================================================
INSERT INTO mqtt_broker (nombre, servidor, puerto, usuario, contraseña, protocolo, topic_rpm, topic_estado, activo)
VALUES (
  'Broker EMQX Cloud',
  'broker.emqx.io',
  8883,
  'rpm_user',
  'rpm_password_123',
  'mqtts',
  'rpm/datos',
  'rpm/estado',
  TRUE
)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================
--  Verify the table structure
-- ============================================================
DESC mqtt_broker;

-- ============================================================
--  Verify data
-- ============================================================
SELECT * FROM mqtt_broker;
