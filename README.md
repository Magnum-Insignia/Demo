# OrbisNet

Predictive cyber-defence monitoring, powered by the **NAGA-Net** engine.

OrbisNet learns how a network's state evolves, rolls that forward K steps, and
tells a defender where the network is heading — mapped to MITRE ATT&CK stages,
with the features driving every prediction on screen beside it.

It is a **monitor**, not an actor. It never touches the network. Its controller
produces a prioritised action plan; a named human authorises each item and runs
it in their own tooling.

## Layout

```
.
├── backend/                 The backend host (Node, zero dependencies)
│   ├── server.js              HTTP + SSE API, and serves the web fallback
│   └── Dockerfile
├── desktop-app/             Electron + React desktop application
│   └── src/
│       ├── main/              Electron main process
│       ├── preload/           Electron preload script
│       └── renderer/src/
│           ├── backend/       API surface, transport, operation map, services
│           ├── auth/          Login, step-up verification, roles/permissions
│           ├── charts/        Shared chart theming
│           ├── components/    Shared UI (header, sidebar, icons)
│           ├── frames/        Modules (dashboard, topology, simulation, …)
│           ├── hooks/
│           └── theme/
├── docker-compose.yml
├── baseplan.md              Requirements
└── IMPLEMENTATION_PLAN.md   Build plan and current status
```

## The backend seam

Every module reads and writes through `renderer/src/backend/index.js` and
nothing else. The operation map behind it
(`renderer/src/backend/operations.js`) has **two** callers: the app's transport,
and `backend/server.js`. One definition, two entry points — so the backend host
and the app's on-device fallback cannot disagree.

That gives two supported ways to run, with no second code path and no second
implementation:

| Mode | When | Header reads |
|---|---|---|
| **Hosted** | The backend host is reachable | `Backend live` |
| **On-device** | Air-gapped, or the host is down mid-demo | `On-device` |

The app connects and pulls a snapshot before first paint, so no view needs a
loading state, and a host that disappears mid-session degrades to on-device
rather than to a dead screen.

## Running it

**Prerequisites:** Node.js 20+, npm, Git. Docker Desktop only for the
containerised flows.

```bash
# the repository is still named OcuNet_SysApp on GitHub -- the product rename
# has not been applied to the remote
git clone https://github.com/Magnum-Insignia/OcuNet_SysApp.git
cd OcuNet_SysApp/desktop-app
npm install
```

### Desktop application against the backend host

```bash
# terminal 1 — the backend host
cd desktop-app && npm run backend        # http://127.0.0.1:8787

# terminal 2 — the desktop application
cd desktop-app && npm run dev
```

Without terminal 1 the application still starts, in on-device mode.

### Web fallback (the backup interface)

```bash
cd desktop-app && npm run web            # builds, then serves on :8787
```

Open `http://127.0.0.1:8787`. Same renderer, same backend, served locally —
nothing leaves the machine.

### Containerised

```bash
docker compose up --build backend        # backend + web fallback on :8787
docker compose --profile dev up frontend-dev   # renderer dev server on :5173
```

## Real capture data

The demo runs on the official **CSE-CIC-IDS2018** processed-flow CSVs, extracted
by `pipeline/`. Nothing about the captures is generated.

```bash
# fetch the days (about 1 GB, skipped if data/raw is already populated)
python -m pipeline.run extract-all          # one capture per day, never stitched
python -m pipeline.run report               # the checks below, printed
python -m pipeline.export_backend           # -> backend service module
```

Two properties of the extraction are worth knowing, because getting either
wrong produces data that passes a schema check and is still worthless:

**The timestamps are 12-hour with no AM/PM marker.** The official CSVs record a
14:04 flow as `02:04:56`. Parsed literally, every afternoon attack lands at 2am
and the durations collapse to minutes. `pipeline/cicids.py` reconstructs the
24-hour clock, and only then do the episodes match the published schedule:

| Capture | Episodes (extracted) |
|---|---|
| 02-14-2018 | FTP-BruteForce **98 min**, SSH-Bruteforce **92 min** |
| 02-15-2018 | DoS-GoldenEye in 4 bursts (5/4/9/1 min), DoS-Slowloris **43 min** |
| 02-16-2018 | DoS-SlowHTTPTest **47 min**, DoS-Hulk **4 min** |

**Days are separate captures.** Each is one business day with overnight gaps on
either side; they are never concatenated. Benign volume varies 45x, 224x and 18x
across the three days respectively — a flat benign line is a sign of generated
data.

### What the flow CSVs cannot give you

- **Edges.** The Feb-14/15/16 CSVs carry no `Src IP` / `Dst IP` — their first
  column is `Dst Port`. `pipeline/edge_list.py` refuses to build an edge list
  from them rather than inventing endpoints. Days from 20-02-2018 onward do
  include addressing and run through the same function unchanged.
- **Packet features.** TTL variance, fragment flags, window drift and
  retransmission counts are packet properties that flow aggregation has already
  discarded. `has_packet_data` stays `0` until packet extraction actually runs;
  the columns are never zero-filled to look complete.

```bash
python -m pipeline.run pcap --file <capture.pcap>     # from a capture file
python -m pipeline.run capture --seconds 30           # live, passive
```

Live capture needs Npcap (Windows) or `cap_net_raw` (Linux) and elevated
privileges; without them the command says so and extracts nothing.

## Verification

```bash
cd desktop-app
npm run backend &        # host must be up for the first suite
npm run e2e              # 9 checks: connection, all modules × both roles,
                         # mutation reaches the host, evidence bundle +
                         # download, blind-spot drill, RBAC, no page errors
npm run e2e:offline      # 5 checks: kills the host, confirms the app keeps
                         # working on-device and says so
```

## Building a distributable

```bash
cd desktop-app
npm run dist             # -> desktop-app/release3
```

## Tech stack

- Electron, React 19, Vite / electron-vite
- Chart.js, Cytoscape.js (topology graph)
- Node (backend host — no runtime dependencies)
- electron-builder (portable Windows build)
