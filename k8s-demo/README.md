# 100-node Kubernetes detection demo

A live kind cluster of 100 workload endpoints — 90 benign, 10 malicious, plus
5 victim services — that generates real east-west traffic. Malicious pods run a
port sweep (1–1024) and a brute-force cadence against the victims. A tcpdump on
each worker's pod bridge captures SYN-initiation packets, and a per-endpoint
detector scores every source IP and is graded against the known malicious pods.

Nothing is fabricated: every number comes from packets that crossed the bridge,
and the pod IPs are real Kubernetes addresses.

## Run

    bash run-demo.sh          # cluster + workloads + capture + detection

Prereqs: Docker running, `kind` on PATH, `kubectl`, Python with scapy.

## Result (last run)

    detection over 27,154 SYN packets, 100 source endpoints
    precision 1.0  recall 1.0  f1 1.0   (tp=10 fp=0 fn=0 tn=90)

Two attack shapes, one detector:
  - port sweep   -> high destination-port fan-out to one host
  - brute force  -> high SYN rate concentrated on one (host, port)

An endpoint is flagged if it trips EITHER. Kubernetes infrastructure
(CoreDNS 10.96.x, control-plane 10.244.0.x) is excluded by address.

## Files

    kind-cluster.yaml            3-node cluster (1 control-plane, 2 workers)
    workloads.yaml               benign + victim deployments
    malicious.yaml               the 10 attacker pods
    ../pipeline/k8s_detect.py    the detector
    detection.json               scored endpoints + evaluation
    k8s-topology.json            all 105 pods with roles, hosts, verdicts
    ground-truth-malicious.json  the 10 known-bad pod IPs
