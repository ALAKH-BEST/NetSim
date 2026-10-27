/**
 * NetSim Application Controller & Wireup
 */

import { NetworkSimulator } from './engine/simulator.js';
import { CanvasRenderer } from './ui/canvasRenderer.js';
import { TcpChart } from './ui/tcpChart.js';
import { PacketLogViewer } from './ui/packetLog.js';
import { InspectorPanel } from './ui/inspector.js';

class NetSimApp {
  constructor() {
    this.init();
  }

  init() {
    // 1. Initialize Core Engine
    this.sim = new NetworkSimulator();

    // 2. Initialize Canvas Renderer
    const topologyCanvas = document.getElementById('topology-canvas');
    this.canvasRenderer = new CanvasRenderer(topologyCanvas, this.sim);

    // 3. Initialize TCP Sawtooth Chart
    const tcpCanvas = document.getElementById('tcp-chart-canvas');
    this.tcpChart = new TcpChart(tcpCanvas, this.sim.tcpManager);

    // 4. Initialize Packet Log Sniffer
    const packetLogContainer = document.getElementById('packet-log-container');
    this.packetLog = new PacketLogViewer(packetLogContainer, this.sim);

    // 5. Initialize Inspector Panel
    const inspectorContainer = document.getElementById('inspector-panel-container');
    this.inspector = new InspectorPanel(inspectorContainer, this.sim, this.canvasRenderer);

    // Wire selection callbacks
    this.canvasRenderer.onSelectNode = (node) => {
      this.inspector.setSelectedNode(node);
    };

    this.canvasRenderer.onSelectLink = (link) => {
      this.inspector.setSelectedLink(link);
    };

    // 6. Bind Top Bar & Modal Controls
    this.bindControls();

    // 7. Start Simulation Loop
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    // Kick off an initial TCP stream so the network is immediately active & visually compelling!
    setTimeout(() => {
      this.sim.startFlow('c1', 'srv_web', 'TCP', { flowType: 'continuous' });
    }, 400);
  }

  bindControls() {
    // Play / Pause
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPause = document.getElementById('icon-pause');
    const iconPlay = document.getElementById('icon-play');
    const playPauseText = document.getElementById('play-pause-text');

    btnPlayPause?.addEventListener('click', () => {
      this.sim.isRunning = !this.sim.isRunning;
      if (this.sim.isRunning) {
        iconPause?.classList.remove('hidden');
        iconPlay?.classList.add('hidden');
        if (playPauseText) playPauseText.textContent = 'Pause';
      } else {
        iconPause?.classList.add('hidden');
        iconPlay?.classList.remove('hidden');
        if (playPauseText) playPauseText.textContent = 'Resume';
      }
    });

    // Step 1 tick
    const btnStep = document.getElementById('btn-step');
    btnStep?.addEventListener('click', () => {
      this.sim.tick(30);
      this.canvasRenderer.render();
      this.tcpChart.render();
      this.packetLog.update();
      this.updateHud();
    });

    // Speed selector
    const selectSpeed = document.getElementById('select-speed');
    selectSpeed?.addEventListener('change', (e) => {
      this.sim.speedMultiplier = parseFloat(e.target.value);
    });

    // Zoom controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.canvasRenderer.zoom = Math.min(this.canvasRenderer.maxZoom, this.canvasRenderer.zoom * 1.2);
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.canvasRenderer.zoom = Math.max(this.canvasRenderer.minZoom, this.canvasRenderer.zoom / 1.2);
    });
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.canvasRenderer.resetView();
    });

    // Flush / Clear traffic
    document.getElementById('btn-clear-traffic')?.addEventListener('click', () => {
      this.sim.inFlightPackets = [];
      for (const [_, l] of this.sim.links) l.queue = [];
      this.sim.activeFlows = [];
      this.sim.logEvent('ROUTING', null, null, 'ROUTING_UPDATE', 'Flushed all in-flight packets and transmission queues', 'info');
      this.inspector.render();
    });

    // Add Node Modal
    const modal = document.getElementById('modal-add-node');
    const btnOpenModal = document.getElementById('btn-add-node-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-add-node');
    const btnConfirmModal = document.getElementById('btn-confirm-add-node');

    btnOpenModal?.addEventListener('click', () => modal?.classList.remove('hidden'));
    btnCloseModal?.addEventListener('click', () => modal?.classList.add('hidden'));
    btnCancelModal?.addEventListener('click', () => modal?.classList.add('hidden'));

    btnConfirmModal?.addEventListener('click', () => {
      const name = document.getElementById('new-node-name')?.value || 'Router X';
      const type = document.getElementById('new-node-type')?.value || 'router';
      const ip = document.getElementById('new-node-ip')?.value || '10.0.99.1';
      const id = `node_${Date.now().toString(36)}`;

      this.sim.addNode({
        id,
        name,
        type,
        ip,
        x: Math.round(200 + Math.random() * 400),
        y: Math.round(150 + Math.random() * 200),
        status: 'online',
        stats: { packetsSent: 0, packetsReceived: 0, packetsDropped: 0, bytesTransferred: 0 },
        routingTable: []
      });

      this.sim.logEvent('ROUTING', id, null, 'ROUTING_UPDATE', `Added node "${name}" (${ip})`, 'success');
      modal?.classList.add('hidden');
      this.inspector.render();
    });
  }

  updateHud() {
    const s = this.sim.stats;
    const hudThroughput = document.getElementById('hud-throughput');
    const hudLatency = document.getElementById('hud-latency');
    const hudLoss = document.getElementById('hud-loss');
    const hudInflight = document.getElementById('hud-inflight');

    if (hudThroughput) hudThroughput.textContent = `${s.throughputMbps.toFixed(2)} Mbps`;
    if (hudLatency) hudLatency.textContent = `${s.avgLatencyMs} ms`;

    const totalPkts = s.totalDelivered + s.totalDropped;
    const lossPct = totalPkts > 0 ? ((s.totalDropped / totalPkts) * 100).toFixed(1) : '0.0';
    if (hudLoss) hudLoss.textContent = `${lossPct}%`;

    const inFlightCount = this.sim.inFlightPackets.length;
    let queueCount = 0;
    for (const [_, l] of this.sim.links) queueCount += l.queue.length;
    if (hudInflight) hudInflight.textContent = `${inFlightCount + queueCount} pkts`;
  }

  loop(currentTime) {
    const deltaMs = Math.min(currentTime - this.lastTime, 100);
    this.lastTime = currentTime;

    // Simulation Tick
    this.sim.tick(deltaMs);

    // Render Canvas Views
    this.canvasRenderer.render();
    this.tcpChart.render();

    // Update HUD & Packet Sniffer
    this.updateHud();
    this.packetLog.update();

    requestAnimationFrame(this.loop);
  }
}

// Start app on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new NetSimApp();
});
