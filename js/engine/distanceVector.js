/**
 * Distance-Vector Routing Algorithm (Bellman-Ford / RIP Protocol)
 * Implements distributed distance vector exchange with Split Horizon & Poison Reverse
 * to prevent routing loops and the count-to-infinity problem.
 */

const RIP_INFINITY = 16; // Standard RIP infinity metric

export class DistanceVectorRouter {
  /**
   * Initializes or updates distance vectors for all nodes.
   * @param {Map<string, Object>|Array<Object>} nodes
   * @param {Map<string, Object>|Array<Object>} links
   * @param {boolean} splitHorizon
   * @param {boolean} poisonReverse
   * @returns {{ routingTables: Map<string, Array<Object>>, iterations: number, converged: boolean }}
   */
  static simulateConvergence(nodes, links, splitHorizon = true, poisonReverse = true, maxRounds = 20) {
    const nodeMap = Array.isArray(nodes) ? new Map(nodes.map(n => [n.id, n])) : nodes;
    const linkList = Array.isArray(links) ? links : Array.from(links.values());

    // Filter only online nodes
    const activeNodes = Array.from(nodeMap.values()).filter(n => n.status !== 'failed');
    const activeNodeIds = activeNodes.map(n => n.id);

    // Initial state: direct neighbors known from links
    // vectors: nodeId -> { destId -> { cost, nextHop, interfaceLinkId } }
    const vectors = new Map();

    for (const node of activeNodes) {
      const nodeTable = new Map();
      // Distance to self is 0
      nodeTable.set(node.id, { cost: 0, nextHop: node.id, interfaceLinkId: null, hops: 0 });

      // Direct links
      for (const link of linkList) {
        if (link.status === 'down') continue;
        let neighborId = null;
        if (link.sourceId === node.id) neighborId = link.targetId;
        else if (link.targetId === node.id) neighborId = link.sourceId;

        if (neighborId && nodeMap.get(neighborId)?.status !== 'failed') {
          // Weight can be 1 (hops) or quantized latency
          const cost = 1;
          nodeTable.set(neighborId, { cost, nextHop: neighborId, interfaceLinkId: link.id, hops: 1 });
        }
      }

      // Initialize all other destinations to Infinity
      for (const destId of activeNodeIds) {
        if (!nodeTable.has(destId)) {
          nodeTable.set(destId, { cost: RIP_INFINITY, nextHop: null, interfaceLinkId: null, hops: Infinity });
        }
      }

      vectors.set(node.id, nodeTable);
    }

    let iterations = 0;
    let converged = false;

    // Simulate iterative rounds of vector exchanges
    while (iterations < maxRounds && !converged) {
      iterations++;
      let anyChange = false;

      // Create snapshot of tables before this round
      const snapshot = new Map();
      for (const [nodeId, table] of vectors) {
        const copy = new Map();
        for (const [dest, entry] of table) {
          copy.set(dest, { ...entry });
        }
        snapshot.set(nodeId, copy);
      }

      // Each node receives advertisement from its active direct neighbors
      for (const node of activeNodes) {
        const u = node.id;
        const uTable = vectors.get(u);

        // Find active neighbors of u
        const neighborEdges = linkList.filter(
          l => l.status !== 'down' &&
               ((l.sourceId === u && nodeMap.get(l.targetId)?.status !== 'failed') ||
                (l.targetId === u && nodeMap.get(l.sourceId)?.status !== 'failed'))
        );

        for (const edge of neighborEdges) {
          const v = edge.sourceId === u ? edge.targetId : edge.sourceId;
          const vSnapshot = snapshot.get(v);
          if (!vSnapshot) continue;

          const edgeCost = 1; // 1 hop

          // Inspect each route advertised by neighbor v
          for (const [destId, vEntry] of vSnapshot) {
            if (destId === u) continue; // Don't learn route to ourselves

            let advertisedCost = vEntry.cost;

            // Split Horizon with Poison Reverse
            if (splitHorizon) {
              if (vEntry.nextHop === u) {
                if (poisonReverse) {
                  advertisedCost = RIP_INFINITY; // Poisoned reverse
                } else {
                  continue; // Simple split horizon: suppress advertisement
                }
              }
            }

            const currentEntry = uTable.get(destId) || { cost: RIP_INFINITY, nextHop: null, interfaceLinkId: null, hops: Infinity };
            const newCost = Math.min(RIP_INFINITY, advertisedCost + edgeCost);

            // Bellman-Ford update rule:
            // 1. If lower cost found, adopt new nextHop
            // 2. If same nextHop is updating cost (even if higher, up to infinity), must update!
            const isBetter = newCost < currentEntry.cost;
            const isSameNextHopChanged = currentEntry.nextHop === v && Math.abs(newCost - currentEntry.cost) > 0.001;

            if (isBetter || isSameNextHopChanged) {
              if (Math.abs(newCost - currentEntry.cost) > 0.001 || currentEntry.nextHop !== v) {
                anyChange = true;
                uTable.set(destId, {
                  cost: newCost,
                  nextHop: newCost < RIP_INFINITY ? v : null,
                  interfaceLinkId: newCost < RIP_INFINITY ? edge.id : null,
                  hops: newCost < RIP_INFINITY ? (vEntry.hops || 1) + 1 : Infinity
                });
              }
            }
          }
        }
      }

      if (!anyChange) {
        converged = true;
        break;
      }
    }

    // Format final routing tables
    const routingTables = new Map();
    for (const [nodeId, table] of vectors) {
      const entries = [];
      for (const [destId, entry] of table) {
        if (destId !== nodeId && entry.cost < RIP_INFINITY && entry.nextHop) {
          const destNode = nodeMap.get(destId);
          entries.push({
            destinationId: destId,
            destinationIp: destNode ? destNode.ip : '',
            nextHopId: entry.nextHop,
            allNextHops: [entry.nextHop],
            cost: entry.cost,
            interfaceLinkId: entry.interfaceLinkId,
            hops: entry.hops
          });
        }
      }
      routingTables.set(nodeId, entries);
    }

    return { routingTables, iterations, converged };
  }
}
