#!/usr/bin/env bash
# Fast pre-flight for the demo launcher.
#
# Gets the cluster into a known-good, QUIET state and returns immediately when
# it is already healthy. Unlike run-demo.sh this does NOT run the 60s capture +
# detection validation pass — that is a verification tool, not something to sit
# through on the way to a presentation.
#
#   healthy cluster  -> ~10s (just scales attackers to zero)
#   missing cluster  -> creates it and deploys the 100-pod network
set -e
export PATH="$HOME/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
NS=netsim

# --- pick a kubeconfig that actually reaches a cluster -----------------------
reaches() { [ -f "$1" ] && KUBECONFIG="$1" kubectl get nodes >/dev/null 2>&1; }
CFG=""
for c in "$KUBECONFIG" "$HOME/.kube/config-orbisnet" "$HOME/.kube/config-ocunet"; do
  if reaches "$c"; then CFG="$c"; break; fi
done

# --- create the cluster only if nothing is reachable -------------------------
if [ -z "$CFG" ]; then
  echo "   no reachable cluster - creating (this takes a few minutes)..."
  CFG="$HOME/.kube/config-orbisnet"
  EXISTING="$(kind get clusters 2>/dev/null || true)"
  case "$EXISTING" in *orbisnet*) kind delete cluster --name orbisnet >/dev/null 2>&1 ;; esac
  kind create cluster --config "$HERE/kind-cluster.yaml" \
    --image kindest/node:v1.34.0 --kubeconfig "$CFG"
fi
export KUBECONFIG="$CFG"
echo "   cluster reachable via $(basename "$CFG")"

# --- workloads: apply only if the namespace is missing -----------------------
if ! kubectl get ns "$NS" >/dev/null 2>&1; then
  echo "   deploying the 100-pod network..."
  kubectl apply -f "$HERE/workloads.yaml" >/dev/null
  kubectl apply -f "$HERE/malicious.yaml" >/dev/null
  kubectl apply -f "$HERE/malicious-unknown.yaml" >/dev/null
  kubectl -n "$NS" rollout status deploy/benign --timeout=300s >/dev/null
fi

# --- tcpdump on the workers (live capture needs it) --------------------------
for w in $(docker ps --filter "label=io.x-k8s.kind.cluster" --format '{{.Names}}' | grep -- '-worker'); do
  docker exec "$w" sh -c 'command -v tcpdump >/dev/null || (apt-get update -qq && apt-get install -y -qq tcpdump) >/dev/null 2>&1' || true
done

# --- always start QUIET: no attack carried in from a previous session --------
kubectl -n "$NS" scale deploy/malicious         --replicas=0 >/dev/null 2>&1 || true
kubectl -n "$NS" scale deploy/malicious-unknown --replicas=0 >/dev/null 2>&1 || true

RUN=$(kubectl -n "$NS" get pods --no-headers 2>/dev/null | grep -c Running || echo 0)
echo "   ready: $RUN pods running, attackers at 0 (quiet baseline)"
