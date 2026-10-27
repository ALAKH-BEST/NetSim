/**
 * NetSim Canvas 2D Interactive Renderer
 * 60 FPS high-performance network visualizer with glowing links,
 * live packet particles, buffer queue meters, pan/zoom, and node dragging.
 */

import { PacketColors } from '../types.js';

export class CanvasRenderer {
  constructor(canvasElement, simulator) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.sim = simulator;

    // Viewport transform (Pan & Zoom)
    this.panX = 40;
    this.panY = 40;
    this.zoom = 1.0;
    this.minZoom = 0.4;
    this.maxZoom = 2.5;

    // Interaction state
    this.isDraggingCanvas = false;
    this.draggedNode = null;
    this.hoveredNode = null;
    this.hoveredLink = null;
    this.selectedNodeId = null;
    this.selectedLinkId = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Link creation state (Shift + drag between nodes)
    this.isConnecting = false;
    this.connectStartNode = null;
    this.connectMousePos = { x: 0, y: 0 };

    // Drop explosions / visual particle effects
    this.dropParticles = [];

    // Callbacks
    this.onSelectNode = null;
    this.onSelectLink = null;

    this.initEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    return {
      x: (x - this.panX) / this.zoom,
      y: (y - this.panY) / this.zoom
    };
  }

  findNodeAt(worldX, worldY) {
    const radius = 32;
    for (const [_, node] of this.sim.nodes) {
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }

  findLinkAt(worldX, worldY) {
    const threshold = 12;
    for (const [_, link] of this.sim.links) {
      const u = this.sim.getNode(link.sourceId);
      const v = this.sim.getNode(link.targetId);
      if (!u || !v) continue;

      const dist = this.pointToSegmentDistance(worldX, worldY, u.x, u.y, v.x, v.y);
      if (dist <= threshold) {
        return link;
      }
    }
    return null;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  handleMouseDown(e) {
    const { x: worldX, y: worldY } = this.screenToWorld(e.clientX, e.clientY);
    const clickedNode = this.findNodeAt(worldX, worldY);

    if (e.button === 0) {
      if (e.shiftKey && clickedNode) {
        // Start connection
        this.isConnecting = true;
        this.connectStartNode = clickedNode;
        this.connectMousePos = { x: worldX, y: worldY };
        return;
      }

      if (clickedNode) {
        this.draggedNode = clickedNode;
        this.selectedNodeId = clickedNode.id;
        this.selectedLinkId = null;
        if (this.onSelectNode) this.onSelectNode(clickedNode);
      } else {
        const clickedLink = this.findLinkAt(worldX, worldY);
        if (clickedLink) {
          this.selectedLinkId = clickedLink.id;
          this.selectedNodeId = null;
          if (this.onSelectLink) this.onSelectLink(clickedLink);
        } else {
          // Pan canvas
          this.isDraggingCanvas = true;
          this.selectedNodeId = null;
          this.selectedLinkId = null;
          if (this.onSelectNode) this.onSelectNode(null);
        }
      }
    }

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  handleMouseMove(e) {
    const { x: worldX, y: worldY } = this.screenToWorld(e.clientX, e.clientY);

    if (this.isConnecting) {
      this.connectMousePos = { x: worldX, y: worldY };
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (this.draggedNode) {
      this.draggedNode.x = Math.round(worldX);
      this.draggedNode.y = Math.round(worldY);
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (this.isDraggingCanvas) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = 'move';
      return;
    }

    // Hover detection
    this.hoveredNode = this.findNodeAt(worldX, worldY);
    this.hoveredLink = !this.hoveredNode ? this.findLinkAt(worldX, worldY) : null;

    if (this.hoveredNode) {
      this.canvas.style.cursor = 'pointer';
    } else if (this.hoveredLink) {
      this.canvas.style.cursor = 'pointer';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  handleMouseUp(e) {
    if (this.isConnecting && this.connectStartNode) {
      const { x: worldX, y: worldY } = this.screenToWorld(e.clientX, e.clientY);
      const targetNode = this.findNodeAt(worldX, worldY);

      if (targetNode && targetNode.id !== this.connectStartNode.id) {
        // Create link between connectStartNode and targetNode
        const linkId = `link_${this.connectStartNode.id}_${targetNode.id}_${Math.random().toString(36).substr(2, 4)}`;
        this.sim.addLink({
          id: linkId,
          sourceId: this.connectStartNode.id,
          targetId: targetNode.id,
          bandwidthMbps: 50,
          latencyMs: 15,
          lossRate: 0.0,
          queueCapacity: 20,
          queue: [],
          status: 'up',
          stats: { totalPackets: 0, droppedPackets: 0, currentUtilization: 0, totalBytes: 0 }
        });
        this.sim.logEvent('ROUTING', this.connectStartNode.id, targetNode.id, 'ROUTING_UPDATE', `Created new link between ${this.connectStartNode.name} and ${targetNode.name}`, 'success');
      }

      this.isConnecting = false;
      this.connectStartNode = null;
    }

    this.draggedNode = null;
    this.isDraggingCanvas = false;
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.12;
    const oldZoom = this.zoom;

    if (e.deltaY < 0) {
      this.zoom = Math.min(this.maxZoom, this.zoom * zoomFactor);
    } else {
      this.zoom = Math.max(this.minZoom, this.zoom / zoomFactor);
    }

    // Zoom centered around cursor
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom);
    this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
  }

  resetView() {
    this.panX = 40;
    this.panY = 40;
    this.zoom = 1.0;
  }

  triggerDropExplosion(x, y, color = '#ef4444') {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.dropParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color
      });
    }
  }

  /**
   * Main 60 FPS Render Loop
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw Links (Cables & Queues)
    this.drawLinks(ctx);

    // 2. Draw In-Flight Packets
    this.drawInFlightPackets(ctx);

    // 3. Draw Connecting Link Line (if dragging)
    this.drawConnectingLine(ctx);

    // 4. Draw Drop Explosion Particles
    this.drawParticles(ctx);

    // 5. Draw Nodes
    this.drawNodes(ctx);

    ctx.restore();
  }

  drawLinks(ctx) {
    for (const [_, link] of this.sim.links) {
      const u = this.sim.getNode(link.sourceId);
      const v = this.sim.getNode(link.targetId);
      if (!u || !v) continue;

      const isSelected = this.selectedLinkId === link.id;
      const isHovered = this.hoveredLink === link;
      const isDown = link.status === 'down';
      const isDegraded = link.lossRate > 0.05 || link.latencyMs > 80;

      ctx.save();

      // Cable line styling
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);

      if (isDown) {
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 3;
      } else if (isSelected) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 12;
      } else if (isHovered) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
      } else if (isDegraded) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
      } else {
        // Sleek cyber subtle glow
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
      }

      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Draw Midpoint Badge (Bandwidth & Latency)
      const midX = (u.x + v.x) / 2;
      const midY = (u.y + v.y) / 2;

      const badgeText = isDown ? 'LINK DOWN' : `${link.bandwidthMbps}M · ${link.latencyMs}ms`;
      ctx.font = '10px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(badgeText).width;

      ctx.fillStyle = isDown ? 'rgba(239, 68, 68, 0.9)' : (isDegraded ? 'rgba(245, 158, 11, 0.85)' : 'rgba(15, 23, 42, 0.85)');
      ctx.strokeStyle = isSelected ? '#06b6d4' : (isDown ? '#ef4444' : '#1e293b');
      ctx.lineWidth = 1;

      const padX = 6;
      const padY = 3;
      const bx = midX - textWidth / 2 - padX;
      const by = midY - 9;
      const bw = textWidth + padX * 2;
      const bh = 18;

      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDown ? '#ffffff' : (isDegraded ? '#ffffff' : '#94a3b8');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, midX, midY);

      // Draw Buffer Queue Indicators on the link!
      if (link.queue && link.queue.length > 0 && !isDown) {
        this.drawLinkQueue(ctx, u, v, link);
      }

      ctx.restore();
    }
  }

  /**
   * Draws tiny rectangular queue slots along the link showing packets buffered in the router!
   */
  drawLinkQueue(ctx, u, v, link) {
    const queueCount = link.queue.length;
    const capacity = link.queueCapacity || 20;

    // Place queue visualizer near 30% mark along edge from source
    const qBaseT = 0.28;
    const dx = v.x - u.x;
    const dy = v.y - u.y;
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);

    ctx.save();
    ctx.translate(u.x + dx * qBaseT, u.y + dy * qBaseT);
    ctx.rotate(angle);

    const slotW = 5;
    const slotH = 8;
    const gap = 2;
    const startX = -((queueCount * (slotW + gap)) / 2);

    for (let i = 0; i < queueCount; i++) {
      const pkt = link.queue[i];
      const color = PacketColors[pkt.type] || '#06b6d4';
      ctx.fillStyle = color;
      ctx.fillRect(startX + i * (slotW + gap), -slotH / 2, slotW, slotH);
    }

    // Queue count pill
    ctx.rotate(-angle);
    ctx.font = '9px monospace';
    ctx.fillStyle = queueCount > capacity * 0.75 ? '#ef4444' : '#e2e8f0';
    ctx.fillText(`Q: ${queueCount}/${capacity}`, 0, -12);

    ctx.restore();
  }

  drawInFlightPackets(ctx) {
    for (const packet of this.sim.inFlightPackets) {
      const link = this.sim.getLink(packet.currentLinkId);
      if (!link) continue;

      const u = this.sim.getNode(packet.direction === 'source_to_target' ? link.sourceId : link.targetId);
      const v = this.sim.getNode(packet.direction === 'source_to_target' ? link.targetId : link.sourceId);
      if (!u || !v) continue;

      const t = Math.max(0, Math.min(1, packet.progress));
      const px = u.x + (v.x - u.x) * t;
      const py = u.y + (v.y - u.y) * t;

      const color = PacketColors[packet.type] || '#06b6d4';

      ctx.save();

      // Outer glow aura
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();

      // Core particle
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tiny packet label
      if (packet.label && this.zoom >= 0.75) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(packet.label, px, py - 12);
      }

      ctx.restore();
    }
  }

  drawNodes(ctx) {
    for (const [_, node] of this.sim.nodes) {
      const isSelected = this.selectedNodeId === node.id;
      const isHovered = this.hoveredNode === node;
      const isFailed = node.status === 'failed';
      const radius = 26;

      ctx.save();
      ctx.translate(node.x, node.y);

      // 1. Selection & Hover Halo
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 15;
        ctx.stroke();
      } else if (isHovered) {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 2. Node Body
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = isFailed ? '#1a0d13' : '#0e1526';
      ctx.fill();

      ctx.strokeStyle = isFailed ? '#ef4444' : (isSelected ? '#06b6d4' : '#334155');
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // 3. Node Icon Graphic
      this.drawNodeIcon(ctx, node.type, isFailed);

      // 4. Status Indicator Dot
      ctx.beginPath();
      ctx.arc(radius * 0.7, -radius * 0.7, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isFailed ? '#ef4444' : '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#070b13';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 5. Node Name Label (above)
      ctx.font = '600 12px "Outfit", sans-serif';
      ctx.fillStyle = isFailed ? '#f87171' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(node.name, 0, -radius - 8);

      // 6. Node IP Label (below)
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = isFailed ? '#ef4444' : '#94a3b8';
      ctx.textBaseline = 'top';
      ctx.fillText(node.ip, 0, radius + 8);

      ctx.restore();
    }
  }

  drawNodeIcon(ctx, type, isFailed) {
    ctx.save();
    ctx.strokeStyle = isFailed ? '#ef4444' : '#38bdf8';
    ctx.fillStyle = isFailed ? '#ef4444' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'client') {
      // Laptop / Monitor screen
      ctx.strokeRect(-10, -9, 20, 13);
      ctx.beginPath();
      ctx.moveTo(-13, 7);
      ctx.lineTo(13, 7);
      ctx.stroke();
    } else if (type === 'router') {
      // Concentric arrows / 4-way router cross
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(0, 6);
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.stroke();
    } else if (type === 'server') {
      // Blade server layers
      ctx.strokeRect(-10, -9, 20, 5);
      ctx.strokeRect(-10, -2, 20, 5);
      ctx.strokeRect(-10, 5, 20, 5);
      // Status LEDs
      ctx.beginPath();
      ctx.arc(6, -6.5, 1, 0, Math.PI * 2);
      ctx.arc(6, 0.5, 1, 0, Math.PI * 2);
      ctx.arc(6, 7.5, 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Switch crossbars
      ctx.strokeRect(-9, -8, 18, 16);
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(6, -4);
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(-6, 4); ctx.lineTo(6, 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawConnectingLine(ctx) {
    if (!this.isConnecting || !this.connectStartNode) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.connectStartNode.x, this.connectStartNode.y);
    ctx.lineTo(this.connectMousePos.x, this.connectMousePos.y);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(ctx) {
    const remaining = [];
    for (const p of this.dropParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;

      if (p.life > 0) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        remaining.push(p);
      }
    }
    this.dropParticles = remaining;
  }
}
