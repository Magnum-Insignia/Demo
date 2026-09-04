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
import { resource, observe, connect, onRevision, backendStatus } from './transport'
import { OPERATIONS } from './operations'

export const backend = Object.fromEntries(Object.keys(OPERATIONS).map((name) => [name, resource(name)]))

export { observe, connect, onRevision, backendStatus }
export default backend
