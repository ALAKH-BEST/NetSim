/**
 * NetSim Wireshark-style Live Packet & Event Inspector
 */

export class PacketLogViewer {
  constructor(containerElement, simulator) {
    this.container = containerElement;
    this.sim = simulator;
    this.filterProtocol = 'ALL';
    this.searchQuery = '';
    this.autoScroll = true;

    this.render();
  }

  setFilter(protocol) {
    this.filterProtocol = protocol;
    this.update();
  }

  setSearchQuery(query) {
    this.searchQuery = query.toLowerCase();
    this.update();
  }

  clear() {
    this.sim.events = [];
    this.update();
  }

  exportJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.sim.events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `netsim_capture_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-[#0a101d] border-t border-[#1e293b]">
        <!-- Toolbar -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] text-xs">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-300 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              PACKET SNIFFER (WIRESHARK)
            </span>

            <div class="flex bg-[#0f172a] rounded p-0.5 border border-slate-800 ml-2">
              <button class="log-filter-btn px-2 py-0.5 rounded text-[11px] font-medium bg-[#1e293b] text-cyan-400" data-filter="ALL">All</button>
              <button class="log-filter-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white" data-filter="TCP">TCP</button>
              <button class="log-filter-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white" data-filter="UDP">UDP</button>
              <button class="log-filter-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white" data-filter="ICMP">ICMP</button>
              <button class="log-filter-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-400" data-filter="ERROR">Drops</button>
            </div>

            <input type="text" id="log-search-input" placeholder="Filter by IP, SEQ, reason..." 
              class="bg-[#0f172a] border border-slate-800 text-slate-200 text-[11px] rounded px-2 py-1 outline-none focus:border-cyan-500 w-48 ml-2">
          </div>

          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5 cursor-pointer text-slate-400 text-[11px]">
              <input type="checkbox" id="log-autoscroll-chk" checked class="accent-cyan-500 rounded">
              Auto-scroll
            </label>
            <button id="log-export-btn" class="text-slate-400 hover:text-cyan-400 transition" title="Export Wireshark JSON">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button id="log-clear-btn" class="text-slate-400 hover:text-red-400 transition" title="Clear Event Log">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <!-- Table Header -->
        <div class="grid grid-cols-12 px-3 py-1.5 bg-[#0b1220] border-b border-[#1e293b] text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          <div class="col-span-1">Time (s)</div>
          <div class="col-span-1">Protocol</div>
          <div class="col-span-2">Source</div>
          <div class="col-span-2">Destination</div>
          <div class="col-span-2">Packet Type</div>
          <div class="col-span-4">Payload Details / Event</div>
        </div>

        <!-- Table Body (Scrollable) -->
        <div id="log-table-body" class="flex-1 overflow-y-auto font-mono text-[11px] divide-y divide-slate-800/40">
        </div>
      </div>
    `;

    // Event listeners
    this.container.querySelectorAll('.log-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.container.querySelectorAll('.log-filter-btn').forEach(b => {
          b.className = 'log-filter-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white';
        });
        e.target.className = 'log-filter-btn px-2 py-0.5 rounded text-[11px] font-medium bg-[#1e293b] text-cyan-400';
        this.setFilter(e.target.getAttribute('data-filter'));
      });
    });

    const searchInput = this.container.querySelector('#log-search-input');
    searchInput?.addEventListener('input', (e) => this.setSearchQuery(e.target.value));

    const clearBtn = this.container.querySelector('#log-clear-btn');
    clearBtn?.addEventListener('click', () => this.clear());

    const exportBtn = this.container.querySelector('#log-export-btn');
    exportBtn?.addEventListener('click', () => this.exportJson());

    const autoScrollChk = this.container.querySelector('#log-autoscroll-chk');
    autoScrollChk?.addEventListener('change', (e) => {
      this.autoScroll = e.target.checked;
    });

    this.tableBody = this.container.querySelector('#log-table-body');
  }

  update() {
    if (!this.tableBody) return;

    let filtered = this.sim.events;

    if (this.filterProtocol === 'ERROR') {
      filtered = filtered.filter(e => e.severity === 'error');
    } else if (this.filterProtocol !== 'ALL') {
      filtered = filtered.filter(e => e.protocol === this.filterProtocol);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(this.searchQuery) ||
        e.sourceId.toLowerCase().includes(this.searchQuery) ||
        e.destId.toLowerCase().includes(this.searchQuery) ||
        e.type.toLowerCase().includes(this.searchQuery)
      );
    }

    // Render rows
    let html = '';
    const slice = filtered.slice(0, 100);

    for (const evt of slice) {
      const isError = evt.severity === 'error';
      const isWarn = evt.severity === 'warn';
      const isSuccess = evt.severity === 'success';

      const rowClass = isError ? 'bg-red-950/20 text-red-200 hover:bg-red-900/30' :
                       (isWarn ? 'bg-amber-950/15 text-amber-200 hover:bg-amber-900/20' :
                       'hover:bg-[#131d31] text-slate-300');

      const protocolBadge = {
        'TCP': 'badge-tcp',
        'UDP': 'badge-udp',
        'ICMP': 'badge-icmp',
        'ROUTING': 'badge-routing'
      }[evt.protocol] || 'bg-slate-800 text-slate-300';

      html += `
        <div class="grid grid-cols-12 px-3 py-1.5 items-center transition ${rowClass}">
          <div class="col-span-1 text-slate-500">${evt.time.toFixed(3)}</div>
          <div class="col-span-1">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${protocolBadge}">${evt.protocol}</span>
          </div>
          <div class="col-span-2 truncate text-slate-400 font-medium">${evt.sourceId}</div>
          <div class="col-span-2 truncate text-slate-400 font-medium">${evt.destId}</div>
          <div class="col-span-2 truncate ${isError ? 'text-red-400 font-semibold' : 'text-cyan-400'}">${evt.type}</div>
          <div class="col-span-4 truncate ${isError ? 'text-red-300' : 'text-slate-300'}">${evt.message}</div>
        </div>
      `;
    }

    this.tableBody.innerHTML = html;

    if (this.autoScroll && this.tableBody.scrollTop === 0) {
      // Body is ordered latest first
    }
  }
}
