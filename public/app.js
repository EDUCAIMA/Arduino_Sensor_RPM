// ============================================================
//  ALERT MODAL SYSTEM (Fase 5)
// ============================================================
function showAlert(type, title, message) {
  const overlay = document.getElementById('alertOverlay');
  const iconWrapper = document.getElementById('alertIcon');
  const titleEl = document.getElementById('alertTitle');
  const msgEl = document.getElementById('alertMessage');
  const btn = document.getElementById('btnAlertConfirm');

  if (!overlay) return;

  iconWrapper.className = 'alert-icon-wrapper mb-4 ' + `alert-${type}`;
  
  let iconHtml = '';
  if (type === 'success') {
    iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else {
    iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }
  
  iconWrapper.innerHTML = iconHtml;
  titleEl.textContent = title;
  msgEl.textContent = message;

  overlay.classList.add('active');

  const closeAlert = () => {
    overlay.classList.remove('active');
    btn.removeEventListener('click', closeAlert);
  };

  btn.onclick = closeAlert;
}

// Global Alert Override
window.alert = function(msg) {
  showAlert('info', 'Notificación', msg);
};

// ============================================================
//  RPM IoT Monitor — Frontend Application
// ============================================================

const API = '';  // same origin
const WS_URL = `ws://${window.location.hostname}:3001`;

// ============================================================
//  STATE
// ============================================================
const state = {
  currentPage: 'dashboard',
  ws: null,
  wsConnected: false,
  procesoActivo: null,
  rpmHistory: [],       // últimos 60 datos para gráfico real-time
  maxHistoryPoints: 60,
  realtimeChart: null,
  histChart: null,
  histBarChart: null,
  histDoughnutChart: null,
  mqttConnected: false, // Estado MQTT
  dispositoActual: null, // Dispositivo registrado
};

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initWebSocket();
  initGauge();
  initRealtimeChart();
  initModal();
  initProcessActions();
  initHistorico();
  loadProcesos();
  loadDashboardDevice(); // Cargar dispositivo en dashboard
  updateMQTTIndicator(); // Actualizar indicador MQTT inicial

  // Refresh data periodically
  setInterval(() => {
    if (state.currentPage === 'procesos') loadProcesos();
  }, 10000);

  // Actualizar indicador MQTT cada 3 segundos
  setInterval(updateMQTTIndicator, 3000);
  
  // Actualizar dispositivo en dashboard cada 10 segundos
  setInterval(loadDashboardDevice, 10000);
});

// ============================================================
//  MQTT INDICATOR UPDATE
// ============================================================
async function updateMQTTIndicator() {
  try {
    const res = await fetch(`${API}/api/config/mqtt-status`);
    if (!res.ok) throw new Error('Error fetching MQTT status');
    
    const status = await res.json();
    const indicator = document.getElementById('mqttStatusIndicator');
    const dot = document.querySelector('.mqtt-status-dot');
    const text = document.querySelector('.mqtt-status-text');
    
    if (!indicator || !dot || !text) return;
    
    state.mqttConnected = status.connected;
    
    if (status.connected) {
      dot.className = 'mqtt-status-dot connected';
      text.textContent = 'MQTT Conectado';
      indicator.title = `Conectado a ${status.broker}:${status.puerto}`;
      indicator.classList.add('connected');
    } else {
      dot.className = 'mqtt-status-dot disconnected';
      text.textContent = 'MQTT Desconectado';
      indicator.title = 'Servidor MQTT desconectado';
      indicator.classList.remove('connected');
    }
  } catch (err) {
    const indicator = document.getElementById('mqttStatusIndicator');
    const dot = document.querySelector('.mqtt-status-dot');
    const text = document.querySelector('.mqtt-status-text');
    
    if (dot && text) {
      dot.className = 'mqtt-status-dot error';
      text.textContent = 'Error';
      if (indicator) {
        indicator.title = 'Error al conectar con MQTT';
        indicator.classList.remove('connected');
      }
    }
  }
}

// ============================================================
//  NAVIGATION
// ============================================================
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      switchPage(page);
      sidebar.classList.remove('open');
    });
  });

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

function switchPage(page) {
  state.currentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // Update top bar
  const titles = {
    dashboard: ['Dashboard', 'Monitoreo en tiempo real'],
    procesos: ['Procesos', 'Gestión de procesos de medición'],
    historico: ['Histórico', 'Gráficos y análisis histórico'],
    configuracion: ['Configuración', 'Gestión del broker MQTT y credenciales']
  };

  document.getElementById('pageTitle').textContent = titles[page][0];
  document.getElementById('pageSubtitle').textContent = titles[page][1];

  // Refresh data on page switch
  if (page === 'procesos') loadProcesos();
  if (page === 'historico') loadProcesoSelect();
  if (page === 'configuracion') loadConfiguracion();
}

// ============================================================
//  WEBSOCKET
// ============================================================
function initWebSocket() {
  connectWS();
}

function connectWS() {
  try {
    state.ws = new WebSocket(WS_URL);

    state.ws.onopen = () => {
      state.wsConnected = true;
      updateConnectionStatus(true);
      addLog('success', 'WebSocket conectado al servidor');
    };

    state.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWSMessage(data);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    state.ws.onclose = () => {
      state.wsConnected = false;
      updateConnectionStatus(false);
      addLog('warning', 'WebSocket desconectado. Reconectando en 3s...');
      setTimeout(connectWS, 3000);
    };

    state.ws.onerror = () => {
      state.wsConnected = false;
      updateConnectionStatus(false);
    };
  } catch (e) {
    console.error('WS connection error:', e);
    setTimeout(connectWS, 5000);
  }
}

function handleWSMessage(data) {
  switch (data.type) {
    case 'rpm_live':
      updateRPMDisplay(data);
      break;
    case 'device_status':
      updateDeviceStatus(data);
      break;
    case 'mqtt_status':
      if (state.currentPage === 'configuracion') {
        loadMQTTStatus();
      }
      break;
  }
}

function updateConnectionStatus(online) {
  const el = document.getElementById('connectionStatus');
  const dot = el.querySelector('.status-dot');
  const text = el.querySelector('span');

  dot.className = `status-dot ${online ? 'online' : 'offline'}`;
  text.textContent = online ? 'Conectado' : 'Desconectado';
}

// ============================================================
//  RPM DISPLAY UPDATE
// ============================================================
function triggerPulse(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.remove('data-pulse');
    void el.offsetWidth; // trigger reflow to restart animation
    el.classList.add('data-pulse');
    setTimeout(() => el.classList.remove('data-pulse'), 450);
  }
}

function updateRPMDisplay(data) {
  const rpm = data.rpm || 0;
  const pulsos = data.pulsos || 0;

  // Update stat cards
  document.getElementById('statRpm').textContent = rpm.toFixed(1);
  triggerPulse('statRpm');

  document.getElementById('statPulsos').textContent = pulsos;
  triggerPulse('statPulsos');

  document.getElementById('liveRpmValue').textContent = rpm.toFixed(0);
  triggerPulse('liveRpmValue');

  // Update uptime
  if (data.up) {
    document.getElementById('statUptime').textContent = formatUptime(data.up);
  }

  // Update proceso info
  if (data.procesoId) {
    document.getElementById('statProceso').textContent = `#${data.procesoId}`;
  }

  // Update target gauge value for smooth animation
  window.targetGaugeRPM = rpm;

  // Update realtime chart
  addRealtimeData(rpm, data.timestamp || new Date().toISOString());

  // Update trend
  const trend = document.getElementById('statRpmTrend');
  if (state.rpmHistory.length > 1) {
    const prev = state.rpmHistory[state.rpmHistory.length - 2]?.rpm || 0;
    trend.className = `stat-trend ${rpm > prev ? 'up' : rpm < prev ? 'down' : ''}`;
  }

  // Log
  if (data.sinProceso) {
    addLog('warning', `RPM: ${rpm.toFixed(1)} (sin proceso activo)`);
  } else {
    addLog('info', `RPM: ${rpm.toFixed(1)} | Pulsos: ${pulsos}`);
  }
}

function updateDeviceStatus(data) {
  addLog('success', `Sensor: IP=${data.ip} | RSSI=${data.rssi}dBm | RPM=${(data.rpm || 0).toFixed(1)}`);
  
  // Actualizar dispositivo en dashboard
  if (state.dispositoActual) {
    state.dispositoActual.ip = data.ip;
    state.dispositoActual.rssi = data.rssi;
    state.dispositoActual.ultimo_up = data.up;
    state.dispositoActual.ultimo_contacto = new Date().toISOString();
    loadDashboardDevice();
  }
}

// ============================================================
let gaugeCtx;
const GAUGE_MAX = 6000;
window.currentGaugeRPM = 0;
window.targetGaugeRPM = 0;

function initGauge() {
  const canvas = document.getElementById('gaugeCanvas');
  gaugeCtx = canvas.getContext('2d');
  
  // Iniciar loop de animación fluida
  function animate() {
    const diff = window.targetGaugeRPM - window.currentGaugeRPM;
    if (Math.abs(diff) > 0.05) {
      window.currentGaugeRPM += diff * 0.12; // Velocidad de suavizado
      drawGauge(window.currentGaugeRPM);
    }
    requestAnimationFrame(animate);
  }
  
  animate();
}

function drawGauge(rpm) {
  const canvas = gaugeCtx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h - 25;
  const r = Math.min(w, h) * 0.72 - 20;

  gaugeCtx.clearRect(0, 0, w, h);

  const startAngle = 0.82 * Math.PI;
  const endAngle = 2.18 * Math.PI;
  const totalAngle = endAngle - startAngle;
  const rpmRatio = Math.min(rpm, GAUGE_MAX) / GAUGE_MAX;
  const valueAngle = startAngle + rpmRatio * totalAngle;

  // 1. Fondo de Escala (Arcos concéntricos)
  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, startAngle, endAngle);
  gaugeCtx.lineWidth = 14;
  gaugeCtx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; // Sombra base
  gaugeCtx.stroke();

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, startAngle, endAngle);
  gaugeCtx.lineWidth = 8;
  gaugeCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; // Surco
  gaugeCtx.stroke();

  // 2. Zona de Peligro (Arco sutil)
  const dangerStart = startAngle + (5000 / GAUGE_MAX) * totalAngle;
  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r + 8, dangerStart, endAngle);
  gaugeCtx.lineWidth = 3;
  gaugeCtx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
  gaugeCtx.stroke();

  // 3. Ticks y Escala Mejorada
  for (let i = 0; i <= 12; i++) {
    const tickRpm = i * 500;
    const angle = startAngle + (tickRpm / GAUGE_MAX) * totalAngle;
    
    // Ticks principales cada 1000, secundarios cada 500
    const isMajor = i % 2 === 0;
    const tLen = isMajor ? 14 : 7;
    const x1 = cx + (r - 2) * Math.cos(angle);
    const y1 = cy + (r - 2) * Math.sin(angle);
    const x2 = cx + (r - 2 - tLen) * Math.cos(angle);
    const y2 = cy + (r - 2 - tLen) * Math.sin(angle);

    gaugeCtx.beginPath();
    gaugeCtx.moveTo(x1, y1);
    gaugeCtx.lineTo(x2, y2);
    gaugeCtx.lineWidth = isMajor ? 2.5 : 1.2;
    gaugeCtx.strokeStyle = tickRpm >= 5000 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 0, 0, 0.2)';
    gaugeCtx.stroke();

    // Labels cada 1000
    if (isMajor) {
      const lx = cx + (r - 35) * Math.cos(angle);
      const ly = cy + (r - 35) * Math.sin(angle);
      gaugeCtx.fillStyle = tickRpm >= 5000 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(0, 0, 0, 0.5)';
      gaugeCtx.font = `bold 11px var(--font-mono)`;
      gaugeCtx.textAlign = 'center';
      gaugeCtx.textBaseline = 'middle';
      gaugeCtx.fillText(`${tickRpm / 1000}`, lx, ly);
    }
  }

  // 4. Arco de Valor con Brillo
  if (rpm > 10) {
    const gradient = gaugeCtx.createLinearGradient(cx - r, 0, cx + r, 0);
    gradient.addColorStop(0, '#00843d'); // Verde Corhuila
    gradient.addColorStop(0.7, '#f7941e'); // Naranja Corhuila
    gradient.addColorStop(1, '#ef4444');    // Rojo Peligro

    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, r, startAngle, valueAngle);
    gaugeCtx.lineWidth = 10;
    gaugeCtx.strokeStyle = gradient;
    gaugeCtx.lineCap = 'round';
    
    // Sombra de brillo para el arco
    gaugeCtx.shadowBlur = rpm > 4500 ? 12 : 5;
    gaugeCtx.shadowColor = rpm > 5000 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 132, 61, 0.4)';
    gaugeCtx.stroke();
    gaugeCtx.shadowBlur = 0;
  }

  // 5. Aguja Pro (Estilo deportivo)
  const nLen = r + 2;
  const nx = cx + nLen * Math.cos(valueAngle);
  const ny = cy + nLen * Math.sin(valueAngle);

  // Cuerpo de la aguja con gradiente
  gaugeCtx.beginPath();
  const needleGrad = gaugeCtx.createLinearGradient(cx, cy, nx, ny);
  needleGrad.addColorStop(0, '#1a1f35');
  needleGrad.addColorStop(1, rpm > 5000 ? '#ef4444' : '#00843d');
  
  gaugeCtx.lineWidth = 4;
  gaugeCtx.lineCap = 'round';
  gaugeCtx.strokeStyle = needleGrad;
  gaugeCtx.moveTo(cx, cy);
  gaugeCtx.lineTo(nx, ny);
  gaugeCtx.stroke();

  // Centro de Aguja (Estilo eje metálico)
  const hubRadius = 10;
  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
  const hubGrad = gaugeCtx.createRadialGradient(cx-2, cy-2, 1, cx, cy, hubRadius);
  hubGrad.addColorStop(0, '#4a5568');
  hubGrad.addColorStop(1, '#1a1f35');
  gaugeCtx.fillStyle = hubGrad;
  gaugeCtx.fill();
  gaugeCtx.strokeStyle = 'rgba(255,255,255,0.1)';
  gaugeCtx.lineWidth = 1;
  gaugeCtx.stroke();

  // Punto central brillante
  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, 2.5, 0, 2 * Math.PI);
  gaugeCtx.fillStyle = '#ffffff';
  gaugeCtx.shadowBlur = 5;
  gaugeCtx.shadowColor = 'white';
  gaugeCtx.fill();
  gaugeCtx.shadowBlur = 0;

  // 6. Actualizar valor digital inferior
  const valEl = document.getElementById('gaugeValue');
  if (valEl) {
    valEl.textContent = rpm.toFixed(0);
    valEl.style.color = rpm > 5000 ? 'var(--red)' : 'var(--corhuila-green)';
    valEl.style.textShadow = rpm > 5000 ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none';
  }
}

// ============================================================
//  REALTIME CHART
// ============================================================
function initRealtimeChart() {
  const ctx = document.getElementById('realtimeChart').getContext('2d');

  state.realtimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'RPM',
        data: [],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#6366f1',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1f35',
          borderColor: '#6366f1',
          borderWidth: 1,
          titleColor: '#f0f2f5',
          bodyColor: '#8b95a7',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'JetBrains Mono' },
          padding: 12,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          display: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a6478',
            font: { size: 10, family: 'JetBrains Mono' },
            maxRotation: 0,
            maxTicksLimit: 8,
          }
        },
        y: {
          display: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a6478',
            font: { size: 10, family: 'JetBrains Mono' },
          },
          beginAtZero: true,
        }
      },
      interaction: {
        intersect: false,
        mode: 'index',
      }
    }
  });
}

function addRealtimeData(rpm, timestamp) {
  const time = new Date(timestamp).toLocaleTimeString('es-CO', { hour12: false });

  state.rpmHistory.push({ rpm, time });
  if (state.rpmHistory.length > state.maxHistoryPoints) {
    state.rpmHistory.shift();
  }

  state.realtimeChart.data.labels = state.rpmHistory.map(d => d.time);
  state.realtimeChart.data.datasets[0].data = state.rpmHistory.map(d => d.rpm);
  state.realtimeChart.update('none');

  document.getElementById('readingsCount').textContent = `${state.rpmHistory.length} lecturas`;
}

// ============================================================
//  MODAL
// ============================================================
function initModal() {
  const overlay = document.getElementById('modalOverlay');
  const btnNew = document.getElementById('btnNuevoProceso');
  const btnClose = document.getElementById('modalClose');
  const btnCancel = document.getElementById('modalCancel');
  const btnCreate = document.getElementById('modalCreate');

  btnNew.addEventListener('click', () => overlay.classList.add('active'));
  btnClose.addEventListener('click', () => overlay.classList.remove('active'));
  btnCancel.addEventListener('click', () => overlay.classList.remove('active'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });

  btnCreate.addEventListener('click', createProceso);
}

async function createProceso() {
  const nombre = document.getElementById('procNombre').value.trim();
  const descripcion = document.getElementById('procDescripcion').value.trim();

  if (!nombre) {
    showAlert('error', 'Campo Requerido', 'El nombre del proceso es obligatorio');
    return;
  }

  try {
    const res = await fetch(`${API}/api/procesos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert('error', 'No se pudo crear', data.error || 'Error interno del servidor');
      return;
    }

    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('procNombre').value = '';
    document.getElementById('procDescripcion').value = '';

    showAlert('success', '¡Éxito!', `El proceso "${nombre}" ha sido creado e iniciado.`);
    addLog('success', `Proceso "${nombre}" creado exitosamente`);
    loadProcesos();
  } catch (err) {
    showAlert('error', 'Error de Red', 'No se pudo conectar con el servidor: ' + err.message);
  }
}

// ============================================================
//  PROCESS ACTIONS
// ============================================================
function initProcessActions() {
  document.getElementById('btnPausarProceso').addEventListener('click', async () => {
    if (!state.procesoActivo) return;
    try {
      await fetch(`${API}/api/procesos/${state.procesoActivo.id}/pausar`, { method: 'PUT' });
      addLog('warning', `Proceso "${state.procesoActivo.nombre}" pausado`);
      loadProcesos();
    } catch (err) { console.error(err); }
  });

  document.getElementById('btnFinalizarProceso').addEventListener('click', async () => {
    if (!state.procesoActivo) return;
    if (!confirm(`¿Finalizar el proceso "${state.procesoActivo.nombre}"?`)) return;
    try {
      await fetch(`${API}/api/procesos/${state.procesoActivo.id}/finalizar`, { method: 'PUT' });
      addLog('success', `Proceso "${state.procesoActivo.nombre}" finalizado`);
      loadProcesos();
    } catch (err) { console.error(err); }
  });

  document.getElementById('clearLog').addEventListener('click', () => {
    document.getElementById('activityLog').innerHTML = '';
  });
}

// ============================================================
//  LOAD PROCESOS
// ============================================================
async function loadProcesos() {
  try {
    const res = await fetch(`${API}/api/procesos`);
    const procesos = await res.json();

    // Find active process
    state.procesoActivo = procesos.find(p => p.estado === 'activo') || null;
    updateActiveProcessBanner();

    // Update stat card
    document.getElementById('statProceso').textContent =
      state.procesoActivo ? state.procesoActivo.nombre : 'Ninguno';

    // Render table
    const tbody = document.getElementById('procesosBody');
    if (procesos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No hay procesos registrados</td></tr>';
      return;
    }

    tbody.innerHTML = procesos.map(p => `
      <tr>
        <td style="font-family:var(--font-mono);color:var(--text-muted);">#${p.id}</td>
        <td style="font-weight:600;">${escapeHtml(p.nombre)}</td>
        <td>
          <span class="badge badge-${p.estado}">
            <span class="badge-dot"></span>
            ${p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
          </span>
        </td>
        <td style="font-family:var(--font-mono);font-size:12px;">${formatDate(p.fecha_inicio)}</td>
        <td style="font-family:var(--font-mono);font-size:12px;">${p.fecha_fin ? formatDate(p.fecha_fin) : '—'}</td>
        <td style="font-family:var(--font-mono);">${(p.rpm_promedio || 0).toFixed(1)}</td>
        <td style="font-family:var(--font-mono);">${(p.rpm_max || 0).toFixed(1)}</td>
        <td style="font-family:var(--font-mono);">${p.total_lecturas || 0}</td>
        <td>
          <div style="display:flex;gap:4px;">
            ${p.estado === 'activo' ? `
              <button class="btn btn-sm btn-warning" onclick="pausarProceso(${p.id})">Pausar</button>
              <button class="btn btn-sm btn-danger" onclick="finalizarProceso(${p.id})">Finalizar</button>
            ` : ''}
            ${p.estado === 'pausado' ? `
              <button class="btn btn-sm btn-primary" onclick="reanudarProceso(${p.id})">Reanudar</button>
              <button class="btn btn-sm btn-danger" onclick="finalizarProceso(${p.id})">Finalizar</button>
            ` : ''}
            ${p.estado === 'finalizado' || p.estado === 'cancelado' ? `
              <button class="btn btn-sm btn-ghost" onclick="verHistorico(${p.id})">Ver Gráficos</button>
              <button class="btn btn-sm btn-danger" onclick="eliminarProceso(${p.id}, '${escapeHtml(p.nombre)}')">Eliminar</button>
            ` : ''}
            <button class="btn btn-sm btn-pdf" onclick="exportPdfProceso(${p.id})" title="Exportar reporte PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 18 15 15"/>
              </svg>
              PDF
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading procesos:', err);
  }
}

function updateActiveProcessBanner() {
  const banner = document.getElementById('activeProcessBanner');
  if (!state.procesoActivo) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  document.getElementById('apbName').textContent = state.procesoActivo.nombre;
  document.getElementById('apbDesc').textContent = state.procesoActivo.descripcion || 'Sin descripción';
  document.getElementById('apbInicio').textContent = `Inicio: ${formatDate(state.procesoActivo.fecha_inicio)}`;
  document.getElementById('apbLecturas').textContent = `Lecturas: ${state.procesoActivo.total_lecturas || 0}`;
  document.getElementById('apbRpmAvg').textContent = `RPM Prom: ${(state.procesoActivo.rpm_promedio || 0).toFixed(1)}`;
}

// Global functions for table buttons
window.pausarProceso = async function(id) {
  try {
    await fetch(`${API}/api/procesos/${id}/pausar`, { method: 'PUT' });
    loadProcesos();
  } catch (err) { console.error(err); }
};

window.finalizarProceso = async function(id) {
  if (!confirm('¿Está seguro de finalizar este proceso?')) return;
  try {
    await fetch(`${API}/api/procesos/${id}/finalizar`, { method: 'PUT' });
    loadProcesos();
  } catch (err) { console.error(err); }
};

window.reanudarProceso = async function(id) {
  try {
    const res = await fetch(`${API}/api/procesos/${id}/reanudar`, { method: 'PUT' });
    const data = await res.json();
    if (!res.ok) { showAlert('error', 'Error', data.error); return; }
    loadProcesos();
  } catch (err) { console.error(err); }
};

window.eliminarProceso = async function(id, nombre) {
  if (!confirm(`¿Eliminar el proceso "${nombre}" y todas sus lecturas?`)) return;
  try {
    await fetch(`${API}/api/procesos/${id}`, { method: 'DELETE' });
    loadProcesos();
  } catch (err) { console.error(err); }
};

window.verHistorico = function(id) {
  switchPage('historico');
  setTimeout(() => {
    document.getElementById('histProcessSelect').value = id;
    loadHistorico(id);
  }, 100);
};

// ============================================================
//  HISTORICO
// ============================================================
function initHistorico() {
  const selectProcess = document.getElementById('histProcessSelect');
  const selectInterval = document.getElementById('histInterval');
  const btnLoad = document.getElementById('btnLoadHist');

  const triggerLoad = () => {
    const id = selectProcess.value;
    if (id) {
      loadHistorico(id);
    }
  };

  // Auto-load on change
  selectProcess.addEventListener('change', triggerLoad);
  selectInterval.addEventListener('change', triggerLoad);

  // Manual refresh still works
  if (btnLoad) {
    btnLoad.addEventListener('click', triggerLoad);
  }

  const btnPdf = document.getElementById('btnExportPdf');
  if (btnPdf) {
    btnPdf.onclick = () => exportCurrentHistoricoPdf();
  }
}

async function loadProcesoSelect() {
  try {
    const res = await fetch(`${API}/api/procesos`);
    const procesos = await res.json();
    const select = document.getElementById('histProcessSelect');
    const currentVal = select.value;

    select.innerHTML = '<option value="">— Seleccionar proceso —</option>';
    procesos.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `#${p.id} — ${p.nombre} (${p.estado})`;
      select.appendChild(option);
    });

    if (currentVal) select.value = currentVal;
  } catch (err) {
    console.error(err);
  }
}

async function loadHistorico(procesoId) {
  const interval = document.getElementById('histInterval').value;

  try {
    // Load stats
    const statsRes = await fetch(`${API}/api/lecturas/${procesoId}/stats`);
    const stats = await statsRes.json();

    document.getElementById('histStats').style.display = 'grid';
    document.getElementById('histAvg').textContent = stats.promedio || 0;
    document.getElementById('histMax').textContent = stats.maximo || 0;
    document.getElementById('histMin').textContent = stats.minimo || 0;
    document.getElementById('histStd').textContent = stats.desviacion || 0;
    document.getElementById('histTotal').textContent = stats.total || 0;

    if (stats.primera_lectura && stats.ultima_lectura) {
      const d1 = new Date(stats.primera_lectura);
      const d2 = new Date(stats.ultima_lectura);
      const diffMs = d2 - d1;
      document.getElementById('histDuration').textContent = formatDuration(diffMs);
    }

    // Análisis Automático
    const analysis = generateAutomaticAnalysis(stats);
    document.getElementById('histAnalysisCard').style.display = 'block';
    document.getElementById('histAnalysisContent').innerHTML = analysis.html;
    state.currentAnalysis = analysis.text; // Guardar para PDF

    // Load chart data
    const chartRes = await fetch(`${API}/api/lecturas/${procesoId}/chart?interval=${interval}`);
    const chartData = await chartRes.json();

    renderHistChart(chartData);
    renderHistBarChart(chartData);
    renderHistDoughnutChart(chartData);

    // Show PDF button
    document.getElementById('btnExportPdf').style.display = 'inline-flex';
  } catch (err) {
    console.error('Error loading historico:', err);
    alert('Error cargando datos históricos');
  }
}

function renderHistChart(data) {
  const ctx = document.getElementById('histChart').getContext('2d');

  if (state.histChart) state.histChart.destroy();

  state.histChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.periodo),
      datasets: [
        {
          label: 'RPM Promedio',
          data: data.map(d => d.rpm_avg),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: data.length < 50 ? 3 : 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#6366f1',
        },
        {
          label: 'RPM Máximo',
          data: data.map(d => d.rpm_max),
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'RPM Mínimo',
          data: data.map(d => d.rpm_min),
          borderColor: '#22d3ee',
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#8b95a7',
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
          }
        },
        tooltip: {
          backgroundColor: '#1a1f35',
          borderColor: '#6366f1',
          borderWidth: 1,
          titleColor: '#f0f2f5',
          bodyColor: '#8b95a7',
          padding: 12,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a6478',
            font: { size: 10, family: 'JetBrains Mono' },
            maxRotation: 45,
            maxTicksLimit: 20,
          }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a6478',
            font: { size: 10, family: 'JetBrains Mono' },
          },
          beginAtZero: true,
        }
      }
    }
  });
}

function renderHistBarChart(data) {
  const ctx = document.getElementById('histBarChart').getContext('2d');

  if (state.histBarChart) state.histBarChart.destroy();

  // Show last 20 items for bar chart
  const barData = data.slice(-20);

  state.histBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: barData.map(d => d.periodo.split(' ').pop() || d.periodo),
      datasets: [
        {
          label: 'Máximo',
          data: barData.map(d => d.rpm_max),
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Promedio',
          data: barData.map(d => d.rpm_avg),
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Mínimo',
          data: barData.map(d => d.rpm_min),
          backgroundColor: 'rgba(34, 211, 238, 0.6)',
          borderColor: '#22d3ee',
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#8b95a7',
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#5a6478',
            font: { size: 9, family: 'JetBrains Mono' },
            maxRotation: 45,
          }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a6478', font: { size: 10, family: 'JetBrains Mono' } },
          beginAtZero: true,
        }
      }
    }
  });
}

function renderHistDoughnutChart(data) {
  const ctx = document.getElementById('histDoughnutChart').getContext('2d');

  if (state.histDoughnutChart) state.histDoughnutChart.destroy();

  // Group readings into ranges
  const ranges = { '0-500': 0, '500-1000': 0, '1000-2000': 0, '2000-3000': 0, '3000+': 0 };
  data.forEach(d => {
    const avg = d.rpm_avg;
    if (avg < 500) ranges['0-500'] += d.lecturas;
    else if (avg < 1000) ranges['500-1000'] += d.lecturas;
    else if (avg < 2000) ranges['1000-2000'] += d.lecturas;
    else if (avg < 3000) ranges['2000-3000'] += d.lecturas;
    else ranges['3000+'] += d.lecturas;
  });

  const activeRanges = Object.entries(ranges).filter(([, v]) => v > 0);

  state.histDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: activeRanges.map(([k]) => k + ' RPM'),
      datasets: [{
        data: activeRanges.map(([, v]) => v),
        backgroundColor: [
          'rgba(34, 211, 238, 0.7)',
          'rgba(99, 102, 241, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
        borderColor: '#1a1f35',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8b95a7',
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            padding: 16,
          }
        }
      }
    }
  });
}

// ============================================================
//  PDF GENERATION
// ============================================================
window.exportPdfProceso = async function(id) {
  // If we are already on the historic page with this ID, just export
  const currentId = document.getElementById('histProcessSelect').value;
  if (currentId == id && document.getElementById('page-historico').classList.contains('active')) {
    return exportCurrentHistoricoPdf();
  }

  // Otherwise, we need to load it first. For simplicity and consistent graphs, 
  // we redirect to historico and auto-trigger after load.
  verHistorico(id);
  setTimeout(() => {
    const checkLoaded = setInterval(() => {
      if (document.getElementById('histStats').style.display !== 'none') {
        const histId = document.getElementById('histProcessSelect').value;
        if (histId == id) {
          clearInterval(checkLoaded);
          exportCurrentHistoricoPdf();
        }
      }
    }, 500);
    // Timeout after 10s
    setTimeout(() => clearInterval(checkLoaded), 10000);
  }, 200);
};

async function exportCurrentHistoricoPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const procId = document.getElementById('histProcessSelect').value;
  const select = document.getElementById('histProcessSelect');
  const procText = select.options[select.selectedIndex].text;
  
  const btn = document.getElementById('btnExportPdf');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span>Generando...</span>';
  btn.disabled = true;

  try {
    // 0. Get Logo Base64
    const logoBase64 = await getImageBase64('corhuila-logo.png');

    // 1. Header (Institutional)
    doc.setFillColor(0, 132, 61); // Corhuila Green
    doc.rect(0, 0, 210, 42, 'F');
    
    // Add Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 15, 8, 25, 25);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE MONITOREO RPM', 115, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('CORPORACIÓN UNIVERSITARIA DEL HUILA — CORHUILA', 115, 27, { align: 'center' });
    doc.text('FACULTAD DE INGENIERÍA — SEDE PITALITO', 115, 33, { align: 'center' });
    
    // 2. Process Info
    doc.setTextColor(15, 23, 42); // Dark slate
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalles del Proceso', 20, 58);
    doc.setDrawColor(0, 132, 61);
    doc.setLineWidth(0.5);
    doc.line(20, 60, 70, 60);

    doc.setFontSize(10);
    doc.text('Proceso:', 20, 71);
    doc.setFont('helvetica', 'normal');
    doc.text(procText, 55, 71);

    doc.setFont('helvetica', 'bold');
    doc.text('ID:', 20, 78);
    doc.setFont('helvetica', 'normal');
    doc.text('#' + procId, 55, 78);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha Reporte:', 20, 85);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString(), 55, 85);

    // 3. Stats Summary
    const avg = document.getElementById('histAvg').textContent;
    const max = document.getElementById('histMax').textContent;
    const min = document.getElementById('histMin').textContent;
    const total = document.getElementById('histTotal').textContent;
    const duration = document.getElementById('histDuration').textContent;
    const std = document.getElementById('histStd').textContent;

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 252, 250);
    doc.roundedRect(15, 95, 180, 45, 3, 3, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 132, 61);
    doc.text('RESUMEN ESTADÍSTICO', 105, 103, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(50, 55, 65);
    doc.text('RPM Promedio:', 25, 115); doc.text(avg + ' RPM', 65, 115);
    doc.text('RPM Máximo:', 25, 123);    doc.text(max + ' RPM', 65, 123);
    doc.text('RPM Mínimo:', 25, 131);    doc.text(min + ' RPM', 65, 131);

    doc.text('Total Lecturas:', 110, 115); doc.text(total, 155, 115);
    doc.text('Duración:', 110, 123);      doc.text(duration, 155, 123);
    doc.text('Desviación:', 110, 131);    doc.text(std, 155, 131);

    // 3.5 Automatic Analysis Text
    if (state.currentAnalysis) {
      doc.setFontSize(11);
      doc.setTextColor(0, 100, 45); // Darker green
      doc.text('ANÁLISIS DE OPERACIÓN:', 20, 150);
      
      doc.setFontSize(9);
      doc.setTextColor(40, 45, 55);
      doc.setFont('helvetica', 'italic');
      
      const splitAnalysis = doc.splitTextToSize(state.currentAnalysis, 170);
      doc.text(splitAnalysis, 20, 158);
    }

    // 4. Capture Charts
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis de Tendencia (Línea)', 20, 195);
    doc.line(20, 197, 90, 197);

    // Main Chart - Proportional
    const histCanvas = document.getElementById('histChart');
    const histImg = histCanvas.toDataURL('image/png', 1.0);
    const histRatio = histCanvas.height / histCanvas.width;
    const histW = 180;
    const histH = histW * histRatio;
    doc.addImage(histImg, 'PNG', 15, 203, histW, histH);

    // Second Page
    doc.addPage();
    doc.setFillColor(0, 132, 61);
    doc.rect(0, 0, 210, 5, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribución y Comparativa (Barras)', 20, 25);
    doc.line(20, 27, 95, 27);
    
    const barCanvas = document.getElementById('histBarChart');
    const barImg = barCanvas.toDataURL('image/png', 1.0);
    const barRatio = barCanvas.height / barCanvas.width;
    const barW = 180;
    const barH = barW * barRatio;
    doc.addImage(barImg, 'PNG', 15, 35, barW, barH);

    doc.setFontSize(14);
    doc.text('Densidad de Lecturas', 20, barH + 50);
    doc.line(20, barH + 52, 70, barH + 52);

    const doughCanvas = document.getElementById('histDoughnutChart');
    const doughImg = doughCanvas.toDataURL('image/png', 1.0);
    doc.addImage(doughImg, 'PNG', 55, barH + 60, 100, 100);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(160);
    doc.text('Este documento es un reporte técnico generado por el Sistema de Monitoreo IoT - Corhuila.', 105, 280, { align: 'center' });
    doc.text('© Corhuila 2026 — Sede Pitalito, Huila', 105, 285, { align: 'center' });

    doc.save(`Reporte_RPM_Proceso_${procId}.pdf`);
    addLog('success', 'Reporte PDF con logo generado correctamente');
  } catch (err) {
    console.error('Error generating PDF:', err);
    showAlert('error', 'Error PDF', 'No se pudo generar el reporte: ' + err.message);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

async function getImageBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Logo not found', e);
    return null;
  }
}

// ============================================================
//  AUTOMATIC ANALYSIS ENGINE
// ============================================================
function generateAutomaticAnalysis(stats) {
  const avg = parseFloat(stats.promedio) || 0;
  const max = parseFloat(stats.maximo) || 0;
  const std = parseFloat(stats.desviacion) || 0;
  const total = parseInt(stats.total) || 0;

  let interpretation = "";
  let htmlInterpretation = "";

  // 1. Stability Analysis
  const cv = avg > 0 ? (std / avg) : 0; // Coeficiente de variación
  let stabilityClass = "";
  let stabilityText = "";

  if (cv < 0.1) {
    stabilityText = "Operación Altamente Estable";
    interpretation += `El motor presenta una estabilidad excepcional (CV: ${(cv * 100).toFixed(1)}%). `;
    htmlInterpretation += `<strong style="color:var(--corhuila-green)">✓ Estabilidad Optima:</strong> El motor presenta una estabilidad excepcional con variaciones mínimas respecto al promedio. `;
  } else if (cv < 0.25) {
    stabilityText = "Operación Normal";
    interpretation += `La operación se mantiene dentro de los parámetros normales de fluctuación. `;
    htmlInterpretation += `<strong style="color:var(--orange)">⚠ Estabilidad Nominal:</strong> La operación se mantiene dentro de los parámetros normales con fluctuaciones moderadas. `;
  } else {
    stabilityText = "Operación Inestable";
    interpretation += `Se detecta una alta variabilidad en las RPM, lo cual podría indicar fallas mecánicas, carga irregular o problemas de alimentación. `;
    htmlInterpretation += `<strong style="color:var(--red)">✖ Inestabilidad Detectada:</strong> Se detecta una alta variabilidad en las RPM. Se recomienda revisar la alineación del eje o la consistencia de la carga. `;
  }

  // 2. Performance & Peaks
  const peakRatio = avg > 0 ? (max / avg) : 1;
  if (peakRatio > 1.5) {
    interpretation += `Existen picos de velocidad que superan en un ${(peakRatio*100-100).toFixed(0)}% el promedio, indicando posibles arranques bruscos o pérdidas momentáneas de carga. `;
    htmlInterpretation += `<br><br><strong style="color:var(--red)">⚡ Picos Críticos:</strong> Se registraron picos que superan significativamente el promedio, lo cual puede estresar los componentes motorizados. `;
  } else {
    interpretation += `La relación entre el pico máximo y el promedio es saludable. `;
  }

  // 3. Data Consistency
  interpretation += `El análisis se basa en una muestra sólida de ${total} lecturas capturadas durante el proceso. `;
  
  // 4. Conclusion
  let conclusion = "";
  if (cv < 0.2 && avg > 0) {
    conclusion = "El sistema operó satisfactoriamente según los estándares de eficiencia esperados.";
  } else if (avg === 0) {
    conclusion = "No se detectó movimiento significativo durante el periodo evaluado.";
  } else {
    conclusion = "Se sugiere monitoreo preventivo debido a las irregularidades detectadas en el régimen de giro.";
  }

  const finalText = `${interpretation} En conclusión: ${conclusion}`;
  htmlInterpretation += `<br><br><strong>Resumen Final:</strong> ${conclusion}`;

  return {
    text: finalText,
    html: htmlInterpretation
  };
}

// ============================================================
//  DISPOSITIVO EN DASHBOARD
// ============================================================
async function loadDashboardDevice() {
  try {
    const res = await fetch(`${API}/api/dispositivos`);
    const devices = await res.json();

    const container = document.getElementById('dashboardDeviceContainer');
    
    if (devices.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Esperando que el sensor ESP32 se conecte...</p>
        </div>`;
      return;
    }

    // Mostrar el primer dispositivo (generalmente el único)
    const device = devices[0];
    state.dispositoActual = device;
    
    // Verificar si el dispositivo envió un tópico recientemente (ej. hace menos de 2 minutos)
    const isTransmitting = device.ultimo_contacto && (new Date() - new Date(device.ultimo_contacto)) < 120000;
    
    // Si tiene IP/RSSI y está transmitiendo, está realmente activo
    const isActive = device.ip && device.rssi && isTransmitting;

    const lastContact = device.ultimo_contacto 
      ? new Date(device.ultimo_contacto).toLocaleTimeString('es-CO')
      : 'Nunca';

    container.innerHTML = `
      <div class="sensor-info" style="border-radius: 8px; border: 1px solid ${isActive ? 'var(--green)' : 'var(--border)'}; background: ${isActive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)'}; padding: 16px;">
        <div class="sensor-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div class="sensor-name" style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; background: ${isActive ? 'var(--green-glow)' : 'var(--bg-elevated)'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${isActive ? 'var(--green)' : 'var(--text-muted)'};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            <div style="font-weight: 600; font-size: 14px;">${escapeHtml(device.nombre)}</div>
          </div>
          <div class="sensor-status ${isActive ? 'online' : 'offline'}" style="display: flex; align-items: center; gap: 6px;">
            <span class="status-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${isActive ? 'var(--green)' : 'var(--text-muted)'}; box-shadow: ${isActive ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none'}; animation: ${isActive ? 'pulse-mqtt 2s infinite' : 'none'};"></span>
            <span style="font-weight: 600; color: ${isActive ? 'var(--green)' : 'var(--text-muted)'}; font-size: 11px; text-transform: uppercase;">
              ${isActive ? '● CONECTADO' : '○ DESCONECTADO'}
            </span>
          </div>
        </div>
        <div class="sensor-meta-grid">
          <div class="sensor-meta-item">
            <span class="sensor-meta-label">ID Cliente</span>
            <span class="sensor-meta-value" title="${escapeHtml(device.client_id)}">${escapeHtml(device.client_id)}</span>
          </div>
          <div class="sensor-meta-item">
            <span class="sensor-meta-label">IP</span>
            <span class="sensor-meta-value">${device.ip || '—'}</span>
          </div>
          <div class="sensor-meta-item">
            <span class="sensor-meta-label">Calidad de Señal</span>
            <span class="sensor-meta-value" style="display: flex; align-items: center;">
              ${getSignalIndicatorHTML(device.rssi)}
            </span>
          </div>
          <div class="sensor-meta-item">
            <span class="sensor-meta-label">Último Contacto</span>
            <span class="sensor-meta-value">${lastContact}</span>
          </div>
          <div class="sensor-meta-item">
            <span class="sensor-meta-label">Uptime</span>
            <span class="sensor-meta-value">${formatUptime(device.ultimo_up || 0)}</span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error loading dashboard device:', err);
    const container = document.getElementById('dashboardDeviceContainer');
    if (container) {
      container.innerHTML = '<div class="empty-state error">Error cargando dispositivo</div>';
    }
  }
}

// Helper function para formatear tiempo de uptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


// ============================================================
//  ACTIVITY LOG
// ============================================================
function addLog(type, message) {
  const log = document.getElementById('activityLog');
  const time = new Date().toLocaleTimeString('es-CO', { hour12: false });

  const item = document.createElement('div');
  item.className = `activity-item ${type}`;
  item.innerHTML = `
    <span class="activity-time">${time}</span>
    <span class="activity-msg">${escapeHtml(message)}</span>
  `;

  log.insertBefore(item, log.firstChild);

  // Keep max 50 entries
  while (log.children.length > 50) {
    log.removeChild(log.lastChild);
  }
}

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
}

function formatUptime(seconds) {
  if (!seconds || seconds === 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Retorna el HTML de barras de señal basado en el valor RSSI
 * @param {number} rssi 
 */
function getSignalIndicatorHTML(rssi) {
  if (!rssi) return '<span class="text-muted">Desconocido</span>';
  
  let level = 'excellent';
  let label = 'Excelente';
  
  if (rssi <= -90) { level = 'poor'; label = 'Deficiente'; }
  else if (rssi <= -80) { level = 'fair'; label = 'Regular'; }
  else if (rssi <= -70) { level = 'good'; label = 'Buena'; }
  
  return `
    <div class="signal-wrapper" title="RSSI: ${rssi} dBm (${label})">
      <div class="signal-indicator ${level}">
        <div class="signal-bar"></div>
        <div class="signal-bar"></div>
        <div class="signal-bar"></div>
        <div class="signal-bar"></div>
      </div>
      <span class="signal-label" style="font-size: 10px; color: var(--text-muted); font-weight: 600; margin-left: 6px;">${rssi} dBm</span>
    </div>
  `;
}

// ============================================================
//  CONFIGURATION PAGE
// ============================================================
async function loadConfiguracion() {
  await loadBrokers();
  initConfigurationEventListeners();
}

async function loadBrokers() {
  try {
    const res = await fetch(`${API}/api/config/brokers`);
    const brokers = await res.json();

    const container = document.getElementById('brokersList');

    if (brokers.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay brokers configurados. Agregue uno nuevo.</div>';
      return;
    }

    container.innerHTML = brokers.map(broker => `
      <div class="broker-item ${broker.activo ? 'active' : ''}">
        <div class="broker-header">
          <div class="broker-title">
            <h4>${escapeHtml(broker.nombre)}</h4>
            ${broker.activo ? '<span class="badge badge-success">ACTIVO</span>' : '<span class="badge badge-gray">INACTIVO</span>'}
          </div>
          <div class="broker-actions">
            <button class="btn btn-sm btn-primary" onclick="editBroker(${broker.id})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteBroker(${broker.id}, '${escapeHtml(broker.nombre)}')">Eliminar</button>
          </div>
        </div>
        <div class="broker-info">
          <div class="info-item">
            <span class="label">Servidor:</span>
            <span class="value">${escapeHtml(broker.servidor)}:${broker.puerto}</span>
          </div>
          <div class="info-item">
            <span class="label">Protocolo:</span>
            <span class="value">${broker.protocolo.toUpperCase()}</span>
          </div>
          <div class="info-item">
            <span class="label">Usuario:</span>
            <span class="value">${escapeHtml(broker.usuario)}</span>
          </div>
          <div class="info-item">
            <span class="label">Topics:</span>
            <span class="value">${escapeHtml(broker.topic_rpm)} | ${escapeHtml(broker.topic_estado)}</span>
          </div>
          ${broker.descripcion ? `<div class="info-item"><span class="label">Descripción:</span><span class="value">${escapeHtml(broker.descripcion)}</span></div>` : ''}
        </div>
        ${!broker.activo ? `
          <div class="broker-footer">
            <button class="btn btn-primary" onclick="activateBroker(${broker.id})">Activar Broker</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading brokers:', err);
    document.getElementById('brokersList').innerHTML = '<div class="empty-state error">Error cargando brokers</div>';
  }
}

function initConfigurationEventListeners() {
  const btnNuevo = document.getElementById('btnNuevoBroker');
  const btnCancel = document.getElementById('modalBrokerCancel');
  const btnClose = document.getElementById('modalBrokerClose');

  if (btnNuevo) btnNuevo.onclick = () => openBrokerForm();
  // Nota: btnSave usa onclick en el HTML (validateAndSaveBroker)
  if (btnCancel) btnCancel.onclick = closeBrokerForm;
  if (btnClose) btnClose.onclick = closeBrokerForm;
}

function openBrokerForm(brokerId = null) {
  const overlay = document.getElementById('brokerOverlay');
  const title = document.getElementById('brokerFormTitle');
  const form = document.getElementById('modalBrokerForm');

  // Clear previous errors
  showBrokerFormErrors([]);

  if (brokerId) {
    title.textContent = 'Editar Broker MQTT';
    // Load broker data and populate form
    fetch(`${API}/api/config/brokers`)
      .then(r => r.json())
      .then(brokers => {
        const broker = brokers.find(b => b.id === brokerId);
        if (broker) {
          document.getElementById('brokerNombre').value = broker.nombre || '';
          document.getElementById('brokerServidor').value = broker.servidor || '';
          document.getElementById('brokerPuerto').value = broker.puerto || 8883;
          document.getElementById('brokerProtocolo').value = broker.protocolo || 'mqtts';
          document.getElementById('brokerUsuario').value = broker.usuario || '';
          document.getElementById('brokerContraseña').value = ''; // Never pre-fill password
          document.getElementById('brokerTopicRpm').value = broker.topic_rpm || 'rpm/datos';
          document.getElementById('brokerTopicEstado').value = broker.topic_estado || 'rpm/estado';
          document.getElementById('brokerDescripcion').value = broker.descripcion || '';
          document.getElementById('brokerVerificarCert').checked = broker.verificar_cert !== false;
          form.dataset.brokerId = brokerId;
        }
        overlay.classList.add('active');
      });
  } else {
    title.textContent = 'Agregar Nuevo Broker MQTT';
    
    // Auto-fill form with active broker's details if they exist in DB, for convenience
    fetch(`${API}/api/config/broker`)
      .then(r => r.ok ? r.json() : null)
      .then(activeBroker => {
        document.getElementById('brokerNombre').value = ''; // Let users name it
        document.getElementById('brokerServidor').value = activeBroker?.servidor || '';
        document.getElementById('brokerPuerto').value = activeBroker?.puerto || 8883;
        document.getElementById('brokerProtocolo').value = activeBroker?.protocolo || 'mqtts';
        document.getElementById('brokerUsuario').value = activeBroker?.usuario || '';
        document.getElementById('brokerContraseña').value = ''; // Never auto-fill passwords
        document.getElementById('brokerTopicRpm').value = activeBroker?.topic_rpm || 'rpm/datos';
        document.getElementById('brokerTopicEstado').value = activeBroker?.topic_estado || 'rpm/estado';
        document.getElementById('brokerDescripcion').value = ''; // Clean description for new
        document.getElementById('brokerVerificarCert').checked = activeBroker?.verificar_cert !== false;
        
        delete form.dataset.brokerId;
        overlay.classList.add('active');
      })
      .catch(() => {
        // Fallback to blank if fetching failed
        document.getElementById('brokerNombre').value = '';
        document.getElementById('brokerServidor').value = '';
        document.getElementById('brokerPuerto').value = 8883;
        document.getElementById('brokerProtocolo').value = 'mqtts';
        document.getElementById('brokerUsuario').value = '';
        document.getElementById('brokerContraseña').value = '';
        document.getElementById('brokerTopicRpm').value = 'rpm/datos';
        document.getElementById('brokerTopicEstado').value = 'rpm/estado';
        document.getElementById('brokerDescripcion').value = '';
        document.getElementById('brokerVerificarCert').checked = true;
        
        delete form.dataset.brokerId;
        overlay.classList.add('active');
      });
  }
}

function closeBrokerForm() {
  const overlay = document.getElementById('brokerOverlay');
  if (overlay) overlay.classList.remove('active');
  // Clear form fields and errors when closing
  document.getElementById('brokerNombre').value = '';
  document.getElementById('brokerServidor').value = '';
  document.getElementById('brokerPuerto').value = 8883;
  document.getElementById('brokerProtocolo').value = 'mqtts';
  document.getElementById('brokerUsuario').value = '';
  document.getElementById('brokerContraseña').value = '';
  document.getElementById('brokerTopicRpm').value = 'rpm/datos';
  document.getElementById('brokerTopicEstado').value = 'rpm/estado';
  document.getElementById('brokerDescripcion').value = '';
  document.getElementById('brokerVerificarCert').checked = true;
  delete document.getElementById('modalBrokerForm').dataset.brokerId;
  showBrokerFormErrors([]);
}

// Validación mejorada del formulario de broker
function validateBrokerForm() {
  const errors = [];
  
  const nombre = document.getElementById('brokerNombre').value.trim();
  const servidor = document.getElementById('brokerServidor').value.trim();
  const puerto = parseInt(document.getElementById('brokerPuerto').value);
  const usuario = document.getElementById('brokerUsuario').value.trim();
  const contraseña = document.getElementById('brokerContraseña').value;
  const topic_rpm = document.getElementById('brokerTopicRpm').value.trim();
  const topic_estado = document.getElementById('brokerTopicEstado').value.trim();

  // Validaciones
  if (!nombre) errors.push('El nombre del broker es requerido');
  if (!servidor) errors.push('El servidor es requerido');
  if (!usuario) errors.push('El usuario es requerido');
  // Only require password for new brokers or if it's explicitly changed for existing ones
  const isUpdate = document.getElementById('modalBrokerForm').dataset.brokerId !== undefined;
  if (!isUpdate && !contraseña) errors.push('La contraseña es requerida para nuevos brokers');
  
  if (isNaN(puerto) || puerto < 1 || puerto > 65535) errors.push('Puerto inválido (debe estar entre 1 y 65535)');
  if (servidor.includes(' ')) errors.push('El servidor no puede contener espacios');
  if (usuario.includes(' ')) errors.push('El usuario no puede contener espacios');
  if (nombre.length > 100) errors.push('El nombre es demasiado largo (máximo 100 caracteres)');
  if (topic_rpm && topic_rpm.includes(' ')) errors.push('El topic RPM no puede contener espacios');
  if (topic_estado && topic_estado.includes(' ')) errors.push('El topic Estado no puede contener espacios');

  return errors;
}

// Mostrar errores de validación
function showBrokerFormErrors(errors) {
  const errorContainer = document.getElementById('brokerFormErrors');
  if (!errorContainer) return;
  
  if (errors.length === 0) {
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    return;
  }
  
  errorContainer.innerHTML = `
    <div class="error-list">
      <strong>⚠️ Errores en el formulario:</strong>
      <ul>
        ${errors.map(err => `<li>${err}</li>`).join('')}
      </ul>
    </div>
  `;
  errorContainer.style.display = 'block';
}

// Validar y guardar broker (nueva función mejorada)
async function validateAndSaveBroker() {
  const errors = validateBrokerForm();
  
  if (errors.length > 0) {
    showBrokerFormErrors(errors);
    return;
  }
  
  showBrokerFormErrors([]); // Limpiar errores
  
  // Proceder con saveBroker
  const saveBtn = document.getElementById('modalBrokerSave');
  const saveText = document.getElementById('brokerSaveText');
  const originalText = saveText.textContent;
  
  try {
    saveBtn.disabled = true;
    saveText.textContent = 'Guardando...';
    await saveBroker();
  } finally {
    saveBtn.disabled = false;
    saveText.textContent = originalText;
  }
}

async function saveBroker() {
  const nombre = document.getElementById('brokerNombre').value.trim();
  const servidor = document.getElementById('brokerServidor').value.trim();
  const puerto = parseInt(document.getElementById('brokerPuerto').value);
  const usuario = document.getElementById('brokerUsuario').value.trim();
  const contraseña = document.getElementById('brokerContraseña').value;
  const protocolo = document.getElementById('brokerProtocolo').value;
  const topic_rpm = document.getElementById('brokerTopicRpm').value.trim();
  const topic_estado = document.getElementById('brokerTopicEstado').value.trim();
  const descripcion = document.getElementById('brokerDescripcion').value.trim();
  const verificar_cert = document.getElementById('brokerVerificarCert').checked;

  try {
    const brokerData = {
      nombre,
      servidor,
      puerto,
      usuario,
      protocolo,
      topic_rpm,
      topic_estado,
      descripcion,
      verificar_cert
    };

    // Solo incluir contraseña si se cambió (no está vacía)
    if (contraseña && contraseña.length > 0) {
      brokerData.contrasena = contraseña;
    }

    const brokerIdAttr = document.getElementById('modalBrokerForm').dataset.brokerId;
    const isUpdate = brokerIdAttr !== undefined;
    const url = isUpdate 
      ? `${API}/api/config/broker/${brokerIdAttr}`
      : `${API}/api/config/broker`;
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brokerData)
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error || 'Error guardando broker';
      showBrokerFormErrors([errorMsg]);
      return;
    }

    showAlert('success', '¡Éxito!', 'La configuración del Broker ha sido guardada satisfactoriamente.');
    closeBrokerForm();
    addLog('success', `Broker ${isUpdate ? 'actualizado' : 'agregado'} correctamente ✓`);
    // Actualizar estado del indicador MQTT después de cambiar broker
    setTimeout(updateMQTTIndicator, 1000);
    loadConfiguracion();
  } catch (err) {
    showBrokerFormErrors([`Error: ${err.message}`]);
  }
}

window.editBroker = (id) => openBrokerForm(id);

window.activateBroker = async (id) => {
  try {
    const res = await fetch(`${API}/api/config/broker/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: true })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert('error', 'Error Activando Broker', data.error || 'Error desconocido');
      return;
    }

    addLog('success', 'Broker activado y reconectado');
    showAlert('success', 'Broker Activado', 'El broker se ha activado y reconectado.');
    loadConfiguracion();
  } catch (err) {
    showAlert('error', 'Error de Conexión', err.message);
  }
};

window.deleteBroker = async (id, nombre) => {
  if (!confirm(`¿Está seguro de eliminar el broker "${nombre}"?`)) return;

  try {
    const res = await fetch(`${API}/api/config/broker/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showAlert('error', 'Error Eliminando Broker', data.error || 'Error desconocido');
      return;
    }

    addLog('success', 'Broker eliminado');
    showAlert('success', 'Broker Eliminado', 'El broker se eliminó correctamente.');
    loadConfiguracion();
  } catch (err) {
    showAlert('error', 'Error de Conexión', err.message);
  }
};
