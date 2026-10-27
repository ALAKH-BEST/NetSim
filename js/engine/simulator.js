/**
 * NetSim Core Discrete-Tick Network Simulation Engine
 */

import { DijkstraRouter } from './dijkstra.js';
import { DistanceVectorRouter } from './distanceVector.js';
import { TcpSessionManager } from './tcpEngine.js';
import { TOPOLOGY_PRESETS } from './presets.js';
import { PacketColors } from '../types.js';

export class NetworkSimulator {
  constructor() {
    this.nodes = new Map();
    this.links = new Map();
    this.inFlightPackets = [];   // Packets currently propagating along links
    this.events = [];            // Wireshark-like event log
    this.maxEvents = 500;

    this.simTimeMs = 0;
    this.isRunning = true;
    this.speedMultiplier = 1.0;
    this.routingAlgorithm = 'dijkstra'; // 'dijkstra' | 'distance_vector' | 'ecmp' | 'congestion_aware'

    this.tcpManager = new TcpSessionManager();
    this.activeFlows = [];       // Continuous traffic generators or active transfers

    // Cumulative stats
    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalDropped: 0,
      recentBytesDelivered: 0,
      throughputMbps: 0,
      avgLatencyMs: 0,
      latencies: [],
      bufferbloatAlerts: 0
    };

    this.lastThroughputCalcTime = 0;
    this.onStateChange = null;

    // Load initial default preset
    this.loadPreset('isp_mesh');
  }

  /**
   * Loads a preset network topology.
   * @param {string} presetKey
   */
  loadPreset(presetKey) {
    const preset = TOPOLOGY_PRESETS[presetKey] || TOPOLOGY_PRESETS['isp_mesh'];
    this.clear();

    for (const n of preset.nodes) {
      this.addNode({
        id: n.id,
        name: n.name,
        type: n.type,
        ip: n.ip,
        x: n.x,
        y: n.y,
        status: 'online',
        stats: { packetsSent: 0, packetsReceived: 0, packetsDropped: 0, bytesTransferred: 0 },
        routingTable: []
      });
    }

    for (const l of preset.links) {
      this.addLink({
        id: l.id,
        sourceId: l.sourceId,
        targetId: l.targetId,
        bandwidthMbps: l.bandwidthMbps,
        latencyMs: l.latencyMs,
        lossRate: l.lossRate || 0.0,
        queueCapacity: l.queueCapacity || 20,
        queue: [],
        status: 'up',
        stats: { totalPackets: 0, droppedPackets: 0, currentUtilization: 0, totalBytes: 0 }
      });
    }

    this.updateRoutingTables();
    this.logEvent('ROUTING', null, null, 'ROUTING_UPDATE', `Loaded topology preset: "${preset.name}"`, 'info');
  }

  clear() {
    this.nodes.clear();
    this.links.clear();
    this.inFlightPackets = [];
    this.events = [];
    this.tcpManager.clear();
    this.activeFlows = [];
    this.simTimeMs = 0;
    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalDropped: 0,
      recentBytesDelivered: 0,
      throughputMbps: 0,
      avgLatencyMs: 0,
      latencies: [],
      bufferbloatAlerts: 0
    };
  }

  addNode(node) {
    this.nodes.set(node.id, {
      ...node,
      stats: node.stats || { packetsSent: 0, packetsReceived: 0, packetsDropped: 0, bytesTransferred: 0 },
      routingTable: node.routingTable || []
    });
    this.updateRoutingTables();
  }

  removeNode(nodeId) {
    // Remove connected links first
    for (const [linkId, link] of this.links) {
      if (link.sourceId === nodeId || link.targetId === nodeId) {
        this.links.delete(linkId);
      }
    }
    this.nodes.delete(nodeId);
    this.updateRoutingTables();
  }

  addLink(link) {
    this.links.set(link.id, {
      ...link,
      queue: link.queue || [],
      stats: link.stats || { totalPackets: 0, droppedPackets: 0, currentUtilization: 0, totalBytes: 0 }
    });
    this.updateRoutingTables();
  }

  removeLink(linkId) {
    this.links.delete(linkId);
    this.updateRoutingTables();
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  getLink(linkId) {
    return this.links.get(linkId);
  }

  /**
   * Recomputes routing tables across all nodes based on active algorithm.
   */
  updateRoutingTables() {
    let routingTables;

    if (this.routingAlgorithm === 'distance_vector') {
      const result = DistanceVectorRouter.simulateConvergence(this.nodes, this.links, true, true);
      routingTables = result.routingTables;
    } else if (this.routingAlgorithm === 'congestion_aware') {
      routingTables = DijkstraRouter.buildAllRoutingTables(this.nodes, this.links, 'dynamic');
    } else {
      // Standard Dijkstra (latency metric) or ECMP
      routingTables = DijkstraRouter.buildAllRoutingTables(this.nodes, this.links, 'latency');
    }

    for (const [nodeId, node] of this.nodes) {
      node.routingTable = routingTables.get(nodeId) || [];
    }
  }

  /**
   * Sets routing algorithm and triggers route recalculation.
   * @param {'dijkstra'|'distance_vector'|'ecmp'|'congestion_aware'} algo
   */
  setRoutingAlgorithm(algo) {
    this.routingAlgorithm = algo;
    this.updateRoutingTables();
    this.logEvent('ROUTING', null, null, 'ROUTING_UPDATE', `Routing algorithm switched to: ${algo.toUpperCase()}`, 'info');
  }

  /**
   * Chaos injection: Toggle node failure.
   */
  toggleNodeFailure(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = node.status === 'failed' ? 'online' : 'failed';
    this.logEvent(
      'ROUTING',
      node.id,
      null,
      'ROUTING_UPDATE',
      `Node "${node.name}" (${node.ip}) is now ${node.status.toUpperCase()}!`,
      node.status === 'failed' ? 'error' : 'success'
    );

    // Dynamic reroute
    this.updateRoutingTables();
  }

  /**
   * Chaos injection: Toggle link severance.
   */
  toggleLinkFailure(linkId) {
    const link = this.links.get(linkId);
    if (!link) return;

    link.status = link.status === 'down' ? 'up' : 'down';
    this.logEvent(
      'ROUTING',
      link.sourceId,
      link.targetId,
      'ROUTING_UPDATE',
      `Link ${linkId} is now ${link.status.toUpperCase()}!`,
      link.status === 'down' ? 'error' : 'success'
    );

    // Dropped packets currently queued on cut link
    if (link.status === 'down' && link.queue.length > 0) {
      this.stats.totalDropped += link.queue.length;
      link.stats.droppedPackets += link.queue.length;
      link.queue = [];
    }

    this.updateRoutingTables();
  }

  /**
   * Starts a continuous UDP or TCP flow between two nodes.
   */
  startFlow(srcId, dstId, protocol = 'TCP', options = {}) {
    if (protocol === 'TCP') {
      const session = this.tcpManager.createSession(
        srcId,
        dstId,
        options.flowType || 'continuous',
        options.totalBytes || 300_000
      );
      this.activeFlows.push({
        type: 'TCP',
        sessionId: session.id,
        srcId,
        dstId
      });
      this.logEvent('TCP', srcId, dstId, 'TCP_SYN', `Started TCP stream from ${srcId} to ${dstId}`, 'info');
      return session;
    } else {
      // UDP blast
      const flowId = `udp_flow_${Math.random().toString(36).substr(2, 6)}`;
      this.activeFlows.push({
        id: flowId,
        type: 'UDP',
        srcId,
        dstId,
        ratePps: options.ratePps || 12,
        lastSentAt: this.simTimeMs,
        active: true
      });
      this.logEvent('UDP', srcId, dstId, 'UDP_DATA', `Started UDP stream (${options.ratePps || 12} pps) from ${srcId} to ${dstId}`, 'info');
      return flowId;
    }
  }

  /**
   * Sends an ICMP Echo Request (Ping).
   */
  sendPing(srcId, dstId) {
    const src = this.nodes.get(srcId);
    const dst = this.nodes.get(dstId);
    if (!src || !dst) return;

    const packet = {
      id: `icmp_ping_${Math.random().toString(36).substr(2, 6)}`,
      type: 'ICMP_ECHO_REQ',
      protocol: 'ICMP',
      sourceId: srcId,
      targetId: '',
      finalDestId: dstId,
      sourceIp: src.ip,
      destIp: dst.ip,
      payloadSize: 64,
      ttl: 32,
      progress: 0,
      currentLinkId: '',
      direction: 'source_to_target',
      pathTaken: [srcId],
      createdAt: this.simTimeMs,
      label: 'PING REQ'
    };

    this.forwardPacketFromNode(srcId, packet);
    this.logEvent('ICMP', srcId, dstId, 'ICMP_ECHO_REQ', `PING ${dst.ip} (64 bytes)`, 'info');
  }

  /**
   * Forwards a packet out of a node along the next route hop.
   */
  forwardPacketFromNode(nodeId, packet) {
    const node = this.nodes.get(nodeId);
    if (!node || node.status === 'failed') {
      this.dropPacket(packet, 'Node is failed or offline');
      return false;
    }

    if (nodeId === packet.finalDestId) {
      this.deliverPacket(nodeId, packet);
      return true;
    }

    // Lookup route in node's routing table
    const route = node.routingTable.find(r => r.destinationId === packet.finalDestId);
    if (!route || !route.nextHopId) {
      this.dropPacket(packet, `No route to host ${packet.destIp}`);
      return false;
    }

    // Handle Equal-Cost Multi-Path (ECMP) load balancing
    let nextHopId = route.nextHopId;
    if (this.routingAlgorithm === 'ecmp' && route.allNextHops && route.allNextHops.length > 1) {
      // Hash packet flow or alternate
      const hash = Math.abs((packet.seq || 0) + packet.id.charCodeAt(packet.id.length - 1));
      nextHopId = route.allNextHops[hash % route.allNextHops.length];
    }

    // Find usable link connecting node to nextHopId
    const link = Array.from(this.links.values()).find(
      l => l.status !== 'down' &&
           ((l.sourceId === nodeId && l.targetId === nextHopId) ||
            (l.targetId === nodeId && l.sourceId === nextHopId))
    );

    if (!link) {
      this.dropPacket(packet, `Link to next hop ${nextHopId} is down`);
      return false;
    }

    // Enqueue packet on link
    if (link.queue.length >= link.queueCapacity) {
      // Bufferbloat / tail-drop!
      this.dropPacket(packet, `Buffer overflow on link (${link.queue.length}/${link.queueCapacity} pkts)`);
      this.stats.bufferbloatAlerts++;
      return false;
    }

    packet.targetId = nextHopId;
    packet.currentLinkId = link.id;
    packet.direction = link.sourceId === nodeId ? 'source_to_target' : 'target_to_source';
    link.queue.push(packet);
    link.stats.totalPackets++;

    return true;
  }

  /**
   * Delivers packet at its final destination node.
   */
  deliverPacket(destId, packet) {
    const destNode = this.nodes.get(destId);
    if (!destNode || destNode.status === 'failed') {
      this.dropPacket(packet, 'Destination node unreachable / offline');
      return;
    }

    destNode.stats.packetsReceived++;
    destNode.stats.bytesTransferred += packet.payloadSize;
    this.stats.totalDelivered++;
    this.stats.recentBytesDelivered += packet.payloadSize;

    const rttSample = Math.max(1, this.simTimeMs - packet.createdAt);
    this.stats.latencies.push(rttSample);
    if (this.stats.latencies.length > 50) this.stats.latencies.shift();
    this.stats.avgLatencyMs = Math.round(
      this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length
    );

    // Protocol-specific handling
    if (packet.protocol === 'TCP') {
      if (packet.type === 'TCP_DATA') {
        // Send ACK back to source
        const ackPacket = {
          id: `ack_${packet.id}`,
          type: 'TCP_ACK',
          protocol: 'TCP',
          sourceId: destId,
          targetId: '',
          finalDestId: packet.sourceId,
          sourceIp: destNode.ip,
          destIp: packet.sourceIp,
          payloadSize: 40,
          ttl: 32,
          progress: 0,
          currentLinkId: '',
          direction: 'source_to_target',
          pathTaken: [destId],
          createdAt: this.simTimeMs,
          seq: 0,
          ack: packet.seq, // Acknowledge this seq
          tcpSessionId: packet.tcpSessionId,
          label: `ACK #${packet.seq}`
        };
        this.forwardPacketFromNode(destId, ackPacket);
        this.logEvent('TCP', packet.sourceId, destId, 'TCP_DATA', `Received SEQ #${packet.seq} (${packet.payloadSize} B)`, 'info');
      } else if (packet.type === 'TCP_ACK') {
        // Source received ACK! Update TCP session window
        if (packet.tcpSessionId) {
          const { retransmitPacket, eventType } = this.tcpManager.handleAck(
            packet.tcpSessionId,
            packet.ack,
            this.simTimeMs
          );

          if (eventType === 'fast_retransmit' && retransmitPacket) {
            this.logEvent('TCP', packet.finalDestId, destId, 'TCP_DATA', `⚡ Fast Retransmit SEQ #${packet.ack} (3 Dup ACKs)`, 'warn');
            this.forwardPacketFromNode(packet.finalDestId, retransmitPacket);
          } else if (eventType === 'new_ack') {
            this.logEvent('TCP', destId, packet.finalDestId, 'TCP_ACK', `ACK #${packet.ack} verified (RTT: ${rttSample}ms)`, 'success');
          }
        }
      }
    } else if (packet.protocol === 'ICMP') {
      if (packet.type === 'ICMP_ECHO_REQ') {
        // Reply with ICMP Echo Reply
        const replyPacket = {
          id: `icmp_reply_${packet.id}`,
          type: 'ICMP_ECHO_REP',
          protocol: 'ICMP',
          sourceId: destId,
          targetId: '',
          finalDestId: packet.sourceId,
          sourceIp: destNode.ip,
          destIp: packet.sourceIp,
          payloadSize: 64,
          ttl: 32,
          progress: 0,
          currentLinkId: '',
          direction: 'source_to_target',
          pathTaken: [destId],
          createdAt: this.simTimeMs,
          label: 'PING REPLY'
        };
        this.forwardPacketFromNode(destId, replyPacket);
        this.logEvent('ICMP', destId, packet.sourceId, 'ICMP_ECHO_REP', `Ping Reply from ${destNode.ip}`, 'success');
      } else if (packet.type === 'ICMP_ECHO_REP') {
        this.logEvent('ICMP', packet.sourceId, destId, 'ICMP_ECHO_REP', `Ping Reply received: time=${rttSample}ms TTL=${packet.ttl}`, 'success');
      }
    } else if (packet.protocol === 'UDP') {
      this.logEvent('UDP', packet.sourceId, destId, 'UDP_DATA', `UDP Datagram received (${packet.payloadSize} B)`, 'info');
    }
  }

  /**
   * Drops packet and records failure metrics.
   */
  dropPacket(packet, reason) {
    this.stats.totalDropped++;
    const srcNode = this.nodes.get(packet.sourceId);
    if (srcNode) srcNode.stats.packetsDropped++;

    if (packet.currentLinkId) {
      const link = this.links.get(packet.currentLinkId);
      if (link) link.stats.droppedPackets++;
    }

    this.logEvent(
      packet.protocol,
      packet.sourceId,
      packet.finalDestId,
      packet.type,
      `Packet dropped: ${reason} [${packet.label || packet.id}]`,
      'error'
    );
  }

  /**
   * Logs simulation event for telemetry and inspector.
   */
  logEvent(protocol, srcId, dstId, type, message, severity = 'info') {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      time: Math.round(this.simTimeMs) / 1000,
      protocol,
      sourceId: srcId || 'NET',
      destId: dstId || 'ALL',
      type,
      message,
      severity
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
  }

  /**
   * Discrete time tick advancement.
   * @param {number} deltaMs
   */
  tick(deltaMs = 20) {
    if (!this.isRunning) return;

    const scaledDelta = deltaMs * this.speedMultiplier;
    this.simTimeMs += scaledDelta;

    // 1. Process active traffic flows (TCP sessions & UDP streams)
    this.processFlows(scaledDelta);

    // 2. Process link queues (transmission onto the wire)
    this.processLinkQueues(scaledDelta);

    // 3. Move packets in flight along links (propagation delay)
    this.processInFlightPackets(scaledDelta);

    // 4. Update TCP timeouts
    this.processTcpTimeouts();

    // 5. Periodic throughput & congestion metrics
    if (this.simTimeMs - this.lastThroughputCalcTime >= 500) {
      const elapsedSec = (this.simTimeMs - this.lastThroughputCalcTime) / 1000;
      const bits = this.stats.recentBytesDelivered * 8;
      this.stats.throughputMbps = parseFloat(((bits / elapsedSec) / 1_000_000).toFixed(2));
      this.stats.recentBytesDelivered = 0;
      this.lastThroughputCalcTime = this.simTimeMs;

      // Update link utilization metrics
      for (const [_, link] of this.links) {
        const occupancy = link.queue.length / Math.max(1, link.queueCapacity);
        link.stats.currentUtilization = Math.round(occupancy * 100);
      }

      // If congestion-aware routing is active, update dynamically
      if (this.routingAlgorithm === 'congestion_aware') {
        this.updateRoutingTables();
      }
    }
  }

  /**
   * Processes active flows.
   * @private
   */
  processFlows(scaledDelta) {
    for (const flow of this.activeFlows) {
      if (flow.type === 'TCP') {
        const newPackets = this.tcpManager.producePackets(flow.sessionId, this.simTimeMs, this);
        for (const pkt of newPackets) {
          this.stats.totalSent++;
          const srcNode = this.nodes.get(pkt.sourceId);
          if (srcNode) srcNode.stats.packetsSent++;
          this.forwardPacketFromNode(pkt.sourceId, pkt);
        }
      } else if (flow.type === 'UDP' && flow.active) {
        const interval = 1000 / flow.ratePps;
        if (this.simTimeMs - flow.lastSentAt >= interval) {
          flow.lastSentAt = this.simTimeMs;
          const srcNode = this.nodes.get(flow.srcId);
          const dstNode = this.nodes.get(flow.dstId);
          if (srcNode && dstNode) {
            const pkt = {
              id: `udp_${Math.random().toString(36).substr(2, 6)}`,
              type: 'UDP_DATA',
              protocol: 'UDP',
              sourceId: flow.srcId,
              targetId: '',
              finalDestId: flow.dstId,
              sourceIp: srcNode.ip,
              destIp: dstNode.ip,
              payloadSize: 1024,
              ttl: 32,
              progress: 0,
              currentLinkId: '',
              direction: 'source_to_target',
              pathTaken: [flow.srcId],
              createdAt: this.simTimeMs,
              label: 'UDP STREAM'
            };
            this.stats.totalSent++;
            srcNode.stats.packetsSent++;
            this.forwardPacketFromNode(flow.srcId, pkt);
          }
        }
      }
    }
  }

  /**
   * Transmits packets from link buffer queues onto the physical wire.
   * @private
   */
  processLinkQueues(scaledDelta) {
    for (const [_, link] of this.links) {
      if (link.status === 'down' || link.queue.length === 0) continue;

      // Transmission delay calculation: bytes * 8 / (bandwidth * 1e6) * 1000 ms
      // Packet leaves queue and enters in-flight propagation
      const packet = link.queue.shift();

      // Check random packet loss on link
      if (link.lossRate > 0 && Math.random() < link.lossRate) {
        this.dropPacket(packet, `Physical link loss (${Math.round(link.lossRate * 100)}% configured loss)`);
        continue;
      }

      packet.progress = 0;
      this.inFlightPackets.push(packet);
    }
  }

  /**
   * Advances in-flight packets along physical links towards target hop.
   * @private
   */
  processInFlightPackets(scaledDelta) {
    const remaining = [];

    for (const packet of this.inFlightPackets) {
      const link = this.links.get(packet.currentLinkId);
      if (!link || link.status === 'down') {
        this.dropPacket(packet, 'Link cut while in flight');
        continue;
      }

      // Propagation speed: progress goes from 0 to 1 over link.latencyMs
      const step = scaledDelta / Math.max(1, link.latencyMs);
      packet.progress += step;

      if (packet.progress >= 1.0) {
        // Reached next hop node!
        packet.progress = 1.0;
        const reachedNodeId = packet.targetId;
        packet.pathTaken.push(reachedNodeId);

        // Decrement TTL
        packet.ttl -= 1;
        if (packet.ttl <= 0) {
          this.dropPacket(packet, 'TTL Expired (Time to Live exceeded)');
          continue;
        }

        // If reached final destination, deliver!
        if (reachedNodeId === packet.finalDestId) {
          this.deliverPacket(reachedNodeId, packet);
        } else {
          // Continue forwarding at next router hop
          this.forwardPacketFromNode(reachedNodeId, packet);
        }
      } else {
        remaining.push(packet);
      }
    }

    this.inFlightPackets = remaining;
  }

  /**
   * Checks TCP session timeouts and retransmits when RTO expires.
   * @private
   */
  processTcpTimeouts() {
    for (const session of this.tcpManager.getAllSessions()) {
      const timeoutPacket = this.tcpManager.checkTimeout(session.id, this.simTimeMs);
      if (timeoutPacket) {
        this.logEvent(
          'TCP',
          timeoutPacket.sourceId,
          timeoutPacket.finalDestId,
          'TCP_RST',
          `⏰ RTO Timeout! Retransmitting SEQ #${timeoutPacket.seq} (ssthresh=${session.ssthresh}, cwnd=1)`,
          'error'
        );
        this.forwardPacketFromNode(timeoutPacket.sourceId, timeoutPacket);
      }
    }
  }
}
