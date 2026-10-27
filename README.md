# NetSim — Interactive Network & Distributed Systems Simulator

> **Difficulty:** 8.5/10 · **Status:** Production-Ready & Fully Tested  
> **Interactive Live Technical Demo:** Routing Algorithms, TCP Congestion Control, Chaos Engineering, and Real-Time Network Telemetry.

---

## 🌟 What is NetSim?

**NetSim** is a visual, real-time interactive simulator for computer networks and distributed systems. It simulates packet routing, latency, packet loss, queue bufferbloat, node/link failures, and TCP congestion control, allowing you to observe how protocols and distributed topologies react in real time.

Built with high-performance HTML5 Canvas (60 FPS), modern responsive glassmorphism UI, and an exact discrete-event mathematical simulation engine in TypeScript/JavaScript.

---

## 🚀 Key Features

### 1. 🧭 Routing Engines & Strategy Comparison
- **Dijkstra's Shortest Path First (SPF / OSPF style)**:
  - Computes optimal paths based on physical link propagation latency.
  - Dynamically recalculates routes when nodes fail or links are cut.
- **Distance-Vector Routing (Bellman-Ford / RIP style)**:
  - Simulates distributed routing table exchanges between adjacent neighbors.
  - Implements **Split Horizon** and **Poison Reverse** to eliminate routing loops and the count-to-infinity problem.
- **Equal-Cost Multi-Path (ECMP)**:
  - Splits traffic evenly across parallel equal-cost paths (essential for datacenter spine-leaf fabrics).
- **Dynamic Congestion-Aware Routing**:
  - Automatically adjusts edge metrics as router queues fill up, deflecting packets away from congested bottleneck links.

### 2. ⚡ Full TCP Congestion Control (Reno / NewReno Model)
- **Slow Start**: Exponential `cwnd` window growth ($+1\text{ MSS}$ per received ACK) doubling every RTT.
- **Congestion Avoidance (AIMD)**: Linear additive increase ($+1/\lfloor cwnd \rfloor$ per ACK) once `cwnd >= ssthresh`.
- **Fast Retransmit & Fast Recovery**:
  - Triggers on 3 duplicate ACKs without waiting for a retransmission timeout.
  - Multiplicative decrease: $ssthresh = \max(\lfloor cwnd / 2 \rfloor, 2)$, $cwnd = ssthresh + 3$.
  - Immediately retransmits the missing segment.
- **Retransmission Timeout (RTO)**:
  - Exponential backoff ($RTO \leftarrow \min(RTO \times 1.8, 5000\text{ms})$).
  - Resets $cwnd \leftarrow 1.0$ and enters Slow Start.
- **Jacobson’s EWMA Round-Trip Time Estimation**:
  - Exponential weighted moving averages: $SRTT = (1-\alpha)SRTT + \alpha RTT_{sample}$, $RTTVAR = (1-\beta)RTTVAR + \beta|SRTT - RTT_{sample}|$, $RTO = SRTT + 4 \times RTTVAR$.
- **Live Sawtooth Chart**: Real-time canvas plot visualizing the classic TCP `cwnd` sawtooth curve, `ssthresh`, and in-flight segments.

### 3. 💥 Chaos Engineering & Fault Injection
- **Node Kills & Revivals**: Toggle any computer, router, or server offline; observe instant Dijkstra route re-convergence.
- **Cable Cutting & Restoration**: Sever links mid-stream to trigger packet drops and dynamic rerouting.
- **Link Degradation**: Introduce high packet loss (15%+) and elevated latency to test protocol resilience.
- **Queue Bufferbloat & Overflow**: Throttle link bandwidth to watch router buffer queues fill up and tail-drop packets.

### 4. 📊 Real-Time Telemetry & Wireshark-Style Sniffer
- **Network Operations Center (NOC) HUD**:
  - Live Throughput (Mbps)
  - Average Latency (ms)
  - Global Packet Loss Rate (%)
  - In-Flight Packets & Buffered Segments
- **Wireshark-like Packet Sniffer**:
  - Filterable by protocol (`ALL`, `TCP`, `UDP`, `ICMP`, `Drops`).
  - Searchable by IP address, sequence number, or failure reason.
  - JSON export for external packet trace analysis.

---

## 🏛️ Pre-built Network Topologies

1. **ISP Backbone & Mesh Core**: Tier-1 ISP core with redundant multi-paths, edge routers, and cloud server backends.
2. **Spine-Leaf Modern Datacenter**: Two-tier fabric with ECMP multi-path load balancing between spine and leaf switches.
3. **Bottleneck Router & Bufferbloat Lab**: High-speed LAN connected to a narrow 5 Mbps bottleneck link with deep buffer queue. Demonstrates queue buildup, latency inflation, and TCP sawtooth oscillations.
4. **Redundant Failover Ring**: 6-node ring topology. Cut any cable or router and observe immediate automatic reroute around the opposite side of the ring.
5. **CDN Edge vs Origin Server**: Illustrates latency divergence between local CDN edge caches and authoritative high-latency trans-oceanic origin servers.

---

## 🎮 Interactive Controls

| Interaction | Action |
|-------------|--------|
| **Click Node** | Selects node and opens **Node Inspector** (IP routing table, status, traffic counters). |
| **Click Link** | Selects transmission cable and opens **Link Inspector** with live sliders. |
| **Drag Node** | Repositions node on canvas; links and packets follow dynamically. |
| **Shift + Drag** | Drag from one node to another to draw and connect a brand new link! |
| **Scroll Wheel** | Smooth zoom in / out centered around the cursor position. |
| **Drag Canvas** | Pan the canvas view. |
| **Play / Pause** | Toggle simulation clock. |
| **Step Tick** | Advance simulation frame-by-frame (great for teaching and packet inspection). |
| **Speed Select** | 0.25x, 0.5x, 1x, 2x, 5x speed modifiers. |

---

## 🛠️ Getting Started

### Method 1: 1-Click Launch (Windows)
Double-click `run.bat` in the project directory:
```
run.bat
```
This automatically starts the local HTTP server and opens `http://localhost:3000` in your default browser.

### Method 2: Node.js Command Line
```bash
# Navigate to the project directory
cd netsim

# Start the server
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Unit Test Suite

NetSim includes an automated test suite verifying routing convergence, shortest-path calculation, and TCP state transitions:

```bash
node --test test/*.test.js
```

### Verified Test Cases:
- ✔ **Dijkstra SPF**: Computes lowest-latency path across mesh network.
- ✔ **Dijkstra Dynamic Failover**: Recalculates alternate route when an intermediate router goes down.
- ✔ **Dijkstra ECMP**: Identifies all equal-cost next hops for multi-path load balancing.
- ✔ **Distance-Vector Convergence**: Verifies Bellman-Ford stability and hop metrics.
- ✔ **TCP Slow Start**: Confirms exponential window growth.
- ✔ **TCP Congestion Avoidance**: Confirms additive increase (AIMD).
- ✔ **TCP Fast Retransmit**: Validates 3-duplicate ACK detection, halving of `ssthresh`, and immediate packet resend.
- ✔ **TCP RTO Timeout**: Validates window collapse to 1 MSS, return to Slow Start, and exponential backoff.

---

## 📁 Project Structure

```
netsim/
├── server.js               # Zero-dependency Node.js HTTP server
├── index.html              # Main simulation dashboard & layout
├── run.bat                 # 1-click launcher for Windows
├── README.md               # Documentation & architectural guide
├── css/
│   └── styles.css          # Cyberpunk / NOC glassmorphism styling
├── js/
│   ├── types.js            # Shared types, protocol definitions, packet colors
│   ├── app.js              # Application controller & 60 FPS loop
│   ├── engine/
│   │   ├── dijkstra.js       # Dijkstra SPF & ECMP routing engine
│   │   ├── distanceVector.js # Bellman-Ford Distance Vector with Split Horizon
│   │   ├── tcpEngine.js      # TCP Reno / AIMD / Fast Retransmit / RTO engine
│   │   ├── simulator.js      # Discrete tick simulator & event pipeline
│   │   └── presets.js        # 5 Network topology presets
│   └── ui/
│       ├── canvasRenderer.js # HTML5 Canvas 2D engine (nodes, cables, queues)
│       ├── tcpChart.js       # Real-time TCP cwnd sawtooth chart
│       ├── packetLog.js      # Wireshark-like event sniffer & filter
│       └── inspector.js      # Inspector tabs, sliders, and chaos controls
└── test/
    ├── dijkstra.test.js      # SPF & ECMP unit tests
    ├── distanceVector.test.js# Bellman-Ford convergence tests
    └── tcpEngine.test.js     # TCP Reno state machine tests
```

---

*Designed and engineered with passion for systems programming, distributed algorithms, and interactive technical demonstrations.*
