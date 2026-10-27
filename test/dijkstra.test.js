import test from 'node:test';
import assert from 'node:assert/strict';
import { DijkstraRouter } from '../js/engine/dijkstra.js';

test('Dijkstra computes optimal shortest path correctly', () => {
  const nodes = [
    { id: 'A', name: 'Node A', ip: '10.0.0.1', status: 'online' },
    { id: 'B', name: 'Node B', ip: '10.0.0.2', status: 'online' },
    { id: 'C', name: 'Node C', ip: '10.0.0.3', status: 'online' }
  ];

  const links = [
    { id: 'l_ab', sourceId: 'A', targetId: 'B', latencyMs: 10, status: 'up' },
    { id: 'l_bc', sourceId: 'B', targetId: 'C', latencyMs: 15, status: 'up' },
    { id: 'l_ac', sourceId: 'A', targetId: 'C', latencyMs: 50, status: 'up' }
  ];

  const tables = DijkstraRouter.buildAllRoutingTables(nodes, links, 'latency');
  const aTable = tables.get('A');

  // Shortest path A -> C should be via B (10 + 15 = 25ms < 50ms)
  const routeToC = aTable.find(r => r.destinationId === 'C');
  assert.ok(routeToC, 'Route to C must exist');
  assert.equal(routeToC.nextHopId, 'B', 'Next hop from A to C should be B');
  assert.equal(routeToC.cost, 25, 'Total cost should be 25ms');
});

test('Dijkstra dynamically reroutes when intermediate node fails', () => {
  const nodes = [
    { id: 'A', name: 'Node A', ip: '10.0.0.1', status: 'online' },
    { id: 'B', name: 'Node B', ip: '10.0.0.2', status: 'failed' }, // Node B is down!
    { id: 'C', name: 'Node C', ip: '10.0.0.3', status: 'online' }
  ];

  const links = [
    { id: 'l_ab', sourceId: 'A', targetId: 'B', latencyMs: 10, status: 'up' },
    { id: 'l_bc', sourceId: 'B', targetId: 'C', latencyMs: 15, status: 'up' },
    { id: 'l_ac', sourceId: 'A', targetId: 'C', latencyMs: 50, status: 'up' }
  ];

  const tables = DijkstraRouter.buildAllRoutingTables(nodes, links, 'latency');
  const aTable = tables.get('A');

  // Since B is down, direct link A -> C (50ms) must be chosen
  const routeToC = aTable.find(r => r.destinationId === 'C');
  assert.ok(routeToC, 'Route to C must exist via direct backup link');
  assert.equal(routeToC.nextHopId, 'C', 'Next hop from A to C must now be direct C');
  assert.equal(routeToC.cost, 50, 'Total cost should be 50ms');
});

test('Dijkstra supports ECMP (Equal-Cost Multi-Path)', () => {
  const nodes = [
    { id: 'A', name: 'Node A', ip: '10.0.0.1', status: 'online' },
    { id: 'B1', name: 'Spine 1', ip: '10.0.0.2', status: 'online' },
    { id: 'B2', name: 'Spine 2', ip: '10.0.0.3', status: 'online' },
    { id: 'C', name: 'Node C', ip: '10.0.0.4', status: 'online' }
  ];

  const links = [
    { id: 'l1', sourceId: 'A', targetId: 'B1', latencyMs: 10, status: 'up' },
    { id: 'l2', sourceId: 'B1', targetId: 'C', latencyMs: 10, status: 'up' },
    { id: 'l3', sourceId: 'A', targetId: 'B2', latencyMs: 10, status: 'up' },
    { id: 'l4', sourceId: 'B2', targetId: 'C', latencyMs: 10, status: 'up' }
  ];

  const tables = DijkstraRouter.buildAllRoutingTables(nodes, links, 'latency');
  const aTable = tables.get('A');
  const routeToC = aTable.find(r => r.destinationId === 'C');

  assert.ok(routeToC, 'Route to C must exist');
  assert.equal(routeToC.cost, 20);
  assert.equal(routeToC.allNextHops.length, 2, 'ECMP should find both B1 and B2 next hops');
  assert.ok(routeToC.allNextHops.includes('B1'));
  assert.ok(routeToC.allNextHops.includes('B2'));
});
