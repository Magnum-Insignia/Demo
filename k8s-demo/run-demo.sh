#!/usr/bin/env bash
# One-command 100-node Kubernetes detection demo.
#   90 benign + 10 malicious + 5 victim pods on a kind cluster; real tcpdump
#   capture off the pod bridge; per-endpoint SYN-based detection scored against
#   the known malicious pod IPs. Nothing is fabricated -- every number comes
#   from packets that crossed the bridge.
set -e
export PATH="$HOME/bin:$PATH"
export KUBECONFIG="$HOME/.kube/config-ocunet"
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"

echo "== 1. cluster =="
kind get clusters 2>/dev/null | grep -q ocunet || \
  kind create cluster --config "$HERE/kind-cluster.yaml" --image kindest/node:v1.34.0 --kubeconfig "$KUBECONFIG"

echo "== 2. workloads (90 benign, 5 victim, 10 malicious) =="
kubectl apply -f "$HERE/workloads.yaml"
kubectl apply -f "$HERE/malicious.yaml"
kubectl -n netsim rollout status deploy/benign --timeout=180s

echo "== 3. ground truth =="
kubectl -n netsim get pods -l role=malicious -o jsonpath='{range .items[*]}{.status.podIP}{"\n"}{end}' \
  | grep . | python -c "import sys,json;json.dump([l.strip() for l in sys.stdin],open('$HERE/ground-truth-malicious.json','w'))"

echo "== 4. capture SYN-initiations on both workers (60s) =="
for w in ocunet-worker ocunet-worker2; do
  docker exec $w sh -c 'command -v tcpdump >/dev/null || (apt-get update -qq && apt-get install -y -qq tcpdump) >/dev/null 2>&1'
  docker exec -d $w sh -c 'timeout 60 tcpdump -i any -w /tmp/syn.pcap "tcp[tcpflags] & tcp-syn != 0 and tcp[tcpflags] & tcp-ack == 0 and net 10.244.0.0/16" 2>/dev/null'
done
sleep 65
mkdir -p "$HERE/caps"
for w in ocunet-worker:w1 ocunet-worker2:w2; do
  c="${w%%:*}"; n="${w##*:}"
  docker exec $c tar cf - -C /tmp syn.pcap > "$HERE/caps/$n.tar"
  tar xf "$HERE/caps/$n.tar" -C "$HERE/caps" && mv "$HERE/caps/syn.pcap" "$HERE/caps/syn-$n.pcap"
  rm "$HERE/caps/$n.tar"
done
python -c "from scapy.all import rdpcap,wrpcap;wrpcap('$HERE/caps/syn-merged.pcap',rdpcap('$HERE/caps/syn-w1.pcap')+rdpcap('$HERE/caps/syn-w2.pcap'))" 2>/dev/null

echo "== 5. detect =="
cd "$ROOT"
python -m pipeline.k8s_detect --pcap "$HERE/caps/syn-merged.pcap" \
  --malicious "$HERE/ground-truth-malicious.json" --threshold 0.5 --out "$HERE/detection.json"
