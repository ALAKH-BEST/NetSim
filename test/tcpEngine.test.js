import test from 'node:test';
import assert from 'node:assert/strict';
import { TcpSessionManager } from '../js/engine/tcpEngine.js';

test('TCP Slow Start doubles cwnd with each ACK until ssthresh', () => {
  const manager = new TcpSessionManager();
  const session = manager.createSession('client', 'server', 'continuous', 100000);

  assert.equal(session.cwnd, 1.0, 'Initial cwnd is 1');
  assert.equal(session.phase, 'SlowStart');

  // ACK 1
  manager.handleAck(session.id, 1, 100);
  assert.equal(session.cwnd, 2.0, 'cwnd increases by 1 in slow start');

  // ACK 2
  manager.handleAck(session.id, 2, 120);
  assert.equal(session.cwnd, 3.0);
});

test('TCP Congestion Avoidance grows cwnd additively (AIMD)', () => {
  const manager = new TcpSessionManager();
  const session = manager.createSession('client', 'server', 'continuous', 100000);
  session.cwnd = 16.0;
  session.ssthresh = 16.0;
  session.phase = 'CongestionAvoidance';

  // ACK in Congestion Avoidance: cwnd += 1 / cwnd
  manager.handleAck(session.id, 1, 100);
  assert.ok(session.cwnd > 16.0 && session.cwnd < 17.0, 'cwnd grows fractionally per ACK in AIMD');
  assert.equal(session.phase, 'CongestionAvoidance');
});

test('TCP Fast Retransmit triggers on 3 Duplicate ACKs and halves ssthresh', () => {
  const manager = new TcpSessionManager();
  const session = manager.createSession('client', 'server', 'continuous', 100000);
  session.cwnd = 12.0;
  session.ssthresh = 16.0;

  // Populate unacked packet
  session.unackedPackets.set(5, {
    packet: { id: 'pkt_5', seq: 5 },
    sentAt: 50,
    size: 1460
  });

  // Receive normal ACK 4
  manager.handleAck(session.id, 4, 100);

  // Send 3 duplicate ACKs for ACK 4
  manager.handleAck(session.id, 4, 110); // Dup 1
  manager.handleAck(session.id, 4, 120); // Dup 2
  const result = manager.handleAck(session.id, 4, 130); // Dup 3 -> Fast Retransmit!

  assert.equal(result.eventType, 'fast_retransmit');
  assert.ok(result.retransmitPacket, 'Should return retransmitted packet');
  assert.equal(result.retransmitPacket.seq, 5, 'Should retransmit sequence #5');
  assert.equal(session.phase, 'FastRecovery');
  assert.equal(session.ssthresh, 6.0, 'ssthresh halved from 12 to 6');
});

test('TCP RTO Timeout triggers Slow Start reset to cwnd = 1 and exponential backoff', () => {
  const manager = new TcpSessionManager();
  const session = manager.createSession('client', 'server', 'continuous', 100000);
  session.cwnd = 10.0;
  session.rto = 200;

  session.unackedPackets.set(1, {
    packet: { id: 'pkt_1', seq: 1 },
    sentAt: 100,
    size: 1460
  });

  // At time 150 (not expired yet)
  const noTimeout = manager.checkTimeout(session.id, 150);
  assert.equal(noTimeout, null);

  // At time 350 (elapsed 250ms >= rto 200ms)
  const timeoutPkt = manager.checkTimeout(session.id, 350);
  assert.ok(timeoutPkt, 'Timeout should trigger');
  assert.equal(session.cwnd, 1.0, 'cwnd reset to 1 on timeout');
  assert.equal(session.ssthresh, 5.0, 'ssthresh halved to 5');
  assert.ok(session.rto > 200, 'RTO exponentially backed off');
  assert.equal(session.phase, 'SlowStart');
});
