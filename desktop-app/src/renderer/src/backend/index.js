/*
 * THE backend API surface.
 *
 * Every frame in the renderer reads and writes through this object and nothing
 * else — no frame imports a service module directly. That single seam is what
 * lets the backend run out of process (ingestion pipeline, datastore, queue,
 * NAGA-Net engine host) without any frame changing: the operations keep their
 * names and their result shapes, and ./transport.js decides whether a call is
 * answered by the backend host or, when the host is unreachable, by the same
 * service modules bundled into the app.
 *
 * Resources are generated from ./operations.js, so this file cannot drift from
 * what the backend host actually serves.
 *
 *   backend.captures    real CSE-CIC-IDS2018 captures, as extracted
 *   backend.ingestion   capture agents, queue and pipeline status
 *   backend.telemetry   observed stream + K-step forecast
 *   backend.topology    device/edge inventory and the inferred attack vector
 *   backend.engine      NAGA-Net model card, evaluation record, resident memory
 *   backend.simulation  multi-path K-step rollouts (convergence / divergence)
 *   backend.datastore   raw ingested records + change-control proposals
 *   backend.events      system & security event log
 *   backend.alerts      alarm strategies and what they have raised
 *   backend.actions     prioritised action plan + control-tool integrations
 *   backend.evidence    forensic evidence bundles
 *   backend.session     service health for the operator console
 */
import {
  resource, observe, connect, onRevision, backendStatus,
  runLiveCapture, liveCaptureCapability, trafficStatus, monitorHistory, clusterTopology
} from './transport'
import { OPERATIONS } from './operations'

export const backend = Object.fromEntries(Object.keys(OPERATIONS).map((name) => [name, resource(name)]))

// Live capture is not a cached read like the rest — it waits on the wire — so
// it hangs off the backend object as its own async pair rather than as a
// generated resource operation.
backend.liveCapture = {
  run: runLiveCapture,
  capability: liveCaptureCapability
}

// The monitor is passive: it does NOT launch traffic. Attacks are generated
// out of band by the operator (k8s-demo/attack.sh) directly against the
// cluster. The only cluster read exposed here is a read-only pod-count status,
// so the capture panel can show whether the network is quiet or busy — it
// never controls the attack.
backend.cluster = { status: trafficStatus, topology: clusterTopology }

// The continuous monitor's live time series — the source of truth for the live
// graphs. Server-side, so every frame reads the same recording.
backend.monitor = { history: monitorHistory }

export { observe, connect, onRevision, backendStatus, runLiveCapture, liveCaptureCapability }
export default backend
