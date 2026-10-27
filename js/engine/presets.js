/**
 * Network Topologies & Architectural Presets for NetSim
 */

export const TOPOLOGY_PRESETS = {
  'isp_mesh': {
    name: 'ISP Backbone & Mesh Core',
    description: 'Tier-1 ISP mesh with redundant paths, edge routers, and cloud servers. Tests Dijkstra SPF and link failovers.',
    nodes: [
      { id: 'c1', name: 'Client A', type: 'client', ip: '192.168.1.10', x: 80, y: 150 },
      { id: 'c2', name: 'Client B', type: 'client', ip: '192.168.1.20', x: 80, y: 380 },
      { id: 'r_edge1', name: 'Edge Router 1', type: 'router', ip: '10.0.1.1', x: 260, y: 260 },
      { id: 'r_core1', name: 'Core Router North', type: 'router', ip: '10.10.1.1', x: 450, y: 140 },
      { id: 'r_core2', name: 'Core Router South', type: 'router', ip: '10.10.2.1', x: 450, y: 380 },
      { id: 'r_edge2', name: 'Edge Router 2', type: 'router', ip: '10.0.2.1', x: 650, y: 260 },
      { id: 'srv_web', name: 'Web Server', type: 'server', ip: '172.16.0.10', x: 830, y: 180 },
      { id: 'srv_db', name: 'Database Server', type: 'server', ip: '172.16.0.20', x: 830, y: 340 }
    ],
    links: [
      { id: 'l1', sourceId: 'c1', targetId: 'r_edge1', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 20 },
      { id: 'l2', sourceId: 'c2', targetId: 'r_edge1', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 20 },
      // Redundant core links
      { id: 'l3', sourceId: 'r_edge1', targetId: 'r_core1', bandwidthMbps: 40, latencyMs: 15, lossRate: 0.0, queueCapacity: 15 },
      { id: 'l4', sourceId: 'r_edge1', targetId: 'r_core2', bandwidthMbps: 40, latencyMs: 25, lossRate: 0.0, queueCapacity: 15 },
      { id: 'l5', sourceId: 'r_core1', targetId: 'r_core2', bandwidthMbps: 100, latencyMs: 10, lossRate: 0.0, queueCapacity: 20 },
      { id: 'l6', sourceId: 'r_core1', targetId: 'r_edge2', bandwidthMbps: 40, latencyMs: 18, lossRate: 0.0, queueCapacity: 15 },
      { id: 'l7', sourceId: 'r_core2', targetId: 'r_edge2', bandwidthMbps: 40, latencyMs: 20, lossRate: 0.0, queueCapacity: 15 },
      // Servers
      { id: 'l8', sourceId: 'r_edge2', targetId: 'srv_web', bandwidthMbps: 100, latencyMs: 4, lossRate: 0.0, queueCapacity: 25 },
      { id: 'l9', sourceId: 'r_edge2', targetId: 'srv_db', bandwidthMbps: 100, latencyMs: 4, lossRate: 0.0, queueCapacity: 25 }
    ]
  },

  'spine_leaf': {
    name: 'Spine-Leaf Datacenter (ECMP)',
    description: 'Modern two-tier datacenter fabric demonstrating Equal-Cost Multi-Path (ECMP) routing and line-rate switching.',
    nodes: [
      { id: 'spine1', name: 'Spine Switch 1', type: 'switch', ip: '10.250.0.1', x: 380, y: 120 },
      { id: 'spine2', name: 'Spine Switch 2', type: 'switch', ip: '10.250.0.2', x: 560, y: 120 },
      { id: 'leaf1', name: 'Leaf Switch 1', type: 'switch', ip: '10.250.1.1', x: 260, y: 280 },
      { id: 'leaf2', name: 'Leaf Switch 2', type: 'switch', ip: '10.250.1.2', x: 680, y: 280 },
      { id: 'srv1', name: 'App Server A', type: 'server', ip: '10.1.1.11', x: 180, y: 440 },
      { id: 'srv2', name: 'App Server B', type: 'server', ip: '10.1.1.12', x: 320, y: 440 },
      { id: 'srv3', name: 'DB Server Primary', type: 'server', ip: '10.1.2.21', x: 620, y: 440 },
      { id: 'srv4', name: 'DB Replica', type: 'server', ip: '10.1.2.22', x: 760, y: 440 }
    ],
    links: [
      // Leaf 1 to Spines
      { id: 'sl1', sourceId: 'leaf1', targetId: 'spine1', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 25 },
      { id: 'sl2', sourceId: 'leaf1', targetId: 'spine2', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 25 },
      // Leaf 2 to Spines
      { id: 'sl3', sourceId: 'leaf2', targetId: 'spine1', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 25 },
      { id: 'sl4', sourceId: 'leaf2', targetId: 'spine2', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 25 },
      // End-hosts to Leafs
      { id: 'es1', sourceId: 'srv1', targetId: 'leaf1', bandwidthMbps: 100, latencyMs: 2, lossRate: 0.0, queueCapacity: 25 },
      { id: 'es2', sourceId: 'srv2', targetId: 'leaf1', bandwidthMbps: 100, latencyMs: 2, lossRate: 0.0, queueCapacity: 25 },
      { id: 'es3', sourceId: 'srv3', targetId: 'leaf2', bandwidthMbps: 100, latencyMs: 2, lossRate: 0.0, queueCapacity: 25 },
      { id: 'es4', sourceId: 'srv4', targetId: 'leaf2', bandwidthMbps: 100, latencyMs: 2, lossRate: 0.0, queueCapacity: 25 }
    ]
  },

  'bufferbloat': {
    name: 'Bottleneck Router & Bufferbloat Lab',
    description: 'High-speed gigabit LAN funneling into a low-bandwidth high-latency bottleneck. Visualizes queue buildup and TCP sawtooth.',
    nodes: [
      { id: 'host1', name: 'High-Speed Client', type: 'client', ip: '192.168.1.5', x: 100, y: 260 },
      { id: 'r_lan', name: 'Gigabit LAN Gateway', type: 'router', ip: '192.168.1.1', x: 280, y: 260 },
      { id: 'r_bottleneck', name: 'Bottleneck WAN Router', type: 'router', ip: '10.0.0.1', x: 500, y: 260 },
      { id: 'r_dest', name: 'Datacenter Gateway', type: 'router', ip: '10.0.0.2', x: 720, y: 260 },
      { id: 'srv_remote', name: 'Cloud Video Host', type: 'server', ip: '104.20.12.9', x: 880, y: 260 }
    ],
    links: [
      { id: 'bb1', sourceId: 'host1', targetId: 'r_lan', bandwidthMbps: 100, latencyMs: 2, lossRate: 0.0, queueCapacity: 30 },
      // The Bottleneck Link: low bandwidth (5 Mbps), high latency (50ms), large queue (20 packets)
      { id: 'bb2', sourceId: 'r_lan', targetId: 'r_bottleneck', bandwidthMbps: 5, latencyMs: 50, lossRate: 0.01, queueCapacity: 18 },
      { id: 'bb3', sourceId: 'r_bottleneck', targetId: 'r_dest', bandwidthMbps: 10, latencyMs: 20, lossRate: 0.0, queueCapacity: 20 },
      { id: 'bb4', sourceId: 'r_dest', targetId: 'srv_remote', bandwidthMbps: 100, latencyMs: 3, lossRate: 0.0, queueCapacity: 30 }
    ]
  },

  'failover_ring': {
    name: 'Redundant Failover Ring (Chaos Lab)',
    description: 'Resilient ring topology. Kill any router or link to observe dynamic Dijkstra SPF rerouting and TCP session survival.',
    nodes: [
      { id: 'node_a', name: 'Client Node', type: 'client', ip: '10.1.0.1', x: 140, y: 260 },
      { id: 'node_b', name: 'Router Ring 1', type: 'router', ip: '10.1.1.1', x: 300, y: 130 },
      { id: 'node_c', name: 'Router Ring 2', type: 'router', ip: '10.1.2.1', x: 580, y: 130 },
      { id: 'node_d', name: 'Target Server', type: 'server', ip: '10.1.3.1', x: 740, y: 260 },
      { id: 'node_e', name: 'Router Ring 4', type: 'router', ip: '10.1.4.1', x: 580, y: 390 },
      { id: 'node_f', name: 'Router Ring 5', type: 'router', ip: '10.1.5.1', x: 300, y: 390 }
    ],
    links: [
      { id: 'ring1', sourceId: 'node_a', targetId: 'node_b', bandwidthMbps: 50, latencyMs: 12, lossRate: 0.0, queueCapacity: 15 },
      { id: 'ring2', sourceId: 'node_b', targetId: 'node_c', bandwidthMbps: 50, latencyMs: 12, lossRate: 0.0, queueCapacity: 15 },
      { id: 'ring3', sourceId: 'node_c', targetId: 'node_d', bandwidthMbps: 50, latencyMs: 12, lossRate: 0.0, queueCapacity: 15 },
      { id: 'ring4', sourceId: 'node_d', targetId: 'node_e', bandwidthMbps: 50, latencyMs: 14, lossRate: 0.0, queueCapacity: 15 },
      { id: 'ring5', sourceId: 'node_e', targetId: 'node_f', bandwidthMbps: 50, latencyMs: 14, lossRate: 0.0, queueCapacity: 15 },
      { id: 'ring6', sourceId: 'node_f', targetId: 'node_a', bandwidthMbps: 50, latencyMs: 14, lossRate: 0.0, queueCapacity: 15 }
    ]
  },

  'cdn_origin': {
    name: 'CDN Edge vs Origin Server',
    description: 'Visualizes content routing between low-latency local edge caches and authoritative high-latency origin servers.',
    nodes: [
      { id: 'user1', name: 'End User Tokyo', type: 'client', ip: '192.168.10.1', x: 100, y: 260 },
      { id: 'gw', name: 'Regional Gateway', type: 'router', ip: '118.27.0.1', x: 300, y: 260 },
      { id: 'edge', name: 'CDN Edge (Tokyo)', type: 'server', ip: '118.27.100.1', x: 500, y: 150 },
      { id: 'transoceanic', name: 'Trans-Pacific Link', type: 'router', ip: '12.0.0.1', x: 550, y: 370 },
      { id: 'origin', name: 'Origin Server (US-East)', type: 'server', ip: '54.239.28.85', x: 800, y: 370 }
    ],
    links: [
      { id: 'cdn1', sourceId: 'user1', targetId: 'gw', bandwidthMbps: 100, latencyMs: 5, lossRate: 0.0, queueCapacity: 20 },
      { id: 'cdn2', sourceId: 'gw', targetId: 'edge', bandwidthMbps: 80, latencyMs: 8, lossRate: 0.0, queueCapacity: 20 },
      { id: 'cdn3', sourceId: 'gw', targetId: 'transoceanic', bandwidthMbps: 40, latencyMs: 40, lossRate: 0.0, queueCapacity: 20 },
      { id: 'cdn4', sourceId: 'transoceanic', targetId: 'origin', bandwidthMbps: 40, latencyMs: 110, lossRate: 0.01, queueCapacity: 20 }
    ]
  }
};
