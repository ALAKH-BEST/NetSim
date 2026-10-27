/**
 * NetSim - Shared Types and Constants
 */

export const NodeTypes = {
  CLIENT: 'client',
  ROUTER: 'router',
  SERVER: 'server',
  SWITCH: 'switch'
};

export const NodeStatuses = {
  ONLINE: 'online',
  FAILED: 'failed',
  CONGESTED: 'congested'
};

export const LinkStatuses = {
  UP: 'up',
  DOWN: 'down',
  DEGRADED: 'degraded'
};

export const ProtocolTypes = {
  TCP: 'TCP',
  UDP: 'UDP',
  ICMP: 'ICMP',
  ROUTING: 'ROUTING'
};

export const PacketTypes = {
  TCP_SYN: 'TCP_SYN',
  TCP_SYN_ACK: 'TCP_SYN_ACK',
  TCP_ACK: 'TCP_ACK',
  TCP_DATA: 'TCP_DATA',
  TCP_FIN: 'TCP_FIN',
  TCP_RST: 'TCP_RST',
  UDP_DATA: 'UDP_DATA',
  ICMP_ECHO_REQ: 'ICMP_ECHO_REQ',
  ICMP_ECHO_REP: 'ICMP_ECHO_REP',
  ICMP_TIME_EXCEEDED: 'ICMP_TIME_EXCEEDED',
  ROUTING_UPDATE: 'ROUTING_UPDATE'
};

export const PacketColors = {
  TCP_SYN: '#ec4899',       // Pink
  TCP_SYN_ACK: '#f43f5e',   // Rose
  TCP_ACK: '#10b981',       // Emerald
  TCP_DATA: '#06b6d4',      // Cyan
  TCP_FIN: '#f59e0b',       // Amber
  TCP_RST: '#ef4444',       // Red
  UDP_DATA: '#8b5cf6',      // Violet
  ICMP_ECHO_REQ: '#fbbf24', // Yellow
  ICMP_ECHO_REP: '#34d399', // Mint
  ICMP_TIME_EXCEEDED: '#e11d48',
  ROUTING_UPDATE: '#6366f1'
};

export const RoutingAlgorithms = {
  DIJKSTRA: 'dijkstra',
  DISTANCE_VECTOR: 'distance_vector',
  ECMP: 'ecmp',
  CONGESTION_AWARE: 'congestion_aware'
};

export function generateId(prefix = 'obj') {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatBps(bps) {
  if (bps === 0) return '0 bps';
  if (bps >= 1_000_000) return (bps / 1_000_000).toFixed(2) + ' Mbps';
  if (bps >= 1_000) return (bps / 1_000).toFixed(2) + ' Kbps';
  return bps.toFixed(0) + ' bps';
}
