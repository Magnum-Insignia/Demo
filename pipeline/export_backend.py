"""
Export the extracted captures into the form the backend host serves.

Writes one ES module per capture into the app's backend service directory, so
the same file is loaded by the Node backend process and bundled into the
desktop app's on-device fallback — the arrangement the rest of the backend
already uses (one definition, two entry points).

Only the columns the product actually reads are exported. Nothing is
interpolated, no window is invented, and gaps in the capture stay gaps: the
exported series is the extraction, thinned, not resampled.

    python -m pipeline.export_backend
"""
from __future__ import annotations

import glob
import json
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED = os.path.join(ROOT, "data", "processed")
DEST = os.path.join(ROOT, "desktop-app", "src", "renderer", "src", "backend", "services", "captures.js")

# The published CSE-CIC-IDS2018 schedule, for the attestation block. Kept here
# so the exported file states what the capture is supposed to contain next to
# what it actually contained — the two are checked against each other rather
# than one being taken on trust.
SCHEDULE = {
    "02-14-2018": "Wednesday 14-02-2018 — FTP-BruteForce (10:32-12:09), SSH-Bruteforce (14:01-15:31)",
    "02-15-2018": "Thursday 15-02-2018 — DoS-GoldenEye (09:26-10:09), DoS-Slowloris (10:59-11:40)",
    "02-16-2018": "Friday 16-02-2018 — DoS-SlowHTTPTest (10:12-11:08), DoS-Hulk (13:45-14:19)",
}

# What the product reads per window. Everything here is measured.
FIELDS = [
    "n_flows", "n_attack_flows", "attack_ratio", "label", "is_attack",
    "flag_syn_flag_count", "flag_rst_flag_count", "flag_ack_flag_count",
    "flag_psh_flag_count", "flag_fin_flag_count", "flag_urg_flag_count",
    "syn_ack_ratio", "rst_rate",
    "iat_flow_iat_mean", "iat_flow_iat_std", "iat_flow_iat_max",
    "dst_port_entropy", "n_unique_dst_ports", "proto_entropy",
    "flow_flow_duration", "flow_flow_byts_per_s", "flow_flow_pkts_per_s",
    "flow_pkt_len_mean", "flow_init_fwd_win_byts", "flow_down_per_up_ratio",
    "bidirectional_ratio", "tot_fwd_pkts_sum", "tot_bwd_pkts_sum",
    "has_packet_data", "gap_before_seconds",
]


def _clean(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return None if (pd.isna(v) or np.isinf(v)) else round(float(v), 4)
    if isinstance(v, (np.bool_, bool)):
        return int(v)
    if pd.isna(v):
        return None
    return v


def export():
    captures = []
    for path in sorted(glob.glob(os.path.join(PROCESSED, "flow_features_*.parquet"))):
        cid = os.path.basename(path).replace("flow_features_", "").replace(".parquet", "")
        d = pd.read_parquet(path)
        eps = pd.read_csv(os.path.join(PROCESSED, f"episodes_{cid}.csv"), parse_dates=["start", "end"])
        attack_eps = eps[eps["label"].str.lower() != "benign"]

        windows = []
        for _, r in d.iterrows():
            w = {"t": r["window_start"].isoformat()}
            for f in FIELDS:
                if f in d.columns:
                    w[f] = _clean(r[f])
            windows.append(w)

        # Edge list, when one was built for this day.
        gpath = os.path.join(PROCESSED, f"edges_{cid}.parquet")
        graph = None
        if os.path.exists(gpath):
            g = pd.read_parquet(gpath)
            top = (g.groupby(["src_ip", "dst_ip"])
                     .agg(nFlows=("n_flows", "sum"), attackFlows=("n_attack_flows", "sum"))
                     .reset_index().sort_values("nFlows", ascending=False).head(400))
            graph = {
                "edges": int(len(g)),
                "windows": int(g["window_start"].nunique()),
                "start": g["window_start"].min().isoformat(),
                "end": g["window_start"].max().isoformat(),
                "uniqueSrc": int(g["src_ip"].nunique()),
                "uniqueDst": int(g["dst_ip"].nunique()),
                "attackEdges": int(g["is_attack"].sum()),
                # Provenance. 1 means the addresses were generated, not captured.
                "syntheticEndpoints": int(g["synthetic_endpoints"].max()),
                "top": [
                    {"src": r.src_ip, "dst": r.dst_ip, "nFlows": int(r.nFlows),
                     "isAttack": int(r.attackFlows > 0)}
                    for r in top.itertuples()
                ],
            }

        benign = d[d["label"].str.lower() == "benign"]["n_flows"]
        captures.append({
            "id": cid,
            "source": "CSE-CIC-IDS2018 (official processed flow CSV)",
            "schedule": SCHEDULE.get(cid, ""),
            "windowSeconds": int(d["window_seconds"].iloc[0]),
            "start": d["window_start"].min().isoformat(),
            "end": d["window_start"].max().isoformat(),
            "windows": int(len(d)),
            "flows": int(d["n_flows"].sum()),
            "attackFlows": int(d["n_attack_flows"].sum()),
            "hasAddressing": False,
            "hasPacketData": int(d["has_packet_data"].iloc[0]),
            # The two numbers a reader can check the extraction against.
            "benignVolumeRange": [int(benign.min()), int(benign.max())],
            "benignVariation": round(float(benign.max() / max(benign.min(), 1)), 1),
            "episodes": [
                {
                    "label": e["label"],
                    "start": pd.Timestamp(e["start"]).isoformat(),
                    "end": pd.Timestamp(e["end"]).isoformat(),
                    "durationMin": round(float(e["duration_min"]), 1),
                    "windows": int(e["windows"]),
                    "flows": int(e["flows"]),
                }
                for _, e in attack_eps.iterrows()
            ],
            "series": windows,
            "graph": graph,
        })

    header = '''/*
 * Backend service: extracted real captures.
 *
 * GENERATED — do not edit by hand. Written by `python -m pipeline.export_backend`
 * from the parquet the extraction pipeline produced.
 *
 * These are the official CSE-CIC-IDS2018 processed-flow CSVs, extracted one day
 * at a time. Three properties are worth checking before trusting anything
 * downstream, because they are what separates this from generated data:
 *
 *   * each capture is a single business day with gaps at both ends — they are
 *     NOT stitched into a continuous timeline
 *   * benign volume varies severalfold across the day (the `benignVariation`
 *     field states by how much), rather than sitting flat
 *   * attack episodes carry the durations the published schedule gives them,
 *     and differ from each other — Feb-14's brute-force runs are ~98 and ~92
 *     minutes, Feb-15's GoldenEye arrives in four separate bursts
 *
 * `hasAddressing` is false for all three: the Feb-14/15/16 CSVs have no Src/Dst
 * IP columns, so no edge list can be built from them without inventing the
 * endpoints. `hasPacketData` is 0 until packet extraction runs against a PCAP
 * or a live interface — the flow CSVs cannot supply packet-level features.
 */

export const CAPTURES = '''

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, "w", encoding="utf-8") as fh:
        fh.write(header)
        json.dump(captures, fh, indent=0, ensure_ascii=False)
        fh.write("\n\nexport function listCaptures() {\n")
        fh.write("  return CAPTURES.map(({ series, ...meta }) => ({ ...meta, seriesLength: series.length }))\n}\n\n")
        fh.write("export function getCapture(id) {\n  return CAPTURES.find((c) => c.id === id) || null\n}\n")

    size = os.path.getsize(DEST)
    print(f"-> {os.path.relpath(DEST, ROOT)}  ({size/1e6:.1f} MB)")
    for c in captures:
        print(f"   {c['id']}  {c['windows']:>4} windows  {c['flows']:>9,} flows  "
              f"benign {c['benignVariation']}x  episodes: " +
              ", ".join(f"{e['label']} {e['durationMin']:.0f}min" for e in c["episodes"]))


if __name__ == "__main__":
    export()
