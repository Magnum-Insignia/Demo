#!/usr/bin/env bash
# Generate attack traffic on the Docker/kind cluster — run BY the operator,
# independent of the monitor. The desktop app only captures; it never launches
# an attack. That separation is the point: the packets the app flags were put
# on the wire here, not by the app.
#
#   bash attack.sh known     # sequential port sweep 1-1024 + FTP/SSH brute force
#   bash attack.sh unknown   # randomised high-port recon (unseen pattern)
#   bash attack.sh both       # run both attacker sets at once
#   bash attack.sh stop       # back to the quiet baseline (benign only)
#   bash attack.sh status     # show live pod counts
#
# Then, in the desktop app: Ingest -> Live Capture -> Capture.
# `config-ocunet` is the pre-rename kubeconfig; fall back to it so a cluster
# created before the rebrand is still reachable.
# Pick the kubeconfig that actually reaches a live cluster. An exported but
# STALE KUBECONFIG (e.g. a deleted pre-rename cluster) used to be trusted
# blindly, so every scale silently failed while the script still reported a
# quiet baseline. Now each candidate is probed and a dead one is discarded.
_reaches() { [ -f "$1" ] && KUBECONFIG="$1" kubectl -n netsim get ns netsim >/dev/null 2>&1; }
for _cand in "$KUBECONFIG" "$HOME/.kube/config-orbisnet" "$HOME/.kube/config-ocunet"; do
  if _reaches "$_cand"; then KUBECONFIG="$_cand"; export KUBECONFIG; _ok=1; break; fi
done
if [ -z "$_ok" ]; then
  echo "!! no reachable cluster (tried KUBECONFIG, config-orbisnet, config-ocunet)." >&2
  echo "   Is the cluster up?  kind get clusters" >&2
  exit 1
fi
NS=netsim
N="${2:-10}"

case "${1:-status}" in
  known)   kubectl -n $NS scale deploy/malicious          --replicas="$N" || exit 1 ;;
  unknown) kubectl -n $NS scale deploy/malicious-unknown  --replicas="$N" || exit 1 ;;
  both)    kubectl -n $NS scale deploy/malicious          --replicas="$N"
           kubectl -n $NS scale deploy/malicious-unknown  --replicas="$N" ;;
  stop)    kubectl -n $NS scale deploy/malicious          --replicas=0 || exit 1
           kubectl -n $NS scale deploy/malicious-unknown  --replicas=0 || exit 1 ;;
  status)  ;;
  *) echo "usage: bash attack.sh {known|unknown|both|stop|status} [replicas]"; exit 1 ;;
esac

echo
kubectl -n $NS get deploy -o custom-columns=\
'DEPLOY:.metadata.name,DESIRED:.spec.replicas,READY:.status.readyReplicas' 2>/dev/null
A=$(kubectl -n $NS get pods -l role=malicious --no-headers 2>/dev/null | grep -c Running)
echo
if [ "$A" -gt 0 ]; then echo ">> attack in progress: $A attacker nodes live. Capture now in the app."
else echo ">> quiet baseline: benign traffic only."; fi
