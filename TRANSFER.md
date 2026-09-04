# OcuNet / NAGA-Net — Transfer Document

Handoff for an AI agent (Claude Code / Opus) or engineer taking over this repo.
Read this fully before changing anything. It covers what the system is, what is
**real vs authored**, how to bring it up, how to produce data, how to reproduce
the simulations, and how to manage traffic.

Repo remotes:
- `origin` → https://github.com/aadithyamahadev/OcuNet_SysApp
- `demo`   → https://github.com/Magnum-Insignia/Demo  (public)

Baseline at time of writing: commit `f1b71b8`. Primary working dir:
`C:\Users\admin\OcuNet_SysApp`. Platform: Windows 11, PowerShell + Git Bash.

---

## 1. What this is

A predictive network-defence product built to the brief in `baseplan.md`: ingest
network traffic, learn/represent network state, forecast attacker progression
(K-step world model), map to MITRE ATT&CK, explain predictions, and present it
through a role-based, zero-trust operator UI. The engine is branded **NAGA-Net**.

Three layers:
1. **Frontend** — an Electron desktop app (primary) + a locally-hosted web
   fallback. 11 modules: dashboard, ingest/live-capture, alerts, action plan,
   database view, topology, brain-control, simulation, etc.
2. **Backend host** — a zero-dependency Node HTTP+SSE server (`backend/`) that
   serves the app and runs the live capture + monitor. Also has an on-device
   fallback so the app works if the host is down.
3. **Pipeline + live environment** — a Python feature-extraction pipeline over
   real CIC-IDS-2018 data (`pipeline/`), and a Dockerised Kubernetes network
   (`k8s-demo/`) that generates real attack traffic to capture and detect.

---

## 2. REAL vs AUTHORED — read this first

This is the single most important thing to understand. Do not blur the line, and
do not "upgrade" authored parts to sound real without actually building them.

**REAL (measured from data/packets):**
- CIC-IDS-2018 extraction: 3 real days (Feb 14/15/16), 1.05M flows each, correct
  episode durations (FTP-BruteForce ~97min, SSH ~91min, DoS days on 15/16). See
  `pipeline/`.
- Live packet capture: real `tcpdump` off the kind cluster pod bridge, and real
  Npcap capture off the host NIC. Real pod IPs, real SYN packets.
- Per-endpoint detection (`pipeline/k8s_detect.py` + `backend/live_capture.js`):
  signal-based scorer (port-sweep fan-out + brute-force rate). Scored against
  live ground truth from `kubectl`. Achieves P/R/F1 = 1.0 on the k8s traffic.
- The live monitor series and the dashboard when a live source is present
  (`backend/monitor.js` → `telemetry.liveForecast`).

**AUTHORED (hand-written, NOT a trained model):**
- **NAGA-Net itself is not a trained model.** The transition matrix, confusion
  matrix, headline accuracy (~71% in `model.js`), SHAP attributions, and the
  K-step forecast **past `NOW`** are authored/deterministic, not learned. There
  are no training scripts, no weights, no held-out eval.
- The curated topology (`services/topology.js`) is a fictional "water utility"
  network, not the live cluster.
- The dashboard's historical windows (24h/7d/1m…) and their forecast are an
  authored curve — used only as the air-gapped fallback when no live source.

**The biggest open gap:** the brief asks for a trained sequence model (LSTM/
Transformer/GNN) with measured metrics vs a logistic-regression baseline. That
does not exist. The live *detection* is real but is a signal-based scorer, not
NAGA-Net. If asked to "make NAGA-Net real", that means training a small sequence
model on the 1,306 real labelled windows × 62 features — a genuine task, not a
relabel.

---

## 3. Prerequisites / environment

Installed and working on this machine:
- Node v24.x, Python 3.13 (pandas, pyarrow, scapy installed)
- Docker Desktop (engine 29.7.2, WSL2 backend) — daemon must be running
- WSL2 with an Ubuntu distro (needed for Docker's Linux engine; VirtualMachine
  Platform is enabled — required a reboot to activate)
- `kind` v0.30 at `~/bin/kind.exe`; `kubectl` v1.36 on PATH
- Npcap installed (WinPcap-compat mode) — enables host live capture

If starting on a fresh machine, see the gotchas in §11 (Npcap silent install
fails, WSL/VMP needs a reboot, etc.).

---

## 4. Bring the whole stack up

Order matters. Run from `C:\Users\admin\OcuNet_SysApp` in Git Bash.

```bash
# 0. Docker Desktop must be running (daemon up). Check:
docker info --format '{{.ServerVersion}}'

# 1. Cluster (creates it if absent; ~2-3 min first time, pulls a 1.45GB node image)
bash k8s-demo/run-demo.sh          # cluster + 100 pods + a capture+detect pass
#    or just ensure it exists:
~/bin/kind.exe get clusters        # expect: ocunet

# 2. Backend HOST process — NOT the container (see §11). Needs KUBECONFIG.
export KUBECONFIG="$HOME/.kube/config-ocunet"
node backend/server.js             # listens on http://127.0.0.1:8787
#    On boot it logs "live monitor: started" and begins capturing continuously.

# 3. Desktop app (separate terminal)
cd desktop-app
env -u ELECTRON_RUN_AS_NODE npx electron-vite preview
#    or the browser fallback: open http://127.0.0.1:8787 (served by the backend)
```

Health check: `curl -s http://127.0.0.1:8787/health` → `liveCapture.available`
and `traffic.available` should be `true`.

Sign in: SOC Director, any username/password, then the fingerprint step-up.
Header should read **BACKEND LIVE** (green). If **ON-DEVICE**, the host is down.

Tear down cluster when done: `~/bin/kind.exe delete cluster --name ocunet`.

---

## 5. Produce data (CIC-IDS-2018 extraction)

Raw CSVs live in `data/raw/` (gitignored, ~1GB; source: Huggingface
`c01dsnap/CIC-IDS2018`, cached under `~/.cache/huggingface`). The pipeline turns
them into windowed feature parquet + episode lists + the backend capture bundle.

```bash
# one day
python -m pipeline.run extract --day data/raw/02-14-2018.csv --id 02-14-2018

# every day in data/raw/
python -m pipeline.run extract-all

# add labelled synthetic endpoints so an edge/topology graph can be drawn
# (these CSVs carry NO Src/Dst IP; every synthesised row is marked
#  synthetic_endpoints=1 — never present it as captured addressing)
python -m pipeline.run extract --day data/raw/02-14-2018.csv --id 02-14-2018 --synthetic-endpoints

# packet features from a pcap, or a live host capture (needs Npcap + admin)
python -m pipeline.run pcap --file <capture.pcap>
python -m pipeline.run capture --seconds 20 --window 5

# sanity report
python -m pipeline.run report
```

Outputs land in `data/processed/` (gitignored). The **committed** artifact the
app actually reads is `desktop-app/src/renderer/src/backend/services/captures.js`
(regenerate via `pipeline/export_backend.py`). Key correctness rules baked into
the pipeline — do not regress these:
- Reconstruct the 12h timestamps or every afternoon attack lands at 2am.
- `edge_list.py` refuses to invent endpoints unless `--synthetic-endpoints`.
- `has_packet_data` stays 0 unless real packets were seen (never zero-fill).

CLI source of truth: `pipeline/run.py` (subcommands: extract, extract-all,
capture, pcap, report).

---

## 6. Reproduce the simulations

Two distinct things are called "simulation":

### 6a. Attack simulation on the Docker/k8s network (real traffic)
`k8s-demo/` defines the network: 90 benign + 5 victim + 10 known-attacker +
(0-scaled) unknown-attacker pods on a 3-node kind cluster. Each pod is a real
network endpoint with a real IP.

```bash
bash k8s-demo/run-demo.sh          # full: cluster + workloads + capture + detect
# manifests: kind-cluster.yaml, workloads.yaml, malicious.yaml, malicious-unknown.yaml
# detector : pipeline/k8s_detect.py  (SYN-initiation, port-fanout + brute-rate)
# artifacts: detection.json, k8s-topology.json, detection-report.html
```

Detection is scored against ground truth (`kubectl` labels). Two attack shapes,
one detector, either flags: **scan** (many dst ports / few hosts) and **brute**
(high SYN rate at one host:port). Scoring is **rate-based** (per-second), so the
same 0.5 threshold holds for an 8s or 60s window. The identical formula lives in
both `pipeline/k8s_detect.py` (Python, offline) and `backend/live_capture.js`
(Node, live) — keep them in sync if you touch one.

### 6b. World-model K-step rollout (authored)
`backend/services/simulation.js` + `frames/simulation/`. Forward rollout of a
transition operator from a start state across many sampled trajectories, with
convergence basins and a divergence step. This is authored dynamics, not a
trained model (see §2). It is deterministic per (startRisk, kSteps, pathCount,
seed).

---

## 7. Manage traffic

The monitor is **passive** — it never launches attacks. Traffic is generated out
of band by the operator, directly against the cluster:

```bash
bash k8s-demo/attack.sh known      # sequential port sweep 1-1024 + FTP/SSH brute
bash k8s-demo/attack.sh unknown    # randomised high-port recon (unseen pattern)
bash k8s-demo/attack.sh both
bash k8s-demo/attack.sh stop       # quiet baseline (benign only)
bash k8s-demo/attack.sh status     # live pod counts
```

Mechanism: `kubectl scale deploy/malicious[-unknown] --replicas=N` in namespace
`netsim`. Attackers take ~8s to boot (DNS + startup sleep), so leave ~10s before
expecting detection. The app shows a **read-only** "N attacker nodes observed"
pill — observation, not control.

Demo loop: capture the quiet baseline (0 flagged) → `attack.sh known` → the
continuous monitor reacts on its own within a window or two (10/10 flagged, P/R
1.0) → `attack.sh stop` → settles back. The "unknown" profile catching at 1.0 is
the strong point: it's a pattern the detector wasn't tuned on (generalisation,
not signature matching).

---

## 8. Live capture, monitor, and the live dashboard

- **Live capture** (`backend/live_capture.js`): `docker exec tcpdump -i any -n -l`
  on both workers, parsed in Node (line mode, no pcap file). Keeps only the `In`
  direction (each packet appears twice with `-i any`) and only SYN-initiations.
  Excludes infra by address (CoreDNS `10.96.x`, control-plane `10.244.0.x`).
- **Continuous monitor** (`backend/monitor.js`): a server-side loop that captures
  an 8s window, scores it, and appends one point to a rolling series (last 90).
  Started on boot. It is the single source of truth for all live graphs.
  Endpoint: `GET /monitor/history` → `{ points, latest, detail }`.
- **Live dashboard** (`hooks/useDashboardData.js` + `telemetry.liveForecast`):
  when the monitor has points, the whole dashboard is built from the real series
  (flat baseline ~32-39, jumps to 100 under attack) with **today's** timestamps.
  Falls back to authored historical windows only when no live source exists.

Backend routes (all host-only, advertised in `/health`):
`/health`, `/snapshot`, `/call`, `/stream` (SSE), `/live-capture`,
`/traffic/status|generate|stop`, `/monitor/history`.

---

## 9. Build / test / ship

```bash
cd desktop-app
npm run build        # electron main+preload+renderer
npm run build:web    # the web fallback bundle served by the backend host
npm run e2e          # 9 checks; e2e:offline (5), e2e:desktop (5)
```

After changing renderer code you must `npm run build:web` and restart the
backend for the browser fallback to pick it up; for the Electron app, rebuild
and relaunch. Restarting the backend drops the app's live connection (it flips
to ON-DEVICE) — reload the app window to reconnect.

Push (both remotes):
```bash
git add -A && git commit -m "..."   # end messages with the Co-Authored-By trailer
GIT_TERMINAL_PROMPT=0 git push demo main
GIT_TERMINAL_PROMPT=0 git push origin main
```

---

## 10. File map (the load-bearing bits)

```
baseplan.md                     the full problem statement + demo spec (PUBLIC repo)
backend/
  server.js                     HTTP+SSE host; routes; starts the monitor
  live_capture.js               real tcpdump capture + per-endpoint scoring
  monitor.js                    continuous capture loop + rolling series
  traffic.js                    read-only cluster status (kubectl)
pipeline/
  run.py                        extraction CLI
  flow_features.py              windowed flow features + episodes
  packet_features.py            pcap/live packet features (scapy)
  edge_list.py                  edges; opt-in labelled synthetic endpoints
  k8s_detect.py                 offline per-endpoint detector (mirror of live)
  export_backend.py             writes captures.js from processed parquet
k8s-demo/
  run-demo.sh attack.sh         bring-up + traffic control
  *.yaml                        cluster + workloads + attackers
desktop-app/src/renderer/src/
  backend/                      transport.js, operations.js, index.js, services/*
  hooks/useDashboardData.js     live-vs-authored dashboard data
  frames/                       the 11 UI modules
```

---

## 11. Gotchas (things that already bit us — don't relearn them)

1. **Backend must run as the HOST Node process, not the container.** The
   container (`ocunet-backend`) cannot reach Docker/kubectl/tcpdump, so live
   capture and traffic status only work when you run `node backend/server.js` on
   the host. The container is fine for a pure UI demo.
2. **Docker cannot sniff the host Wi-Fi.** Containers see only the cluster's
   virtual network. Live capture off the physical NIC is the separate Npcap path
   (`pipeline.run capture`). Don't promise "Docker live capture of my Wi-Fi".
3. **Git Bash MSYS path conversion** rewrites `/tmp/x` to a Windows path before
   `docker exec` sees it → "file not found". Prefix docker/kubectl exec commands
   with `MSYS_NO_PATHCONV=1` when passing absolute Linux paths.
4. **`docker cp` skips kind's `/tmp`** (tmpfs). Stream files out with
   `docker exec <node> tar cf - -C /tmp file | tar x` instead.
5. **`tcpdump -i any` on kind** prints `<iface> In/Out` between the timestamp and
   `IP`, and shows each packet twice. Parse the optional iface/dir and keep only
   `In`. `--time-stamp-precision` is unsupported on that build — omit it.
6. **Detector scoring is rate-based** (per second) on purpose, so short and long
   windows use the same threshold. If you change it in one file, change both
   (`k8s_detect.py` and `live_capture.js`).
7. **Npcap free installer refuses `/S`** (silent) — needs the elevated GUI
   installer, WinPcap-compat mode ticked.
8. **WSL2 needs Virtual Machine Platform** enabled + a reboot; the Ubuntu distro
   may need importing from a Canonical rootfs if the Store CDN stalls.
9. **Dates:** live mode uses real capture times (today). The authored fallback
   forecast projects `now + K*step` and can show future dates — that's the
   forecast horizon, only visible with no live source.

---

## 12. Open items / what a future agent might be asked next

- **Train NAGA-Net for real** (the core brief gap): a small sequence model over
  the real labelled windows, with measured metrics vs a logistic-regression
  baseline. Replace the authored transition/confusion matrices and forecast.
- **Second-machine demo** (baseplan §2/§3.2): isolated-hotspot LAN with 2-4
  laptops, known + unknown distributed attack. Not built.
- **Unify stage labels:** dashboard uses a risk-threshold stage mapping
  (Exfiltration at risk 100) while the live timeline uses the detected signal
  (Reconnaissance). Consider reading both from the real signal.
- **Real database + Redis** (baseplan §6/§73): currently parquet on disk +
  in-memory state, presented as pipeline stages in the UI.
- **Backup demo videos** (baseplan §123): not recorded.

---

## 13. Conduct notes carried from the session

- Do not fabricate data to pass a validator. A reviewer already rejected a
  generated `labelled.csv`; realness is the point, not schema conformance.
- Keep the monitor passive (it recommends, a human acts). This is both the
  brief's stance (§90) and how the demo is framed.
- The `demo` remote is **public**; `baseplan.md` is therefore public. Flag this
  to the user if sensitivity matters.
