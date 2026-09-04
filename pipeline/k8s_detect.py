"""
Per-endpoint detection over a real capture from the Kubernetes network.

Reads the pcap tcpdump collected off the kind node's pod bridge, aggregates
per SOURCE POD IP (real Kubernetes addresses, not synthetic), computes the
signals a scanner/brute-forcer trips, and scores each endpoint. The result is
matched against the known malicious pod IPs to produce real precision/recall.

No model, no fabrication: every number is derived from packets that crossed
the bridge.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict

from .packet_features import SCAPY

if SCAPY:
    from scapy.all import PcapReader, IP, TCP


# Kubernetes infrastructure endpoints — real, but not workloads. CoreDNS, the
# kube-dns service VIP and kube-proxy chatter would otherwise dominate a
# fan-out score. Excluded by address, and named so the exclusion is auditable.
INFRA_PREFIXES = ("10.96.", "10.244.0.")  # service VIPs + control-plane pods


def _syn_record(pkt):
    """A pure SYN (connection attempt): SYN set, ACK clear. This is the packet
    an initiator sends -- a victim's SYN-ACK or RST reply never matches, so a
    victim being scanned is not mistaken for a scanner."""
    if IP not in pkt or TCP not in pkt:
        return None
    f = int(pkt[TCP].flags)
    if not (f & 0x02) or (f & 0x10):   # need SYN, must not have ACK
        return None
    return {"t": float(pkt.time), "src": pkt[IP].src, "dst": pkt[IP].dst,
            "dport": int(pkt[TCP].dport), "len": int(pkt[IP].len)}


def _entropy(counts) -> float:
    total = sum(counts.values())
    if total <= 0:
        return 0.0
    return -sum((c / total) * math.log2(c / total) for c in counts.values() if c)


def per_source(pcap_path: str) -> dict:
    """Aggregate the capture per source IP."""
    agg = defaultdict(lambda: {
        "packets": 0, "syn": 0, "dst_ips": set(), "dst_ports": defaultdict(int),
        "targets": defaultdict(int), "bytes": 0, "first": None, "last": None,
    })
    with PcapReader(pcap_path) as reader:
        for pkt in reader:
            r = _syn_record(pkt)
            if not r:
                continue
            if r["src"].startswith(INFRA_PREFIXES):
                continue
            a = agg[r["src"]]
            a["packets"] += 1
            a["bytes"] += r["len"]
            a["dst_ips"].add(r["dst"])
            a["dst_ports"][r["dport"]] += 1
            a["targets"][(r["dst"], r["dport"])] += 1
            a["first"] = r["t"] if a["first"] is None else min(a["first"], r["t"])
            a["last"] = r["t"] if a["last"] is None else max(a["last"], r["t"])
    return agg


def score(agg: dict) -> list:
    """Signal-based score per source IP, rate-based so the same thresholds hold
    whether the capture ran 8s or 60s. Matches backend/live_capture.js exactly."""
    times = [t for a in agg.values() for t in (a["first"], a["last"]) if t is not None]
    gspan = max((max(times) - min(times)), 0.5) if len(times) >= 2 else 1.0
    rows = []
    for ip, a in agg.items():
        span = gspan
        n_ports = len(a["dst_ports"])
        n_dst = len(a["dst_ips"])
        port_entropy = _entropy(a["dst_ports"])
        conn_rate = a["packets"] / span
        max_target = max(a["targets"].values()) if a["targets"] else 0

        # Two attack shapes, scored independently; an endpoint is malicious if
        # it trips EITHER. Rate-based, so duration-invariant.
        #   scan  = new destination ports per second + fan-out onto few hosts
        #   brute = SYNs/s at the busiest (host, port) + overall connection rate
        port_rate = n_ports / span
        fanout = n_ports / max(n_dst, 1)
        target_rate = max_target / span
        scan = 0.60 * min(port_rate / 3.0, 1.0) + 0.40 * min(fanout / 40.0, 1.0)
        brute = 0.60 * min(target_rate / 5.0, 1.0) + 0.40 * min(conn_rate / 8.0, 1.0)
        score_v = max(scan, brute)
        rows.append({
            "ip": ip, "score": round(score_v, 3), "packets": a["packets"],
            "dst_hosts": n_dst, "dst_ports": n_ports,
            "top_target": max_target, "conn_rate_s": round(conn_rate, 1),
            "signal": "scan" if scan >= brute else "brute-force",
        })
    return sorted(rows, key=lambda r: -r["score"])


def evaluate(rows: list, malicious_ips: set, threshold: float) -> dict:
    tp = fp = fn = tn = 0
    for r in rows:
        flagged = r["score"] >= threshold
        actual = r["ip"] in malicious_ips
        if flagged and actual: tp += 1
        elif flagged and not actual: fp += 1
        elif not flagged and actual: fn += 1
        else: tn += 1
    # malicious IPs that never appeared as a source in the capture
    seen = {r["ip"] for r in rows}
    fn += len(malicious_ips - seen)
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "precision": round(prec, 3), "recall": round(rec, 3), "f1": round(f1, 3),
            "threshold": threshold}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pcap", required=True)
    ap.add_argument("--malicious", required=True, help="JSON list of known malicious pod IPs")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--out")
    args = ap.parse_args()

    mal = set(json.load(open(args.malicious))) if args.malicious.endswith(".json") \
          else set(args.malicious.split(","))

    agg = per_source(args.pcap)
    rows = score(agg)
    ev = evaluate(rows, mal, args.threshold)

    print(f"\n=== detection over {sum(r['packets'] for r in rows):,} packets, "
          f"{len(rows)} source endpoints ===")
    print(f"  known malicious: {len(mal)}   threshold: {args.threshold}")
    print(f"\n  {'rank':<5}{'source ip':<16}{'score':>6}{'pkts':>8}{'dstHosts':>9}"
          f"{'dstPorts':>9}{'rate/s':>8}  verdict")
    for i, r in enumerate(rows[:20], 1):
        v = "MALICIOUS" if r["score"] >= args.threshold else "benign"
        gt = " (known-bad)" if r["ip"] in mal else ""
        print(f"  {i:<5}{r['ip']:<16}{r['score']:>6}{r['packets']:>8}"
              f"{r['dst_hosts']:>9}{r['dst_ports']:>9}{r['conn_rate_s']:>8}  {v}{gt}")
    print(f"\n  precision {ev['precision']}  recall {ev['recall']}  f1 {ev['f1']}  "
          f"(tp={ev['tp']} fp={ev['fp']} fn={ev['fn']} tn={ev['tn']})")

    if args.out:
        json.dump({"endpoints": rows, "evaluation": ev, "malicious": sorted(mal)},
                  open(args.out, "w"), indent=2)
        print(f"\n  -> {args.out}")


if __name__ == "__main__":
    main()
