/**
 * Dijkstra's Shortest Path First (SPF) Routing Algorithm
 * Models OSPF / Link-State Routing with support for latency metrics,
 * hop counts, dynamic congestion awareness, and ECMP (Equal-Cost Multi-Path).
 */

export class DijkstraRouter {
  /**
   * Computes shortest paths from a source node to all other nodes in the network.
   * @param {string} sourceId
   * @param {Map<string, Object>|Array<Object>} nodes
   * @param {Map<string, Object>|Array<Object>} links
   * @param {'latency'|'hops'|'dynamic'} metricMode
   * @returns {{ distances: Record<string, number>, previous: Record<string, string[]>, linksUsed: Record<string, string> }}
   */
  static computeShortestPaths(sourceId, nodes, links, metricMode = 'latency') {
    const nodeMap = Array.isArray(nodes) ? new Map(nodes.map(n => [n.id, n])) : nodes;
    const linkList = Array.isArray(links) ? links : Array.from(links.values());

    const distances = {};
    const previous = {};       // Stores array of predecessors for ECMP
    const linksUsed = {};      // Link ID connecting predecessor to node
    const unvisited = new Set();

    // Check if source node itself is online
    const sourceNode = nodeMap.get(sourceId);
    if (!sourceNode || sourceNode.status === 'failed') {
      return { distances, previous, linksUsed };
    }

    // Build adjacency graph of usable (online) links and nodes
    const adj = new Map();
    for (const [id, node] of nodeMap) {
      if (node.status !== 'failed') {
        adj.set(id, []);
        distances[id] = Infinity;
        previous[id] = [];
        unvisited.add(id);
      }
    }

    if (!adj.has(sourceId)) {
      return { distances, previous, linksUsed };
    }

    distances[sourceId] = 0;

    for (const link of linkList) {
      if (link.status === 'down') continue;
      const u = link.sourceId;
      const v = link.targetId;

      // Both endpoint nodes must be online
      const uNode = nodeMap.get(u);
      const vNode = nodeMap.get(v);
      if (!uNode || !vNode || uNode.status === 'failed' || vNode.status === 'failed') {
        continue;
      }

      // Calculate weight based on chosen metric
      let weight = 1;
      if (metricMode === 'latency') {
        weight = Math.max(1, link.latencyMs);
      } else if (metricMode === 'hops') {
        weight = 1;
      } else if (metricMode === 'dynamic') {
        const queueOccupancy = (link.queue?.length || 0) / Math.max(1, link.queueCapacity || 10);
        // Base latency + penalty for congested buffer queue
        weight = Math.max(1, link.latencyMs * (1 + queueOccupancy * 3.5));
      }

      if (adj.has(u)) adj.get(u).push({ neighbor: v, weight, linkId: link.id });
      if (adj.has(v)) adj.get(v).push({ neighbor: u, weight, linkId: link.id });
    }

    while (unvisited.size > 0) {
      // Find unvisited node with lowest distance
      let current = null;
      let minDistance = Infinity;

      for (const node of unvisited) {
        if (distances[node] < minDistance) {
          minDistance = distances[node];
          current = node;
        }
      }

      if (current === null || minDistance === Infinity) {
        break; // All remaining nodes are unreachable
      }

      unvisited.delete(current);

      const neighbors = adj.get(current) || [];
      for (const edge of neighbors) {
        if (!unvisited.has(edge.neighbor)) continue;

        const altDistance = distances[current] + edge.weight;
        const currentDistance = distances[edge.neighbor];

        // Strict improvement
        if (altDistance < currentDistance - 0.001) {
          distances[edge.neighbor] = altDistance;
          previous[edge.neighbor] = [current];
          linksUsed[edge.neighbor] = edge.linkId;
        }
        // Equal cost path (ECMP)
        else if (Math.abs(altDistance - currentDistance) <= 0.001) {
          if (!previous[edge.neighbor].includes(current)) {
            previous[edge.neighbor].push(current);
          }
        }
      }
    }

    return { distances, previous, linksUsed };
  }

  /**
   * Builds the routing table for all online nodes.
   * @param {Map<string, Object>|Array<Object>} nodes
   * @param {Map<string, Object>|Array<Object>} links
   * @param {'latency'|'hops'|'dynamic'} metricMode
   * @returns {Map<string, Array<Object>>} Map from nodeId -> RouteEntry[]
   */
  static buildAllRoutingTables(nodes, links, metricMode = 'latency') {
    const nodeMap = Array.isArray(nodes) ? new Map(nodes.map(n => [n.id, n])) : nodes;
    const linkList = Array.isArray(links) ? links : Array.from(links.values());
    const linkMap = new Map(linkList.map(l => [l.id, l]));

    const routingTables = new Map();

    for (const [nodeId, node] of nodeMap) {
      if (node.status === 'failed') {
        routingTables.set(nodeId, []);
        continue;
      }

      const { distances, previous, linksUsed } = this.computeShortestPaths(nodeId, nodeMap, linkList, metricMode);
      const table = [];

      for (const [destId, destNode] of nodeMap) {
        if (destId === nodeId || destNode.status === 'failed') continue;

        const distance = distances[destId];
        if (distance === undefined || distance === Infinity) continue;

        // Trace back next hop from source to destination
        const paths = this.extractPaths(nodeId, destId, previous);
        if (paths.length === 0) continue;

        // Collect all distinct next hops for ECMP
        const nextHops = [...new Set(paths.map(p => p[1]))].filter(Boolean);
        const primaryNextHop = nextHops[0];

        // Find interface link connecting source to next hop
        const directLink = linkList.find(
          l => l.status !== 'down' &&
               ((l.sourceId === nodeId && l.targetId === primaryNextHop) ||
                (l.targetId === nodeId && l.sourceId === primaryNextHop))
        );

        table.push({
          destinationId: destId,
          destinationIp: destNode.ip,
          nextHopId: primaryNextHop,
          allNextHops: nextHops,
          cost: Math.round(distance * 10) / 10,
          interfaceLinkId: directLink ? directLink.id : '',
          hops: paths[0].length - 1
        });
      }

      routingTables.set(nodeId, table);
    }

    return routingTables;
  }

  /**
   * Extracts all paths from source to dest given the predecessor map.
   * @private
   */
  static extractPaths(sourceId, destId, previous) {
    const paths = [];

    function backtrack(curr, currentPath) {
      if (curr === sourceId) {
        paths.push([sourceId, ...currentPath]);
        return;
      }
      const preds = previous[curr] || [];
      for (const p of preds) {
        backtrack(p, [curr, ...currentPath]);
      }
    }

    backtrack(destId, []);
    return paths;
  }
}
