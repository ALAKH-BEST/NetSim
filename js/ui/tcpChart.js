/**
 * NetSim Live TCP Telemetry Chart (Classic Sawtooth Plotter)
 * Visualizes cwnd (Congestion Window), ssthresh, in-flight segments, and phases in real time.
 */

export class TcpChart {
  constructor(canvasElement, tcpManager) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.tcpManager = tcpManager;
    this.selectedSessionId = null;

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

  setSession(sessionId) {
    this.selectedSessionId = sessionId;
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Pick active session
    let session = null;
    if (this.selectedSessionId) {
      session = this.tcpManager.getSession(this.selectedSessionId);
    }
    if (!session) {
      const all = this.tcpManager.getAllSessions();
      if (all.length > 0) {
        session = all[all.length - 1];
        this.selectedSessionId = session.id;
      }
    }

    if (!session || !session.history || session.history.length < 2) {
      // Empty state
      ctx.fillStyle = '#64748b';
      ctx.font = '12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for active TCP flow... Start a TCP stream to observe cwnd sawtooth', this.width / 2, this.height / 2);
      return;
    }

    const history = session.history;
    const padL = 36;
    const padR = 20;
    const padT = 28;
    const padB = 22;
    const chartW = this.width - padL - padR;
    const chartH = this.height - padT - padB;

    // Calculate dynamic Y max
    let maxY = 10;
    for (const pt of history) {
      maxY = Math.max(maxY, pt.cwnd * 1.25, pt.ssthresh * 1.1);
    }
    maxY = Math.ceil(maxY / 5) * 5;

    // Draw background grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      const val = Math.round(maxY - (maxY / gridLines) * i);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${val}`, padL - 6, y);
    }

    // Map history points to coordinates
    const numPoints = history.length;
    const getX = (idx) => padL + (idx / (numPoints - 1)) * chartW;
    const getY = (val) => padT + chartH - (val / maxY) * chartH;

    // 1. Draw In-Flight Packets (Green Area)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(0));
    for (let i = 0; i < numPoints; i++) {
      ctx.lineTo(getX(i), getY(history[i].inFlight));
    }
    ctx.lineTo(getX(numPoints - 1), getY(0));
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.fill();
    ctx.restore();

    // 2. Draw cwnd Area & Line (Cyan Sawtooth)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(history[0].cwnd));
    for (let i = 1; i < numPoints; i++) {
      ctx.lineTo(getX(i), getY(history[i].cwnd));
    }
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 3. Draw ssthresh Line (Dashed Amber)
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.moveTo(getX(0), getY(history[0].ssthresh));
    for (let i = 1; i < numPoints; i++) {
      ctx.lineTo(getX(i), getY(history[i].ssthresh));
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // Header Legend & Status Pills
    const current = history[history.length - 1];
    ctx.textAlign = 'left';
    ctx.font = '600 11px "Outfit", sans-serif';

    // Phase Badge
    const phaseColors = {
      'SlowStart': { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8' },
      'CongestionAvoidance': { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
      'FastRecovery': { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24' },
      'TimeoutRecovery': { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' }
    };
    const phaseStyle = phaseColors[current.phase] || phaseColors['SlowStart'];

    ctx.fillStyle = phaseStyle.text;
    ctx.fillText(`● PHASE: ${current.phase.toUpperCase()}`, padL, 16);

    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`cwnd: ${current.cwnd.toFixed(1)} MSS`, padL + 180, 16);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`ssthresh: ${current.ssthresh.toFixed(1)}`, padL + 280, 16);

    ctx.fillStyle = '#10b981';
    ctx.fillText(`In-flight: ${current.inFlight}`, padL + 380, 16);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`RTT: ${current.rtt}ms (RTO: ${session.rto}ms)`, padL + 460, 16);
  }
}
