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
  loadDispositivos();

  // Refresh data periodically
  setInterval(() => {
    if (state.currentPage === 'procesos') loadProcesos();
    if (state.currentPage === 'dispositivos') loadDispositivos();
  }, 10000);
});

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
    dispositivos: ['Dispositivos', 'Sensores IoT registrados']
  };

  document.getElementById('pageTitle').textContent = titles[page][0];
  document.getElementById('pageSubtitle').textContent = titles[page][1];

  // Refresh data on page switch
  if (page === 'procesos') loadProcesos();
  if (page === 'dispositivos') loadDispositivos();
  if (page === 'historico') loadProcesoSelect();
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
function updateRPMDisplay(data) {
  const rpm = data.rpm || 0;
  const pulsos = data.pulsos || 0;

  // Update stat cards
  document.getElementById('statRpm').textContent = rpm.toFixed(1);
  document.getElementById('statPulsos').textContent = pulsos;
  document.getElementById('liveRpmValue').textContent = rpm.toFixed(0);

  // Update uptime
  if (data.up) {
    document.getElementById('statUptime').textContent = formatUptime(data.up);
  }

  // Update proceso info
  if (data.procesoId) {
    document.getElementById('statProceso').textContent = `#${data.procesoId}`;
  }

  // Update gauge
  drawGauge(rpm);

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
}

// ============================================================
//  RPM GAUGE (Canvas)
// ============================================================
let gaugeCtx;
const GAUGE_MAX = 6000;

function initGauge() {
  const canvas = document.getElementById('gaugeCanvas');
  gaugeCtx = canvas.getContext('2d');
  drawGauge(0);
}

function drawGauge(rpm) {
  const canvas = gaugeCtx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h - 20;
  const r = Math.min(w, h) - 40;

  gaugeCtx.clearRect(0, 0, w, h);

  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const valueAngle = startAngle + (Math.min(rpm, GAUGE_MAX) / GAUGE_MAX) * Math.PI;

  // Background arc
  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, startAngle, endAngle);
  gaugeCtx.lineWidth = 22;
  gaugeCtx.strokeStyle = 'rgba(255,255,255,0.05)';
  gaugeCtx.lineCap = 'round';
  gaugeCtx.stroke();

  // Value arc with gradient
  if (rpm > 0) {
    const gradient = gaugeCtx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#22d3ee');
    gradient.addColorStop(0.5, '#6366f1');
    gradient.addColorStop(1, '#ef4444');

    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, r, startAngle, valueAngle);
    gaugeCtx.lineWidth = 22;
    gaugeCtx.strokeStyle = gradient;
    gaugeCtx.lineCap = 'round';
    gaugeCtx.stroke();

    // Glow effect
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, r, startAngle, valueAngle);
    gaugeCtx.lineWidth = 28;
    gaugeCtx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    gaugeCtx.stroke();
  }

  // Tick marks
  for (let i = 0; i <= 6; i++) {
    const angle = startAngle + (i / 6) * Math.PI;
    const x1 = cx + (r + 16) * Math.cos(angle);
    const y1 = cy + (r + 16) * Math.sin(angle);
    const x2 = cx + (r + 8) * Math.cos(angle);
    const y2 = cy + (r + 8) * Math.sin(angle);

    gaugeCtx.beginPath();
    gaugeCtx.moveTo(x1, y1);
    gaugeCtx.lineTo(x2, y2);
    gaugeCtx.lineWidth = 2;
    gaugeCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    gaugeCtx.stroke();

    // Labels
    const lx = cx + (r + 30) * Math.cos(angle);
    const ly = cy + (r + 30) * Math.sin(angle);
    gaugeCtx.fillStyle = 'rgba(255,255,255,0.3)';
    gaugeCtx.font = '11px "JetBrains Mono", monospace';
    gaugeCtx.textAlign = 'center';
    gaugeCtx.fillText(`${i * 1000}`, lx, ly);
  }

  // Update text
  document.getElementById('gaugeValue').textContent = rpm.toFixed(0);
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
    alert('El nombre del proceso es obligatorio');
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
      alert(data.error || 'Error creando proceso');
      return;
    }

    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('procNombre').value = '';
    document.getElementById('procDescripcion').value = '';

    addLog('success', `Proceso "${nombre}" creado exitosamente`);
    loadProcesos();
  } catch (err) {
    alert('Error de conexión: ' + err.message);
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
    if (!res.ok) { alert(data.error); return; }
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
  document.getElementById('btnLoadHist').addEventListener('click', () => {
    const id = document.getElementById('histProcessSelect').value;
    if (!id) { alert('Seleccione un proceso'); return; }
    loadHistorico(id);
  });
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

    // Load chart data
    const chartRes = await fetch(`${API}/api/lecturas/${procesoId}/chart?interval=${interval}`);
    const chartData = await chartRes.json();

    renderHistChart(chartData);
    renderHistBarChart(chartData);
    renderHistDoughnutChart(chartData);
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
//  DISPOSITIVOS
// ============================================================
async function loadDispositivos() {
  try {
    const res = await fetch(`${API}/api/dispositivos`);
    const devices = await res.json();

    const grid = document.getElementById('devicesGrid');

    if (devices.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted);grid-column:1/-1;">
          No hay dispositivos registrados aún.<br>
          Se registrarán automáticamente cuando el sensor ESP32 se conecte.
        </div>`;
      return;
    }

    grid.innerHTML = devices.map(d => {
      const isOnline = d.ultimo_contacto &&
        (new Date() - new Date(d.ultimo_contacto)) < 120000;

      return `
        <div class="device-card">
          <div class="device-header">
            <div class="device-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <rect x="9" y="9" width="6" height="6"/>
              </svg>
            </div>
            <div>
              <div class="device-name">${escapeHtml(d.nombre)}</div>
              <div class="device-id">${escapeHtml(d.client_id)}</div>
            </div>
            <span class="badge ${isOnline ? 'badge-activo' : 'badge-finalizado'}" style="margin-left:auto;">
              <span class="badge-dot"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div class="device-meta">
            <div class="device-meta-item">
              <span class="device-meta-label">IP</span>
              <span class="device-meta-value">${d.ip || '—'}</span>
            </div>
            <div class="device-meta-item">
              <span class="device-meta-label">RSSI</span>
              <span class="device-meta-value">${d.rssi || '—'} dBm</span>
            </div>
            <div class="device-meta-item">
              <span class="device-meta-label">Uptime</span>
              <span class="device-meta-value">${formatUptime(d.ultimo_up || 0)}</span>
            </div>
            <div class="device-meta-item">
              <span class="device-meta-label">Procesos</span>
              <span class="device-meta-value">${d.total_procesos || 0}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Error loading devices:', err);
  }
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
