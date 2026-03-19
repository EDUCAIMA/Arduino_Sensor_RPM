// ============================================================
//  Medidor de RPM IoT
//  WiFiManager + MQTT EMQX Cloud (TLS/SSL)
// ============================================================

#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// ============================================================
//  SECCION 1: CONFIGURACION HARDWARE
// ============================================================

const int PIN_SENSOR         = 2;
const int PULSOS_POR_VUELTA  = 1;

// ============================================================
//  SECCION 2: CONFIGURACION MQTT
// ============================================================

const char* MQTT_SERVER  = "b1d5a8ad.ala.us-east-1.emqxsl.com";
const int   MQTT_PORT    = 8883;
const char* MQTT_USER    = "RPM";
const char* MQTT_PASS    = "987654321";
const char* TOPIC_RPM    = "rpm/datos";
const char* TOPIC_STATUS = "rpm/estado";

// ============================================================
//  SECCION 3: CERTIFICADO CA (DigiCert Global Root G2)
// ============================================================

const char* CA_CERT = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";

// ============================================================
//  SECCION 4: VARIABLES GLOBALES
// ============================================================

volatile int contadorPulsos = 0;

unsigned long t_lastRPM  = 0;
unsigned long t_lastPub  = 0;
unsigned long t_lastWiFi = 0;

const unsigned long T_RPM   = 1000;
const unsigned long T_PUB   = 30000;
const unsigned long T_WIFI  = 60000;

float rpmActual = 0.0;

WiFiClientSecure wifiClient;
PubSubClient     mqtt(wifiClient);

// ============================================================
//  SECCION 5: INTERRUPCION
// ============================================================

void IRAM_ATTR contarPulso() {
  contadorPulsos++;
}

// ============================================================
//  SECCION 6: SETUP Y LOOP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(PIN_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR), contarPulso, FALLING);

  iniciarWiFi();

  wifiClient.setCACert(CA_CERT);

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setBufferSize(256);

  connectMQTT();

  Serial.println("=== MEDIDOR DE RPM IoT INICIADO (TLS) ===");
  Serial.println(">>> Escribe 'RW' para borrar redes y lanzar hotspot <<<");
}

void loop() {
  // ── LECTURA DE COMANDOS SERIAL ──────────────────────────
  leerComandoSerial();

  // ── MQTT ────────────────────────────────────────────────
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  // ── CALCULO RPM ─────────────────────────────────────────
  if (millis() - t_lastRPM >= T_RPM) {
    t_lastRPM = millis();
    calcularYPublicarRPM();
  }

  // ── HEARTBEAT ───────────────────────────────────────────
  if (millis() - t_lastPub >= T_PUB) {
    t_lastPub = millis();
    pubEstado();
  }

  // ── RECONEXION WIFI ─────────────────────────────────────
  if (millis() - t_lastWiFi >= T_WIFI) {
    t_lastWiFi = millis();
    if (WiFi.status() != WL_CONNECTED) WiFi.reconnect();
  }
}

// ============================================================
//  SECCION 7: LECTURA DE COMANDOS SERIAL
// ============================================================

void leerComandoSerial() {
  static String bufferSerial = "";

  while (Serial.available()) {
    char c = (char)Serial.read();

    // Ignorar retorno de carro
    if (c == '\r') continue;

    if (c == '\n') {
      bufferSerial.trim();
      bufferSerial.toUpperCase();

      if (bufferSerial == "RW") {
        Serial.println("========================================");
        Serial.println("  COMANDO RW RECIBIDO");
        Serial.println("  Borrando redes WiFi guardadas...");
        Serial.println("========================================");

        WiFiManager wm;
        wm.resetSettings();   // <-- borra credenciales de la NVS

        Serial.println("  Redes borradas correctamente.");
        Serial.println("  Reiniciando en 2 segundos...");
        Serial.println("  Conéctate al AP: RPM_Sensor | PWD: 12345678");
        delay(2000);

        ESP.restart();        // el setup() volverá a lanzar el portal
      } else if (bufferSerial.length() > 0) {
        Serial.printf("Comando desconocido: '%s'\n", bufferSerial.c_str());
        Serial.println("Comandos disponibles: RW");
      }

      bufferSerial = "";
    } else {
      // Evitar desbordamiento del buffer
      if (bufferSerial.length() < 32) {
        bufferSerial += c;
      }
    }
  }
}

// ============================================================
//  SECCION 8: WIFI
// ============================================================

void iniciarWiFi() {
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  Serial.println("Iniciando WiFiManager...");
  Serial.println("AP: RPM_Sensor | PWD: 12345678");

  if (!wm.autoConnect("RPM_Sensor", "12345678")) {
    Serial.println("ERROR: No se pudo conectar al WiFi. Reiniciando...");
    delay(3000);
    ESP.restart();
  }

  Serial.printf("WiFi conectado: %s\n", WiFi.SSID().c_str());
  Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
}

// ============================================================
//  SECCION 9: MQTT
// ============================================================

void connectMQTT() {
  int intentos = 0;

  while (!mqtt.connected() && intentos < 3) {
    Serial.print("Conectando a EMQX Cloud (TLS)...");

    uint64_t chip = ESP.getEfuseMac();
    char clientId[24];
    snprintf(clientId, sizeof(clientId), "RPM-%04X", (uint16_t)(chip >> 32));

    if (mqtt.connect(clientId, MQTT_USER, MQTT_PASS)) {
      Serial.println(" Conectado!");
      pubEstado();
      return;
    }

    Serial.printf(" Fallo (rc=%d). Reintentando...\n", mqtt.state());
    intentos++;
    delay(1500);
  }

  if (!mqtt.connected()) {
    Serial.println("MQTT desconectado. Se reintentara en el proximo loop.");
  }
}

// ============================================================
//  SECCION 10: LOGICA RPM
// ============================================================

void calcularYPublicarRPM() {
  noInterrupts();
  int pulsosActuales = contadorPulsos;
  contadorPulsos = 0;
  interrupts();

  rpmActual = ((float)pulsosActuales / PULSOS_POR_VUELTA) * 60.0;

  Serial.printf("Pulsos/seg: %d | RPM: %.1f\n", pulsosActuales, rpmActual);

  if (!mqtt.connected()) return;

  char payload[128];
  snprintf(payload, sizeof(payload),
    "{\"pulsos\":%d,\"rpm\":%.1f,\"up\":%lu}",
    pulsosActuales, rpmActual, millis() / 1000);

  mqtt.publish(TOPIC_RPM, payload);
}

// ============================================================
//  SECCION 11: HEARTBEAT
// ============================================================

void pubEstado() {
  if (!mqtt.connected()) return;

  char payload[200];
  snprintf(payload, sizeof(payload),
    "{\"ip\":\"%s\",\"rssi\":%d,\"rpm\":%.1f,\"up\":%lu}",
    WiFi.localIP().toString().c_str(),
    WiFi.RSSI(), rpmActual, millis() / 1000);

  mqtt.publish(TOPIC_STATUS, payload);
  Serial.printf("Heartbeat: %s\n", payload);
}