# ============================================================
# VERIFICATION SCRIPT - RPM IoT Broker Configuration Update
# PowerShell Version for Windows
# ============================================================

Write-Host "🔍 Verificando instalación de cambios..." -ForegroundColor Cyan
Write-Host ""

$CHECKS_PASSED = 0
$CHECKS_FAILED = 0
$baseDir = "c:\Users\ASUS\Documents\REPOS\Arduino_Sensor_RPM"

# Function to check file exists
function Test-FileExists {
    param(
        [string]$filePath
    )
    if (Test-Path "$baseDir\$filePath") {
        Write-Host "✓ Archivo existe: $filePath" -ForegroundColor Green
        $script:CHECKS_PASSED++
    }
    else {
        Write-Host "✗ FALTA archivo: $filePath" -ForegroundColor Red
        $script:CHECKS_FAILED++
    }
}

# Function to check content in file
function Test-FileContent {
    param(
        [string]$filePath,
        [string]$searchText
    )
    $fullPath = "$baseDir\$filePath"
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        if ($content -match [regex]::Escape($searchText)) {
            Write-Host "✓ Contenido encontrado en: $filePath" -ForegroundColor Green
            $script:CHECKS_PASSED++
        }
        else {
            Write-Host "✗ Contenido NO encontrado en: $filePath" -ForegroundColor Red
            $script:CHECKS_FAILED++
        }
    }
}

Write-Host "📁 Verificando archivos..." -ForegroundColor Yellow
Test-FileExists "server\routes-configuracion.js"
Test-FileExists "database\migration-mqtt-broker.sql"
Test-FileExists "BROKER_CONFIG_GUIDE.md"
Test-FileExists "IMPLEMENTATION_SUMMARY.md"

Write-Host ""
Write-Host "🔍 Verificando contenido de archivos..." -ForegroundColor Yellow

# Check server files
Test-FileContent "server\mqtt-client.js" "loadBrokerConfig"
Test-FileContent "server\mqtt-client.js" "connectWithConfig"
Test-FileContent "server\mqtt-client.js" "reconnectMQTT"
Test-FileContent "server\index.js" "routes-configuracion"

# Check frontend files
Test-FileContent "public\app.js" "loadConfiguracion"
Test-FileContent "public\app.js" "loadBrokers"
Test-FileContent "public\app.js" "saveBroker"
Test-FileContent "public\index.html" "page-configuracion"
Test-FileContent "public\index.html" "modalBrokerForm"

# Check database files
Test-FileContent "database\schema.sql" "mqtt_broker"
Test-FileContent "database\migration-mqtt-broker.sql" "CREATE TABLE"

Write-Host ""
Write-Host "📊 Resumen de Verificación" -ForegroundColor Cyan
Write-Host "=========================="
Write-Host "✓ Validaciones exitosas: $CHECKS_PASSED" -ForegroundColor Green
Write-Host "✗ Validaciones fallidas: $CHECKS_FAILED" -ForegroundColor Red

Write-Host ""
if ($CHECKS_FAILED -eq 0) {
    Write-Host "✅ ¡Instalación OK! Todos los archivos están en lugar." -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos pasos:" -ForegroundColor Yellow
    Write-Host "1. Ejecutar migración de BD:" -ForegroundColor White
    Write-Host "   mysql -u root -p rpm_iot < database\migration-mqtt-broker.sql" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Reiniciar la aplicación:" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Acceder a: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "4. Ir a 'Configuración' en la barra lateral" -ForegroundColor Cyan
    exit 0
}
else {
    Write-Host "❌ Faltan archivos o contenido. Revisa la instalación." -ForegroundColor Red
    exit 1
}
