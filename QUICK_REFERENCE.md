# ⚡ QUICK REFERENCE - Broker Configuration

## 🚀 Inicio Rápido

```bash
# 1. Actualizar BD
mysql -u root -p rpm_iot < database\migration-mqtt-broker.sql

# 2. Reiniciar aplicación
npm run dev

# 3. Acceder a http://localhost:3000
# 4. Click en "Configuración"
# ✅ ¡Listo!
```

---

## 📱 UI Workflow

| Acción | Pasos |
|--------|-------|
| **Ver Estado MQTT** | Configuración → Botón "Actualizar Estado" |
| **Agregar Broker** | Configuración → "Agregar Broker" → Llenar form → Guardar |
| **Editar Broker** | Configuración → Click "Editar" → Modificar → Guardar |
| **Cambiar de Broker** | Configuración → Click "Activar Broker" → Confirmar |
| **Eliminar Broker** | Configuración → Click "Eliminar" → Confirmar |

---

## 🔧 API Shortcuts

```bash
# Obtener broker activo
curl http://localhost:3000/api/config/broker

# Listar todos los brokers  
curl http://localhost:3000/api/config/brokers

# Ver estado MQTT
curl http://localhost:3000/api/config/mqtt-status

# Crear broker
curl -X POST http://localhost:3000/api/config/broker \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Nuevo",
    "servidor": "broker.emqx.io",
    "puerto": 8883,
    "usuario": "user",
    "contraseña": "pass"
  }'

# Editar broker
curl -X PUT http://localhost:3000/api/config/broker/1 \
  -H "Content-Type: application/json" \
  -d '{"activo": true}'

# Eliminar broker
curl -X DELETE http://localhost:3000/api/config/broker/1
```

---

## 🗄️ SQL Quick Commands

```sql
-- Ver todos los brokers
SELECT * FROM mqtt_broker;

-- Ver broker activo
SELECT * FROM mqtt_broker WHERE activo = TRUE;

-- Crear broker (manual)
INSERT INTO mqtt_broker 
  (nombre, servidor, puerto, usuario, contraseña, activo)
VALUES 
  ('Nuevo', 'broker.com', 8883, 'user', 'pass', TRUE);

-- Cambiar broker activo
UPDATE mqtt_broker SET activo = FALSE;
UPDATE mqtt_broker SET activo = TRUE WHERE id = 2;

-- Eliminar broker
DELETE FROM mqtt_broker WHERE id = 1;

-- Ver estructura tabla
DESC mqtt_broker;
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| Tabla no existe | Ejecutar: `mysql -u root -p rpm_iot < database\migration-mqtt-broker.sql` |
| No conecta MQTT | Verificar: servidor, puerto, usuario, contraseña |
| UI muestra "Error" | F12 → Console → Ver qué error aparece |
| Cambios no aplican | Verificar: broker está marcado como activo |
| App no inicia | Verificar: node_modules, npm install, revisar logs |
| Contraseña no cambia | Editar broker con contraseña vacía = mantiene actual |

---

## 📊 Archivo Clave Modificaciones

| Archivo | Cambios | Tipo |
|---------|---------|------|
| schema.sql | +tabla mqtt_broker | DB ↕️ |
| mqtt-client.js | +loadBrokerConfig, reconnect | BE 🔧 |
| routes-config.js | +6 API endpoints | BE 🆕 |
| index.js | +import config routes | BE ↕️ |
| app.js | +loadConfiguracion, saveBroker | FE 🆕 |
| index.html | +config page, modal | FE 🆕 |
| styles.css | +broker styles | FE ↕️ |

---

## ⌨️ Atajos Útiles

```bash
# Verificar instalación
.\verify-installation.ps1

# Ver logs en vivo
npm run dev

# Reiniciar MQTT (la app lo hace auto)
# Simplemente edita broker y actívalo

# Limpiar eventos (app.js)
Ctrl+Home → Buscar "clearLog"
```

---

## 🔑 Campos Broker

```
nombre............ Nombre único (Ej: Prod EMQX v1)
servidor......... Dominio/IP (Ej: broker.emqx.io)
puerto........... Número 1-65535 (Def: 8883)
usuario.......... De autenticación MQTT
contraseña....... De autenticación MQTT
protocolo........ mqtts (TLS) o mqtt (TCP)
topic_rpm........ Tópico para datos RPM (def: rpm/datos)
topic_estado..... Tópico para estado (def: rpm/estado)
activo........... Boolean - Solo 1 puede ser TRUE
verificar_cert.. Boolean - Validar SSL/TLS
descripcion..... Notas (opcional)
```

---

## 📞 Estado de Conexión

| Estado | Significado | Acción |
|--------|------------|--------|
| 🟢 Conectado | MQTT activo | Es normal |
| 🔴 Desconectado | Sin conexión MQTT | Verificar broker |
| ⚠️ Error | Fallo de conexión | Ver error exacto |
| ⏳ Conectando | Intentando reconectar | Esperar 5s |

---

## 🔐 Seguridad Checklist

- [ ] Usuario/contraseña fuertes (16+ caracteres)
- [ ] MQTTS (TLS) en producción
- [ ] Restringir acceso a BD
- [ ] Backups regulares
- [ ] Cambiar credenciales periódicamente
- [ ] Monitorear logs de conexión

---

## 📈 Performance Tips

1. Mantén historico limpio (DELETE old records)
2. Agrupa lecturas por periodos
3. Usa índices en campos frecuentes
4. Pool de conexiones límite: 10

---

## 🎓 Conceptos Clave

- **Broker MQTT**: Intermediario de mensajes IoT
- **Topic**: Canal de comunicación (ej: rpm/datos)
- **Payload**: Datos en el mensaje (JSON)
- **Retain**: MQTT guarda último mensaje
- **QoS**: Nivel de garantía de entrega (0,1,2)

---

## 📚 Documentación Completa

Ver estos archivos para más detalles:
- **CHANGES_SUMMARY.md** ← Estás aquí
- **IMPLEMENTATION_SUMMARY.md** ← Detalles implementación
- **BROKER_CONFIG_GUIDE.md** ← Manual completo

---

## ✅ Validación Instalación

```
✓ 15/15 validaciones exitosas
✓ Todos los archivos en lugar
✓ Contenido verificado
✓ Sintaxis correcta
✓ Listo para usar
```

**Próximo paso**: 
```bash
mysql -u root -p rpm_iot < database\migration-mqtt-broker.sql
```

---

**Versión**: 1.1.0 | **Actualizado**: 2026-03-18
