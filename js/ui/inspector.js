/**
 * NetSim Interactive Inspector & Control Panel
 * Handles Node Inspector, Link Inspector, Dynamic Sliders, Chaos Injections, and Traffic Generation.
 */

import { TOPOLOGY_PRESETS } from '../engine/presets.js';

export class InspectorPanel {
  constructor(containerElement, simulator, canvasRenderer) {
    this.container = containerElement;
    this.sim = simulator;
    this.canvasRenderer = canvasRenderer;
    this.activeTab = 'traffic'; // 'node' | 'link' | 'traffic'

    this.selectedNode = null;
    this.selectedLink = null;

    this.render();
  }

  setSelectedNode(node) {
    this.selectedNode = node;
    this.selectedLink = null;
    if (node) {
      this.activeTab = 'node';
    }
    this.render();
  }

  setSelectedLink(link) {
    this.selectedLink = link;
    this.selectedNode = null;
    if (link) {
      this.activeTab = 'link';
    }
    this.render();
  }

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-[#0a101d] text-slate-200">
        <!-- Tabs Header -->
        <div class="flex border-b border-[#1e293b] bg-[#0c1424] text-xs font-medium">
          <button class="flex-1 py-2.5 px-3 border-b-2 text-center transition ${this.activeTab === 'traffic' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-white'}" data-tab="traffic">
            Traffic & Chaos
          </button>
          <button class="flex-1 py-2.5 px-3 border-b-2 text-center transition ${this.activeTab === 'node' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-white'}" data-tab="node">
            Node Inspector ${this.selectedNode ? `(${this.selectedNode.name})` : ''}
          </button>
          <button class="flex-1 py-2.5 px-3 border-b-2 text-center transition ${this.activeTab === 'link' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-white'}" data-tab="link">
            Link Config ${this.selectedLink ? `(${this.selectedLink.id})` : ''}
          </button>
        </div>

        <!-- Tab Body -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.attachEvents();
  }

  renderTabContent() {
    if (this.activeTab === 'traffic') {
      return this.renderTrafficTab();
    } else if (this.activeTab === 'node') {
      return this.renderNodeTab();
    } else if (this.activeTab === 'link') {
      return this.renderLinkTab();
    }
    return '';
  }

  renderTrafficTab() {
    const nodes = Array.from(this.sim.nodes.values());

    return `
      <!-- Presets & Topology -->
      <div class="glass-panel p-3.5 space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            Topology Presets
          </span>
        </div>
        <select id="preset-selector" class="w-full bg-[#0f172a] border border-slate-700 text-slate-200 text-xs rounded p-2 outline-none focus:border-cyan-500">
          ${Object.entries(TOPOLOGY_PRESETS).map(([key, p]) => `
            <option value="${key}">${p.name}</option>
          `).join('')}
        </select>
        <p class="text-[11px] text-slate-400 leading-relaxed" id="preset-description">
          Select a preset network to explore routing topologies, bottleneck links, and datacenter spine-leaf fabrics.
        </p>
      </div>

      <!-- Routing Algorithm Comparison -->
      <div class="glass-panel p-3.5 space-y-3">
        <span class="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          Routing Engine & Strategy
        </span>
        <select id="routing-algo-select" class="w-full bg-[#0f172a] border border-slate-700 text-slate-200 text-xs rounded p-2 outline-none focus:border-cyan-500">
          <option value="dijkstra" ${this.sim.routingAlgorithm === 'dijkstra' ? 'selected' : ''}>Dijkstra SPF (OSPF Latency Metric)</option>
          <option value="distance_vector" ${this.sim.routingAlgorithm === 'distance_vector' ? 'selected' : ''}>Distance-Vector (RIP / Split-Horizon)</option>
          <option value="ecmp" ${this.sim.routingAlgorithm === 'ecmp' ? 'selected' : ''}>Equal-Cost Multi-Path (ECMP Load Balancing)</option>
          <option value="congestion_aware" ${this.sim.routingAlgorithm === 'congestion_aware' ? 'selected' : ''}>Dynamic Congestion-Aware Routing</option>
        </select>
        <div class="text-[11px] text-slate-400 bg-[#0f172a]/60 p-2.5 rounded border border-slate-800 space-y-1">
          <div class="text-cyan-400 font-medium">Strategy Information:</div>
          <div id="routing-algo-info">
            ${this.getRoutingAlgoInfo(this.sim.routingAlgorithm)}
          </div>
        </div>
      </div>

      <!-- Traffic Blaster / Generator -->
      <div class="glass-panel p-3.5 space-y-3">
        <span class="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          Traffic Generator & Protocol Blaster
        </span>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-slate-400 font-mono">Source Node</label>
            <select id="traffic-src-select" class="w-full mt-1 bg-[#0f172a] border border-slate-700 text-slate-200 text-xs rounded p-1.5">
              ${nodes.map(n => `<option value="${n.id}">${n.name} (${n.ip})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-[10px] text-slate-400 font-mono">Destination Node</label>
            <select id="traffic-dst-select" class="w-full mt-1 bg-[#0f172a] border border-slate-700 text-slate-200 text-xs rounded p-1.5">
              ${nodes.map((n, i) => `<option value="${n.id}" ${i === nodes.length - 1 ? 'selected' : ''}>${n.name} (${n.ip})</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label class="text-[10px] text-slate-400 font-mono">Protocol & Flow Type</label>
          <select id="traffic-type-select" class="w-full mt-1 bg-[#0f172a] border border-slate-700 text-slate-200 text-xs rounded p-1.5">
            <option value="TCP_CONTINUOUS">TCP Continuous Stream (Sawtooth Congestion Control)</option>
            <option value="TCP_FILE">TCP File Download (500 KB Transfer)</option>
            <option value="UDP_BLAST">UDP Blast Stream (Continuous 20 pps)</option>
            <option value="ICMP_PING">ICMP Echo Request (Single Ping)</option>
          </select>
        </div>

        <button id="btn-inject-traffic" class="btn btn-primary w-full py-2 font-semibold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          Inject Traffic Flow
        </button>
      </div>

      <!-- Chaos Engineering Quick Injections -->
      <div class="glass-panel p-3.5 space-y-2.5">
        <span class="font-semibold text-rose-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          Chaos Engineering Quick Actions
        </span>
        <p class="text-[11px] text-slate-400">
          Inject disruptions into live network traffic to visualize immediate Dijkstra rerouting and TCP recovery:
        </p>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-chaos-random-kill" class="btn btn-danger py-1.5 text-[11px]">
            ⚡ Kill Random Router
          </button>
          <button id="btn-chaos-cut-link" class="btn btn-danger py-1.5 text-[11px]">
            ✂ Sever Core Cable
          </button>
          <button id="btn-chaos-degrade-link" class="btn btn-secondary py-1.5 text-[11px] text-amber-300">
            ⚠ Degrade (15% Loss)
          </button>
          <button id="btn-chaos-revive-all" class="btn btn-success py-1.5 text-[11px]">
            ✔ Revive All Nodes
          </button>
        </div>
      </div>
    `;
  }

  renderNodeTab() {
    if (!this.selectedNode) {
      return `
        <div class="text-center py-12 text-slate-400 space-y-2">
          <svg class="mx-auto text-slate-600" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <p>No node selected.</p>
          <p class="text-[11px] text-slate-500">Click any computer, router, or server on the canvas to inspect its IP routing table, status, and traffic stats.</p>
        </div>
      `;
    }

    const n = this.selectedNode;
    const isOnline = n.status !== 'failed';

    return `
      <!-- Node Overview -->
      <div class="glass-panel p-3.5 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-bold text-base text-white flex items-center gap-2">
              ${n.name}
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${isOnline ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' : 'bg-red-950/60 text-red-400 border border-red-800'}">
                ${n.status.toUpperCase()}
              </span>
            </div>
            <div class="text-xs font-mono text-cyan-400 mt-0.5">${n.ip} · Type: ${n.type.toUpperCase()}</div>
          </div>
        </div>

        <!-- Chaos Button -->
        <button id="btn-toggle-node-status" class="w-full btn ${isOnline ? 'btn-danger' : 'btn-success'} py-2 font-medium">
          ${isOnline ? '💥 Kill Node (Simulate Failure)' : '✨ Revive Node (Restore Online)'}
        </button>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
          <div class="bg-[#0f172a] p-2 rounded border border-slate-800">
            <div class="text-slate-400">Packets Sent:</div>
            <div class="text-slate-100 font-semibold text-sm">${n.stats.packetsSent}</div>
          </div>
          <div class="bg-[#0f172a] p-2 rounded border border-slate-800">
            <div class="text-slate-400">Packets Recv:</div>
            <div class="text-slate-100 font-semibold text-sm">${n.stats.packetsReceived}</div>
          </div>
          <div class="bg-[#0f172a] p-2 rounded border border-slate-800">
            <div class="text-slate-400">Packets Dropped:</div>
            <div class="text-red-400 font-semibold text-sm">${n.stats.packetsDropped}</div>
          </div>
          <div class="bg-[#0f172a] p-2 rounded border border-slate-800">
            <div class="text-slate-400">Bytes Moved:</div>
            <div class="text-cyan-400 font-semibold text-sm">${(n.stats.bytesTransferred / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      </div>

      <!-- Routing Table -->
      <div class="glass-panel p-3.5 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            Routing Table (${n.routingTable ? n.routingTable.length : 0} Routes)
          </span>
        </div>

        ${(!n.routingTable || n.routingTable.length === 0) ? `
          <div class="text-slate-500 py-3 text-center">Node is isolated or offline (no active routes).</div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left font-mono text-[10px]">
              <thead>
                <tr class="text-slate-400 border-b border-slate-800">
                  <th class="py-1">Destination</th>
                  <th class="py-1">Next Hop</th>
                  <th class="py-1">Metric</th>
                  <th class="py-1">Hops</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40">
                ${n.routingTable.map(r => {
                  const destNode = this.sim.getNode(r.destinationId);
                  const nextNode = this.sim.getNode(r.nextHopId);
                  return `
                    <tr class="hover:bg-slate-800/30">
                      <td class="py-1 text-slate-200">${destNode?.name || r.destinationId}</td>
                      <td class="py-1 text-cyan-400 font-semibold">${nextNode?.name || r.nextHopId}</td>
                      <td class="py-1 text-amber-400">${r.cost}</td>
                      <td class="py-1 text-slate-400">${r.hops}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  renderLinkTab() {
    if (!this.selectedLink) {
      return `
        <div class="text-center py-12 text-slate-400 space-y-2">
          <svg class="mx-auto text-slate-600" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"></line><circle cx="5" cy="12" r="3"></circle><circle cx="19" cy="12" r="3"></circle></svg>
          <p>No link selected.</p>
          <p class="text-[11px] text-slate-500">Click any transmission cable on the canvas to configure bandwidth, latency, loss rate, and buffer queue capacity in real time.</p>
        </div>
      `;
    }

    const l = this.selectedLink;
    const isUp = l.status !== 'down';
    const srcNode = this.sim.getNode(l.sourceId);
    const dstNode = this.sim.getNode(l.targetId);

    return `
      <!-- Link Overview -->
      <div class="glass-panel p-3.5 space-y-3">
        <div>
          <div class="font-bold text-base text-white flex items-center justify-between">
            <span>${srcNode?.name || l.sourceId} ↔ ${dstNode?.name || l.targetId}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${isUp ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' : 'bg-red-950/60 text-red-400 border border-red-800'}">
              ${l.status.toUpperCase()}
            </span>
          </div>
          <div class="text-xs font-mono text-slate-400 mt-0.5">Link ID: ${l.id}</div>
        </div>

        <button id="btn-toggle-link-status" class="w-full btn ${isUp ? 'btn-danger' : 'btn-success'} py-2 font-medium">
          ${isUp ? '✂ Cut Cable (Sever Connection)' : '🔧 Repair Cable (Bring Link Up)'}
        </button>
      </div>

      <!-- Real-time Interactive Sliders -->
      <div class="glass-panel p-3.5 space-y-4">
        <span class="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
          Physical Link Parameters
        </span>

        <!-- Bandwidth Slider -->
        <div class="space-y-1.5">
          <div class="flex justify-between font-mono text-[11px]">
            <span class="text-slate-400">Bandwidth:</span>
            <span class="text-cyan-400 font-semibold" id="val-bw">${l.bandwidthMbps} Mbps</span>
          </div>
          <input type="range" id="slider-bw" min="1" max="200" step="1" value="${l.bandwidthMbps}" class="w-full">
        </div>

        <!-- Latency Slider -->
        <div class="space-y-1.5">
          <div class="flex justify-between font-mono text-[11px]">
            <span class="text-slate-400">Physical Latency:</span>
            <span class="text-amber-400 font-semibold" id="val-lat">${l.latencyMs} ms</span>
          </div>
          <input type="range" id="slider-lat" min="1" max="250" step="1" value="${l.latencyMs}" class="w-full">
        </div>

        <!-- Packet Loss Slider -->
        <div class="space-y-1.5">
          <div class="flex justify-between font-mono text-[11px]">
            <span class="text-slate-400">Packet Loss Rate:</span>
            <span class="text-red-400 font-semibold" id="val-loss">${Math.round(l.lossRate * 100)}%</span>
          </div>
          <input type="range" id="slider-loss" min="0" max="40" step="1" value="${Math.round(l.lossRate * 100)}" class="w-full">
        </div>

        <!-- Buffer Queue Capacity Slider -->
        <div class="space-y-1.5">
          <div class="flex justify-between font-mono text-[11px]">
            <span class="text-slate-400">Buffer Queue Capacity:</span>
            <span class="text-emerald-400 font-semibold" id="val-queue">${l.queueCapacity} pkts</span>
          </div>
          <input type="range" id="slider-queue" min="5" max="50" step="1" value="${l.queueCapacity}" class="w-full">
        </div>

        <!-- Buffer Occupancy Gauge -->
        <div class="bg-[#0f172a] p-2.5 rounded border border-slate-800 font-mono text-[11px] space-y-1">
          <div class="flex justify-between text-slate-400">
            <span>Buffer Occupancy:</span>
            <span class="${l.queue.length >= l.queueCapacity * 0.8 ? 'text-red-400 font-bold' : 'text-slate-200'}">${l.queue.length} / ${l.queueCapacity} pkts</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-cyan-500 h-full transition-all" style="width: ${Math.min(100, (l.queue.length / l.queueCapacity) * 100)}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  getRoutingAlgoInfo(algo) {
    if (algo === 'dijkstra') {
      return 'Dijkstra SPF calculates shortest paths across the network using physical link latency as the edge weight metric (like standard OSPF). Fast and loop-free.';
    } else if (algo === 'distance_vector') {
      return 'Bellman-Ford Distance Vector (RIP) protocol exchanging periodic route vectors between neighbors with Split Horizon & Poison Reverse to prevent routing loops.';
    } else if (algo === 'ecmp') {
      return 'Equal-Cost Multi-Path (ECMP) balances traffic across multiple paths of identical metric (e.g. Spine-Leaf switches in modern datacenters).';
    } else if (algo === 'congestion_aware') {
      return 'Dynamic adaptive routing where link cost increases proportionally with buffer queue occupancy. Diverts packets away from saturated links!';
    }
    return '';
  }

  attachEvents() {
    // Tab switching
    this.container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setTab(e.currentTarget.getAttribute('data-tab'));
      });
    });

    // Preset selector
    const presetSelect = this.container.querySelector('#preset-selector');
    presetSelect?.addEventListener('change', (e) => {
      this.sim.loadPreset(e.target.value);
      this.canvasRenderer.resetView();
      this.canvasRenderer.selectedNodeId = null;
      this.canvasRenderer.selectedLinkId = null;
      this.selectedNode = null;
      this.selectedLink = null;
      this.render();
    });

    // Routing algorithm selector
    const algoSelect = this.container.querySelector('#routing-algo-select');
    algoSelect?.addEventListener('change', (e) => {
      this.sim.setRoutingAlgorithm(e.target.value);
      const infoEl = this.container.querySelector('#routing-algo-info');
      if (infoEl) infoEl.innerHTML = this.getRoutingAlgoInfo(e.target.value);
    });

    // Traffic generator inject button
    const btnInjectTraffic = this.container.querySelector('#btn-inject-traffic');
    btnInjectTraffic?.addEventListener('click', () => {
      const srcId = this.container.querySelector('#traffic-src-select')?.value;
      const dstId = this.container.querySelector('#traffic-dst-select')?.value;
      const trafficType = this.container.querySelector('#traffic-type-select')?.value;

      if (!srcId || !dstId || srcId === dstId) {
        alert('Please choose two different nodes for traffic flow.');
        return;
      }

      if (trafficType === 'TCP_CONTINUOUS') {
        this.sim.startFlow(srcId, dstId, 'TCP', { flowType: 'continuous' });
      } else if (trafficType === 'TCP_FILE') {
        this.sim.startFlow(srcId, dstId, 'TCP', { flowType: 'file_transfer', totalBytes: 250_000 });
      } else if (trafficType === 'UDP_BLAST') {
        this.sim.startFlow(srcId, dstId, 'UDP', { ratePps: 20 });
      } else if (trafficType === 'ICMP_PING') {
        this.sim.sendPing(srcId, dstId);
      }
    });

    // Chaos actions
    const btnChaosKill = this.container.querySelector('#btn-chaos-random-kill');
    btnChaosKill?.addEventListener('click', () => {
      const routers = Array.from(this.sim.nodes.values()).filter(n => n.type === 'router' && n.status !== 'failed');
      if (routers.length > 0) {
        const target = routers[Math.floor(Math.random() * routers.length)];
        this.sim.toggleNodeFailure(target.id);
        this.render();
      }
    });

    const btnChaosCut = this.container.querySelector('#btn-chaos-cut-link');
    btnChaosCut?.addEventListener('click', () => {
      const activeLinks = Array.from(this.sim.links.values()).filter(l => l.status !== 'down');
      if (activeLinks.length > 0) {
        const target = activeLinks[Math.floor(Math.random() * activeLinks.length)];
        this.sim.toggleLinkFailure(target.id);
        this.render();
      }
    });

    const btnChaosDegrade = this.container.querySelector('#btn-chaos-degrade-link');
    btnChaosDegrade?.addEventListener('click', () => {
      for (const [_, l] of this.sim.links) {
        l.lossRate = 0.15; // 15% loss
        l.latencyMs = Math.round(l.latencyMs * 2.5);
      }
      this.sim.logEvent('ROUTING', null, null, 'ROUTING_UPDATE', 'Chaos: Degraded all links (15% loss, 2.5x latency)', 'warn');
      this.render();
    });

    const btnChaosRevive = this.container.querySelector('#btn-chaos-revive-all');
    btnChaosRevive?.addEventListener('click', () => {
      for (const [_, n] of this.sim.nodes) n.status = 'online';
      for (const [_, l] of this.sim.links) {
        l.status = 'up';
        l.lossRate = 0.0;
      }
      this.sim.updateRoutingTables();
      this.sim.logEvent('ROUTING', null, null, 'ROUTING_UPDATE', 'Chaos: Revived all nodes and repaired all links!', 'success');
      this.render();
    });

    // Node tab actions
    const btnToggleNode = this.container.querySelector('#btn-toggle-node-status');
    btnToggleNode?.addEventListener('click', () => {
      if (this.selectedNode) {
        this.sim.toggleNodeFailure(this.selectedNode.id);
        this.render();
      }
    });

    // Link tab actions
    const btnToggleLink = this.container.querySelector('#btn-toggle-link-status');
    btnToggleLink?.addEventListener('click', () => {
      if (this.selectedLink) {
        this.sim.toggleLinkFailure(this.selectedLink.id);
        this.render();
      }
    });

    // Link dynamic sliders
    const sliderBw = this.container.querySelector('#slider-bw');
    sliderBw?.addEventListener('input', (e) => {
      if (this.selectedLink) {
        this.selectedLink.bandwidthMbps = parseInt(e.target.value, 10);
        const valEl = this.container.querySelector('#val-bw');
        if (valEl) valEl.textContent = `${this.selectedLink.bandwidthMbps} Mbps`;
      }
    });

    const sliderLat = this.container.querySelector('#slider-lat');
    sliderLat?.addEventListener('input', (e) => {
      if (this.selectedLink) {
        this.selectedLink.latencyMs = parseInt(e.target.value, 10);
        const valEl = this.container.querySelector('#val-lat');
        if (valEl) valEl.textContent = `${this.selectedLink.latencyMs} ms`;
        this.sim.updateRoutingTables();
      }
    });

    const sliderLoss = this.container.querySelector('#slider-loss');
    sliderLoss?.addEventListener('input', (e) => {
      if (this.selectedLink) {
        this.selectedLink.lossRate = parseInt(e.target.value, 10) / 100;
        const valEl = this.container.querySelector('#val-loss');
        if (valEl) valEl.textContent = `${Math.round(this.selectedLink.lossRate * 100)}%`;
      }
    });

    const sliderQueue = this.container.querySelector('#slider-queue');
    sliderQueue?.addEventListener('input', (e) => {
      if (this.selectedLink) {
        this.selectedLink.queueCapacity = parseInt(e.target.value, 10);
        const valEl = this.container.querySelector('#val-queue');
        if (valEl) valEl.textContent = `${this.selectedLink.queueCapacity} pkts`;
      }
    });
  }
}
