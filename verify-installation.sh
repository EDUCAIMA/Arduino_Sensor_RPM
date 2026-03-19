#!/bin/bash
# ============================================================
# VERIFICATION SCRIPT - RPM IoT Broker Configuration Update
# ============================================================

echo "🔍 Verificando instalación de cambios..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Archivo existe: $1"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} FALTA archivo: $1"
        ((CHECKS_FAILED++))
    fi
}

# Function to check text in file
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Contenido encontrado en: $1"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} Contenido NO encontrado en: $1"
        ((CHECKS_FAILED++))
    fi
}

echo "📁 Verificando archivos..."
check_file "server/routes-configuracion.js"
check_file "database/migration-mqtt-broker.sql"
check_file "BROKER_CONFIG_GUIDE.md"
check_file "IMPLEMENTATION_SUMMARY.md"

echo ""
echo "🔍 Verificando contenido de archivos..."

# Check server files
check_content "server/mqtt-client.js" "loadBrokerConfig"
check_content "server/mqtt-client.js" "connectWithConfig"
check_content "server/mqtt-client.js" "reconnectMQTT"
check_content "server/index.js" "routes-configuracion"

# Check frontend files
check_content "public/app.js" "loadConfiguracion"
check_content "public/app.js" "loadBrokers"
check_content "public/app.js" "saveBroker"
check_content "public/index.html" "page-configuracion"
check_content "public/index.html" "modalBrokerForm"

# Check database files
check_content "database/schema.sql" "mqtt_broker"
check_content "database/migration-mqtt-broker.sql" "CREATE TABLE"

echo ""
echo "📊 Resumen de Verificación"
echo "=========================="
echo -e "${GREEN}✓ Validaciones exitosas:${NC} $CHECKS_PASSED"
echo -e "${RED}✗ Validaciones fallidas:${NC} $CHECKS_FAILED"

echo ""
if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ¡Instalación OK! Todos los archivos están en lugar.${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. Ejecutar migración de BD:"
    echo "   mysql -u root -p rpm_iot < database/migration-mqtt-broker.sql"
    echo ""
    echo "2. Reiniciar la aplicación:"
    echo "   npm run dev"
    echo ""
    echo "3. Acceder a: http://localhost:3000"
    echo "4. Ir a 'Configuración' en la barra lateral"
    exit 0
else
    echo -e "${RED}❌ Faltan archivos o contenido. Revisa la instalación.${NC}"
    exit 1
fi
