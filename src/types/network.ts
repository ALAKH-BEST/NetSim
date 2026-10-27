export type NodeType = 'client' | 'router' | 'server' | 'switch';

export type NodeStatus = 'online' | 'failed' | 'congested';

export type LinkStatus = 'up' | 'down' | 'degraded';

export type ProtocolType = 'TCP' | 'UDP' | 'ICMP' | 'ROUTING';

export type PacketType =
  | 'TCP_SYN'
  | 'TCP_SYN_ACK'
  | 'TCP_ACK'
  | 'TCP_DATA'
  | 'TCP_FIN'
  | 'TCP_RST'
  | 'UDP_DATA'
  | 'ICMP_ECHO_REQ'
  | 'ICMP_ECHO_REP'
  | 'ICMP_TIME_EXCEEDED'
  | 'ROUTING_UPDATE';

export type RoutingAlgorithm = 'dijkstra' | 'distance_vector' | 'ecmp' | 'congestion_aware';

export interface RouteEntry {
  destinationId: string;
  destinationIp: string;
  nextHopId: string;
  cost: number;
  interfaceLinkId: string;
  hops: number;
}

export interface NodeStats {
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
  bytesTransferred: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: NodeType;
  ip: string;
  x: number;
  y: number;
  status: NodeStatus;
  stats: NodeStats;
  routingTable: RouteEntry[];
  icon?: string;
  customColor?: string;
  label?: string;
}

export interface LinkStats {
  totalPackets: number;
  droppedPackets: number;
  currentUtilization: number; // 0 to 100%
  totalBytes: number;
}

export interface NetworkLink {
  id: string;
  sourceId: string;
  targetId: string;
  bandwidthMbps: number;    // Capacity in Mbps (e.g. 10 Mbps)
  latencyMs: number;        // Propagation delay in ms (e.g. 25ms)
  lossRate: number;         // 0.0 to 1.0 (packet loss probability, e.g. 0.02 = 2%)
  queueCapacity: number;    // Max buffer size in packets (e.g. 12)
  queue: Packet[];          // Packets queued waiting to be transmitted onto wire
  status: LinkStatus;
  stats: LinkStats;
}

export interface Packet {
  id: string;
  type: PacketType;
  protocol: ProtocolType;
  sourceId: string;
  targetId: string;         // Current hop target
  finalDestId: string;      // Eventual destination
  sourceIp: string;
  destIp: string;
  payloadSize: number;      // In bytes, e.g. 1500
  ttl: number;              // Time to live (decremented each hop)
  progress: number;         // 0.0 (source) to 1.0 (target) along the current link
  currentLinkId: string;
  direction: 'source_to_target' | 'target_to_source';
  pathTaken: string[];      // Node IDs visited
  createdAt: number;        // Sim timestamp
  color?: string;
  label?: string;
  seq?: number;
  ack?: number;
  tcpSessionId?: string;
  isRetransmission?: boolean;
}

export type TcpCongestionPhase = 'SlowStart' | 'CongestionAvoidance' | 'FastRecovery' | 'TimeoutRecovery';

export interface TcpHistoryPoint {
  time: number;
  cwnd: number;
  ssthresh: number;
  inFlight: number;
  rtt: number;
}

export interface TCPSession {
  id: string;
  sourceNodeId: string;
  destNodeId: string;
  state: 'LISTEN' | 'SYN_SENT' | 'SYN_RCVD' | 'ESTABLISHED' | 'FIN_WAIT' | 'CLOSED';
  cwnd: number;             // Congestion window (in packets/segments)
  ssthresh: number;         // Slow start threshold (in packets)
  unackedPackets: Map<number, { packet: Packet; sentAt: number }>;
  nextSeqNum: number;
  expectedAckNum: number;
  dupAckCount: number;
  rttEstimated: number;     // Exponential weighted moving average RTT (ms)
  rto: number;              // Retransmission Timeout (ms)
  phase: TcpCongestionPhase;
  totalBytesSent: number;
  totalBytesAcked: number;
  history: TcpHistoryPoint[];
  active: boolean;
  flowType: 'continuous' | 'file_transfer';
  remainingBytes: number;
}

export interface SimulationEvent {
  id: string;
  time: number;
  protocol: ProtocolType;
  sourceId: string;
  destId: string;
  type: PacketType;
  message: string;
  severity: 'info' | 'warn' | 'error' | 'success';
}

export interface NetworkMetrics {
  totalPacketsSent: number;
  totalPacketsDelivered: number;
  totalPacketsDropped: number;
  globalDropRate: number;      // %
  avgLatencyMs: number;
  currentThroughputMbps: number;
  activePacketsInFlight: number;
  activeLinksCount: number;
  activeNodesCount: number;
  bufferbloatEvents: number;
}
