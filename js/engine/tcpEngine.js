/**
 * TCP Congestion Control & State Engine (Tahoe / Reno / NewReno model)
 * Implements Slow Start, Congestion Avoidance (AIMD), Fast Retransmit (3 Dup ACKs),
 * Fast Recovery, Retransmission Timeouts (RTO) with Exponential Backoff,
 * and EWMA Round-Trip Time estimation (Jacobson's algorithm).
 */

export class TcpSessionManager {
  constructor() {
    /** @type {Map<string, Object>} */
    this.sessions = new Map();
  }

  /**
   * Creates or initializes a TCP session between two nodes.
   * @param {string} sourceNodeId
   * @param {string} destNodeId
   * @param {'continuous'|'file_transfer'} flowType
   * @param {number} totalBytes
   * @returns {Object} TCPSession
   */
  createSession(sourceNodeId, destNodeId, flowType = 'continuous', totalBytes = 250_000) {
    const id = `tcp_${sourceNodeId}_${destNodeId}_${Math.random().toString(36).substr(2, 6)}`;
    const session = {
      id,
      sourceNodeId,
      destNodeId,
      state: 'ESTABLISHED',
      cwnd: 1.0,               // Congestion window in MSS packets
      ssthresh: 16.0,          // Slow start threshold
      unackedPackets: new Map(), // seqNum -> { packet, sentAt, size }
      nextSeqNum: 1,
      expectedAckNum: 1,
      lastAckReceived: 0,
      dupAckCount: 0,
      srtt: 60,                // Smoothed RTT (ms)
      rttVar: 15,              // RTT variance (ms)
      rto: 200,                // Retransmission Timeout (ms)
      phase: 'SlowStart',      // 'SlowStart' | 'CongestionAvoidance' | 'FastRecovery' | 'TimeoutRecovery'
      totalBytesSent: 0,
      totalBytesAcked: 0,
      flowType,
      remainingBytes: totalBytes,
      active: true,
      history: []              // Time series for graphing
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Generates outgoing data packets allowed by current cwnd and in-flight window.
   * @param {string} sessionId
   * @param {number} currentTimeSimMs
   * @param {Object} simulator
   * @returns {Array<Object>} List of created packets
   */
  producePackets(sessionId, currentTimeSimMs, simulator) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active || session.state !== 'ESTABLISHED') {
      return [];
    }

    if (session.flowType === 'file_transfer' && session.remainingBytes <= 0 && session.unackedPackets.size === 0) {
      session.active = false;
      session.state = 'CLOSED';
      return [];
    }

    const inFlight = session.unackedPackets.size;
    const allowedInFlight = Math.floor(session.cwnd);
    const availableSlots = Math.max(0, allowedInFlight - inFlight);

    const generatedPackets = [];

    for (let i = 0; i < availableSlots; i++) {
      if (session.flowType === 'file_transfer' && session.remainingBytes <= 0) {
        break;
      }

      const seq = session.nextSeqNum;
      const payloadSize = 1460; // Standard Ethernet MSS (1500 - 40 header)

      const packet = {
        id: `pkt_${sessionId}_seq${seq}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'TCP_DATA',
        protocol: 'TCP',
        sourceId: session.sourceNodeId,
        targetId: '', // Filled by simulator router
        finalDestId: session.destNodeId,
        sourceIp: simulator.getNode(session.sourceNodeId)?.ip || '',
        destIp: simulator.getNode(session.destNodeId)?.ip || '',
        payloadSize,
        ttl: 32,
        progress: 0,
        currentLinkId: '',
        direction: 'source_to_target',
        pathTaken: [session.sourceNodeId],
        createdAt: currentTimeSimMs,
        seq,
        ack: session.expectedAckNum,
        tcpSessionId: sessionId,
        isRetransmission: false,
        label: `SEQ #${seq}`
      };

      session.unackedPackets.set(seq, {
        packet: { ...packet },
        sentAt: currentTimeSimMs,
        size: payloadSize
      });

      session.nextSeqNum += 1;
      session.totalBytesSent += payloadSize;
      if (session.flowType === 'file_transfer') {
        session.remainingBytes -= payloadSize;
      }

      generatedPackets.push(packet);
    }

    // Record telemetry snapshot
    this.recordSnapshot(session, currentTimeSimMs);

    return generatedPackets;
  }

  /**
   * Handles incoming ACK packet at sender.
   * @param {string} sessionId
   * @param {number} ackNum
   * @param {number} currentTimeSimMs
   * @returns {{ retransmitPacket: Object|null, eventType: string }}
   */
  handleAck(sessionId, ackNum, currentTimeSimMs) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return { retransmitPacket: null, eventType: 'none' };

    let retransmitPacket = null;
    let eventType = 'ack';

    // Check for Duplicate ACK (packet received had seq < expected or sender receives same ack)
    if (ackNum === session.lastAckReceived) {
      session.dupAckCount += 1;

      // 3 Duplicate ACKs trigger Fast Retransmit and Fast Recovery!
      if (session.dupAckCount === 3) {
        session.phase = 'FastRecovery';
        // Multiplicative decrease
        session.ssthresh = Math.max(Math.floor(session.cwnd / 2), 2);
        session.cwnd = session.ssthresh + 3;

        // The missing packet is the first unacknowledged packet (seq = ackNum or ackNum + 1)
        let missingEntry = session.unackedPackets.get(ackNum) || session.unackedPackets.get(ackNum + 1);
        if (!missingEntry && session.unackedPackets.size > 0) {
          missingEntry = session.unackedPackets.values().next().value;
        }

        if (missingEntry) {
          retransmitPacket = {
            ...missingEntry.packet,
            id: `pkt_${sessionId}_retrans_${missingEntry.packet.seq}_${Math.random().toString(36).substring(2, 6)}`,
            createdAt: currentTimeSimMs,
            isRetransmission: true,
            progress: 0,
            pathTaken: [session.sourceNodeId],
            label: `RETRANS #${missingEntry.packet.seq}`
          };
          missingEntry.sentAt = currentTimeSimMs;
        }
        eventType = 'fast_retransmit';
      } else if (session.dupAckCount > 3 && session.phase === 'FastRecovery') {
        // Inflate cwnd for additional dup ACKs during Fast Recovery
        session.cwnd += 1;
        eventType = 'dup_ack';
      } else {
        eventType = 'dup_ack';
      }
    }
    // New Cumulative ACK acknowledging data forward
    else if (ackNum > session.lastAckReceived) {
      session.lastAckReceived = ackNum;
      session.dupAckCount = 0;

      // Clean acknowledged packets from unacked buffer
      for (const [seq, entry] of session.unackedPackets) {
        if (seq <= ackNum) {
          // Calculate RTT sample if not retransmitted
          if (!entry.packet.isRetransmission) {
            const sampleRtt = Math.max(5, currentTimeSimMs - entry.sentAt);
            this.updateRtt(session, sampleRtt);
          }
          session.totalBytesAcked += entry.size;
          session.unackedPackets.delete(seq);
        }
      }

      if (session.phase === 'FastRecovery') {
        // Deflate cwnd upon exiting Fast Recovery
        session.cwnd = session.ssthresh;
        session.phase = 'CongestionAvoidance';
      } else if (session.cwnd < session.ssthresh) {
        // SLOW START: Exponential growth (+1 MSS per ACK received)
        session.cwnd += 1.0;
        session.phase = 'SlowStart';
      } else {
        // CONGESTION AVOIDANCE: Additive Increase (+1 MSS per RTT => 1/cwnd per ACK)
        session.cwnd += (1.0 / Math.max(1, Math.floor(session.cwnd)));
        session.phase = 'CongestionAvoidance';
      }

      eventType = 'new_ack';
    }

    this.recordSnapshot(session, currentTimeSimMs);
    return { retransmitPacket, eventType };
  }

  /**
   * Checks for timeout on unacknowledged packets (RTO).
   * @param {string} sessionId
   * @param {number} currentTimeSimMs
   * @returns {Object|null} Retransmitted packet if timeout occurred
   */
  checkTimeout(sessionId, currentTimeSimMs) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active || session.unackedPackets.size === 0) return null;

    // Check oldest unacked packet
    let oldestSeq = null;
    let oldestEntry = null;

    for (const [seq, entry] of session.unackedPackets) {
      if (!oldestEntry || entry.sentAt < oldestEntry.sentAt) {
        oldestSeq = seq;
        oldestEntry = entry;
      }
    }

    if (!oldestEntry) return null;

    const elapsed = currentTimeSimMs - oldestEntry.sentAt;
    if (elapsed >= session.rto) {
      // RTO Timeout Triggered!
      // Multiplicative decrease to 1, halve ssthresh
      session.ssthresh = Math.max(Math.floor(session.cwnd / 2), 2);
      session.cwnd = 1.0;
      session.phase = 'SlowStart';

      // Exponential backoff of RTO timer
      session.rto = Math.min(Math.round(session.rto * 1.8), 5000);
      session.dupAckCount = 0;

      // Retransmit oldest packet
      oldestEntry.sentAt = currentTimeSimMs;
      oldestEntry.packet.isRetransmission = true;

      const retransmitPacket = {
        ...oldestEntry.packet,
        id: `pkt_${sessionId}_timeout_${oldestSeq}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: currentTimeSimMs,
        isRetransmission: true,
        progress: 0,
        pathTaken: [session.sourceNodeId],
        label: `TIMEOUT RETRANS #${oldestSeq}`
      };

      this.recordSnapshot(session, currentTimeSimMs);
      return retransmitPacket;
    }

    return null;
  }

  /**
   * Updates Jacobson's EWMA RTT estimates.
   * @private
   */
  updateRtt(session, sampleRtt) {
    const alpha = 0.125; // 1/8
    const beta = 0.25;   // 1/4

    if (!session.srtt) {
      session.srtt = sampleRtt;
      session.rttVar = sampleRtt / 2;
    } else {
      const diff = Math.abs(session.srtt - sampleRtt);
      session.rttVar = (1 - beta) * session.rttVar + beta * diff;
      session.srtt = (1 - alpha) * session.srtt + alpha * sampleRtt;
    }

    session.rto = Math.max(Math.round(session.srtt + 4 * session.rttVar), 150);
  }

  /**
   * Records a history point for real-time visualization.
   * @private
   */
  recordSnapshot(session, time) {
    const lastPoint = session.history[session.history.length - 1];
    // Throttle duplicate records within 100ms
    if (lastPoint && (time - lastPoint.time < 100)) {
      return;
    }

    session.history.push({
      time: Math.round(time),
      cwnd: parseFloat(session.cwnd.toFixed(2)),
      ssthresh: parseFloat(session.ssthresh.toFixed(2)),
      inFlight: session.unackedPackets.size,
      rtt: Math.round(session.srtt),
      phase: session.phase
    });

    // Keep last 150 points for responsive rendering
    if (session.history.length > 150) {
      session.history.shift();
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  clear() {
    this.sessions.clear();
  }
}
