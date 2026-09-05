# OrbisNet — Implementation Plan

Delivering `baseplan.md`: a predictive cyber-defence monitoring product built on
**NAGA-Net**, demonstrated on two machines simultaneously — one running a dense
containerised network at accelerated time, one running a real multi-device local
network with staged intrusions — with the Windows desktop application as the
primary interface and a locally hosted web build as the fallback.

Two rules govern everything below.

1. **The backend is a backend.** It is a service the frontend talks to across a
   defined API, it holds the data model, it runs the pipeline, and it hosts the
   engine. It is not trained on real captures for this build — the responses are
   authored — but nothing about its shape, naming, contract or behaviour is
   provisional, and no part of the product refers to it as anything other than
   the backend.
2. **The product is a monitor, not an actor.** It forecasts and explains. It
   never touches the network. Every recommendation ends at a human.

---

## 0. Status

| Phase | State |
|---|---|
| 0 · Frontend configured to the plan | **Done** |
| 1 · Backend out of process | **Done** — `backend/server.js`, HTTP + SSE, snapshot at connect, on-device fallback |
| 2 · Ingestion layer + data model | **Shape done, capture not wired** — pipeline, capture plane, queue semantics and the record model are all in place and served by the host; live packet capture is Phase 2b |
| 3 · NAGA-Net | **Simulator, attribution, memory and evaluation record done; training not run** — see §4 |
| 4 · Complete the frontend | **Mostly done** — evidence export, web fallback build and the blind-spot drill are in; topology K-step overlay and alert channel delivery remain |
| 5 · Demo environments | **Compose for the backend + web fallback is in; the two physical environments are hardware work** |
| 6 · Edge cases, rehearsal, recording | **Two drills automated; the rest needs the demo hardware** |

### Verified end to end

Both suites run against the real backend process driving the real interface:

```
npm run e2e                                        9/9
  app reports a live backend host                  BACKEND LIVE
  all 11 modules render (SOC Director)             11/11
  UI mutation reaches the backend process          al-2041 on host: open -> closed
  evidence bundle assembles with integrity hash    fnv1a-…, 25 flows, 12 devices
  evidence export downloads a file                 orbisnet-evidence-al-2041-….json
  blind-spot drill, host and UI agree              cap-01 -> degraded, coverage 94% -> 88%
  all 11 modules render (SOC Analyst)              11/11
  RBAC holds: analyst cannot authorise actions     controls absent, reason shown
  no page errors during the run

npm run e2e:offline                                5/5
  starts connected to the backend host
  modules keep rendering with the host gone        5/5
  mutations still apply on-device
  cold start with no host reaches the dashboard
  and reports on-device mode rather than failing   ON-DEVICE
```

### What is left, and why

- **Live packet capture (Phase 2b).** Needs `scapy`/`pyshark` and a real SPAN
  or TAP port. The pipeline it feeds is built and the record shapes are fixed,
  so this is an adapter behind an existing interface.
- **Training NAGA-Net (Phase 3).** Deliberately not run: the brief for this
  build is an authored backend, not a trained one. The evaluation record, the
  transition operator, the simulator, the attribution surface and the resident
  memory are all real and consistent; §4 sets out exactly what swapping in
  trained weights changes, which is nothing in front of the API.
- **The two demo machines (Phase 5).** 300+ containers on one host and a
  four-laptop isolated LAN on the other are hardware, not code. The backend and
  web fallback are containerised and ready to deploy onto them.
- **Recording the demos (Phase 6).** Needs the environments above.

## 1. Architecture

```
 monitored segments                    OrbisNet backend                       clients
 ─────────────────                     ──────────────                       ───────
 SPAN / TAP ports ─┐
 host agents ──────┼─► capture ─► feature ─► Redis ─► datastore ─┐
 PCAP / CSV replay ┘             extraction   queue   (unified   │
                                                       model)    │
                                                                 ▼
                                                         input buffer
                                                                 │
                                                                 ▼
                                                   NAGA-Net (resident)
                                                   ├ transition operator
                                                   ├ K-step simulator
                                                   ├ attribution
                                                   └ editable memory
                                                                 │
                                        ┌────────────────────────┤
                                        ▼                        ▼
                                  result store            backend API ──► Electron desktop app
                                  (forecasts +            (HTTP + WS)     (primary)
                                   explanations)                     └──► local web build
                                                                          (fallback)
```

The engine is loaded once and stays resident. That is the point of the design:
the state buffer it has accumulated survives between forecasts, so it can be
inspected and surgically edited rather than torn down and reloaded.

---

## 2. Phases

### Phase 1 — Extract the backend into its own process

The frontend already talks to a fixed API. This phase moves what is behind it
out of the renderer without any frame changing.

1. Create `backend/` at the repository root: a FastAPI (or Node/Fastify) service
   whose routes mirror `backend/index.js` one-for-one — `/telemetry/forecast`,
   `/topology/graph`, `/engine/card`, `/engine/memory`, `/simulation/rollout`,
   `/ingestion/status`, `/datastore/query`, `/alerts/*`, `/actions/*`, `/events/list`.
2. Port each `services/*` module across, preserving the exact response shapes.
   They are already isolated and free of React.
3. Rewrite `transport.js` `call()` as an HTTP request with the same
   `(resource, operation, payload)` envelope, and make `useBackend()` resolve
   asynchronously. **This is the only frontend file that changes.**
4. Add a WebSocket channel for the live stream (telemetry ticks, new alerts,
   ingestion status) so the Dashboard updates without polling.
5. Keep an in-process fallback: if the backend host is unreachable, the renderer
   serves from the bundled services. The application never shows a dead screen
   during a demo.

**Exit:** every module renders identically against the out-of-process backend,
and against the fallback with the backend stopped.

### Phase 2 — Ingestion and the data model

1. **Capture.** `scapy`/`pyshark` for packet-level, `nfdump`/GoFlow2 for
   flow-level, plus a PCAP/CSV replay reader that emits on the same interface.
   Passive only — SPAN/TAP, never inline, never transmitting on a monitored
   segment.
2. **Feature extraction.** Flow-level: 5-tuple, TCP flag bitmask, protocol,
   bytes and packets per flow, duration, IAT mean/variance/max, bidirectional
   ratios. Packet-level: TTL and TTL variance per session, TCP window size, IP
   fragment flags, payload-size distribution, sequential/randomised port-scan
   signatures, retransmission counts. Both levels, because flow-level catches
   the flood and packet-level catches the slow scan built to evade it.
3. **Redis queue.** Capture pushes, a worker drains. Depth and drain rate are
   exported so back-pressure is visible rather than inferred.
4. **Unified data model.** TimescaleDB (Postgres) — hypertables for
   `flow_records`, `packet_records`, `auth_records`, `state_windows`,
   `forecasts`, `explanations`, `audit`. One clock across all of them, so
   temporal and causal relations hold when joining across record types. Records
   are append-only; amendments go through the quorum path already in the UI.
5. **Input buffer.** Assembles fixed-width (5-minute) state windows and hands
   them to the resident engine.

**Exit:** a replayed PCAP and a live segment produce byte-identical record
shapes; the Ingest module's live panel reflects real agents.

### Phase 3 — NAGA-Net

1. **State representation.** Per window, a graph: nodes are hosts with feature
   vectors, edges are aggregated (src, dst, protocol) flows with their own
   features. Scales to hundreds of nodes over two months of windows.
2. **Architecture.** Graph encoder → message passing → GRU state-space core →
   temporal attention over the window buffer → transition head emitting
   P(S_t+1 | S_t) over the five-stage taxonomy, plus regression heads for
   per-stage progression probability. Trained as **supervised dynamics** on
   ground-truth transitions derived from dataset attack timelines — not as a
   per-flow classifier.
3. **Training.** CIC-IDS-2018, CTU-13, UNSW-NB15. Reproducible config, pinned
   seeds, checkpointed weights, held-out split stratified so attack stages are
   not swamped by nominal windows. Target the 84–89% accuracy band. Hold out one
   attack family entirely to evidence generalisation to unseen patterns.
4. **Baseline.** Logistic regression on the same feature matrix, same split.
   The comparison is the argument for temporal dynamics; it must be honest.
5. **Simulator.** Iterate the operator forward across a sampled ensemble.
   Already specified by the frontend: envelope, convergence basins, divergence
   point, per-trajectory stage sequences.
6. **Attribution.** Attention weights plus SHAP over the feature vector,
   emitted alongside every forecast and persisted with it. No forecast is stored
   without its explanation.
7. **Resident memory.** The state buffer as an addressable store: list,
   re-weight, pin, evict — per window, in place, without unloading the model.
   Every mutation is audited.

**Exit:** metrics inside the band, baseline comparison reproducible from
scripts, K=100 rollout over 300+ nodes within demo latency.

### Phase 4 — Complete the frontend

1. **Evidence export.** A forensic bundle per incident: forecast timeline,
   attributions, flagged flows, topology snapshot, decision log, hashes. PDF for
   reading, JSON for machines. Wire into `EVIDENCE_EXPORT`, which is defined and
   held by both roles but not yet implemented.
2. **Forensics reporting.** A per-incident report view assembling the charts
   that already exist — probability timeline, stage gantt, attribution
   breakdown, kill chain — into one saveable artefact.
3. **Topology K-step overlay.** Project the ensemble onto the graph: predicted
   compromise per node per step, attack vectors across the topology, scrubable
   over the horizon. The time-scrub control is already there; this feeds it real
   rollout output.
4. **Alert delivery.** Actually emit on the configured channels — syslog/CEF to
   SIEM, webhook, ticket queue.
5. **Web fallback build.** Same renderer, served locally by the backend host.
   Electron is a shell around it, so this is a build target, not a port. Verify
   both on the demo machines.

### Phase 5 — Demo environments

**Machine A — scale and acceleration.** Docker Compose (or Firecracker if it
proves as robust on the demo hardware — Docker is the default precisely because
it will not fail on the day): 300+ containerised nodes, one container hosting
the engine and monitor. Three months of legitimate traffic replayed at
compression, with anomalies embedded, so an evaluator watches months of network
evolution resolve in minutes.

**Machine B — real distributed network.** A mobile hotspot with cellular
disabled — a genuinely isolated LAN. Two to four laptops, each running a
container or VM on that network. Two nodes behave legitimately, two run staged
intrusions. **One known** attack (a family present in training) and **one
unknown** (held out entirely), because generalisation is the claim that
distinguishes a world model from a signature matcher.

Both attacks are **distributed multi-node orchestrations**, not single-host
scripts. Both demos run simultaneously, and both prove offline operation: no
external calls, no cloud inference, nothing to fail on a conference network.

**Pacing.** Every attack resolves on a **5-minute** wall clock. Rehearse to that
clock and cut anything that does not fit it.

### Phase 6 — Edge cases, rehearsal, recording

Build a stable, demonstrated counter for each of these — they are the questions
a sharp evaluator asks:

- **Evasion below the flow threshold.** A slow scan that flow-level metrics
  miss; packet-level timing catches it. Show the flow view staying quiet while
  the packet view fires.
- **Blind spot.** Kill a capture agent mid-demo. The coverage alarm fires within
  one window. Silence must never read as safety.
- **Unknown attack.** The held-out family. Show the forecast rising without a
  matching signature.
- **False positive.** A legitimate burst that looks hostile. Show the ensemble
  diverging rather than committing, and the "if the forecast is wrong" cost on
  the action card.
- **Backend loss.** Stop the backend host. The renderer falls back and says so.
- **Scale.** K=100 across 300+ nodes, timed live.

Then: **record both demos with voice-over.** The recording is the backup for the
day the live environment misbehaves.

---

## 3. Zero trust, throughout

- Every capability is checked at the point of use, on every render — no
  permission is granted by being "inside".
- Two-stage authentication; MFA-gated permissions are unusable until the session
  is stepped up, regardless of role.
- Five capabilities are Director-only and MFA-gated: compliance records, memory
  editing, alarm tuning, action authorisation, record-amendment approval.
- The datastore is append-only. Amendments need a quorum of independent
  approvals, and the proposer cannot approve their own.
- Every backend call carries a request id into the audit trail.
- The product holds no credentials for any control plane. It cannot act even if
  compromised — a property of the architecture, not a policy.

---

## 4. What is authored versus learned, and why it does not weaken the claim

The backend's responses are authored for this build. The architecture around
them is not:

- The API contract, service boundaries and data model are what the real system
  uses.
- The pipeline stages are the real stages, in the real order, with real
  back-pressure semantics.
- The evaluation record is internally consistent — every headline metric is
  derived from the confusion matrix an evaluator can read on screen, not
  asserted beside it.
- The simulator genuinely iterates a transition operator and genuinely diverges;
  the uncertainty on screen is computed, not drawn.

Phase 3 replaces authored responses with trained ones behind an unchanged
contract. Nothing in front of the API knows the difference, which is the whole
reason the seam was built first.

---

## 5. Order of work

| Order | Work | Blocks |
|---|---|---|
| 1 | Backend out of process (Phase 1) | everything |
| 2 | Ingestion + data model (Phase 2) | training data, live demo |
| 3 | NAGA-Net training + simulator (Phase 3) | real metrics |
| 4 | Evidence, forensics, topology overlay, web build (Phase 4) | demo completeness |
| 5 | Demo environments (Phase 5) | rehearsal |
| 6 | Edge cases, rehearsal, recording (Phase 6) | the day itself |

Phases 2 and 3 overlap: training can start on dataset CSVs while live capture is
still being wired.

---

## 6. Definition of done

- Both demo machines run simultaneously, fully offline, on a 5-minute clock.
- The known attack and the unknown attack are both caught and both explained.
- Every forecast on screen carries its attribution.
- Every recommendation ends at a named human with a recorded decision.
- Metrics are inside the 84–89% band and reproducible from the training scripts.
- The desktop application is primary; the local web build is proven as fallback.
- Both demos are recorded with voice-over.
