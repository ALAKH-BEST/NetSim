import test from 'node:test';
import assert from 'node:assert/strict';
import { DistanceVectorRouter } from '../js/engine/distanceVector.js';

test('Distance-Vector converges and finds shortest hop paths', () => {
  const nodes = [
    { id: 'R1', name: 'Router 1', ip: '10.0.0.1', status: 'online' },
    { id: 'R2', name: 'Router 2', ip: '10.0.0.2', status: 'online' },
    { id: 'R3', name: 'Router 3', ip: '10.0.0.3', status: 'online' }
  ];

  const links = [
    { id: 'l1', sourceId: 'R1', targetId: 'R2', status: 'up' },
    { id: 'l2', sourceId: 'R2', targetId: 'R3', status: 'up' }
  ];

  const result = DistanceVectorRouter.simulateConvergence(nodes, links, true, true);
  assert.ok(result.converged, 'Distance vector should converge');
  assert.ok(result.iterations <= 5, 'Should converge within few iterations');

  const r1Table = result.routingTables.get('R1');
  const routeToR3 = r1Table.find(r => r.destinationId === 'R3');
  assert.ok(routeToR3, 'R1 should have a route to R3');
  assert.equal(routeToR3.nextHopId, 'R2', 'Next hop from R1 to R3 should be R2');
  assert.equal(routeToR3.cost, 2, 'Hop cost should be 2');
});
