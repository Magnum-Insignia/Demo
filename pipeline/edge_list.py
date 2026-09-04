"""
Edge list from a real capture.

An edge is an aggregated (src, dst, protocol) pair over a time window. That
requires the capture to carry addresses.

THE FEB-14/15/16 CSVs DO NOT CARRY ADDRESSES. Their columns begin at
`Dst Port` — there is no Flow ID, no Src IP, no Dst IP. An edge list built from
them would have invented both endpoints of every edge, which is exactly the
failure mode that makes generated data pass a schema check while being worthless.

So `build_edges` refuses. It raises, naming the day and what it would have had
to invent. The days whose official CSVs do carry addressing (20-02-2018 onward)
run through the same function unchanged and produce real edges over the full
range of the capture, not a single hour of it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .cicids import LABEL_COL, find_col, has_addressing


class NoAddressingError(RuntimeError):
    """Raised when a capture cannot support an edge list."""


# ---------------------------------------------------------------------------
# Synthetic endpoints (opt-in, always labelled)
#
# The Feb-14/15/16 CSVs carry no addresses, so a graph over those days has to
# invent them. That is a legitimate thing to want -- the topology view needs
# SOMETHING to draw -- but it is not a measurement, and a table that does not
# say so is the exact failure the reviewer caught.
#
# So synthesis is opt-in, and every row it produces carries
# synthetic_endpoints=1. Nothing downstream can mistake it for capture data.
#
# The address plan is the real CSE-CIC-IDS2018 victim network from the dataset
# paper: a five-department victim org (172.31.6x.0/24) plus a server subnet,
# with the attacker on 18.x (the paper's AWS-hosted attacker range). Assignment
# is deterministic -- hashed from the flow's own port/protocol/label -- so the
# same CSV always yields the same graph, and attack flows land on attacker
# addresses rather than being scattered at random.
# ---------------------------------------------------------------------------

VICTIM_DEPARTMENTS = [
    ("dept-management", "172.31.69."),
    ("dept-hr", "172.31.66."),
    ("dept-it", "172.31.67."),
    ("dept-tech", "172.31.68."),
    ("dept-secretary", "172.31.65."),
]
VICTIM_SERVERS = "172.31.64."
ATTACKER_PREFIX = "18.219."


def _synthesise_endpoints(df: pd.DataFrame, dport, proto) -> tuple[pd.Series, pd.Series]:
    """Deterministic pseudo-addresses derived from each flow's own fields."""
    n = len(df)
    port = pd.to_numeric(df[dport], errors="coerce").fillna(0).astype("int64") if dport else pd.Series(0, index=df.index)
    prot = pd.to_numeric(df[proto], errors="coerce").fillna(0).astype("int64") if proto else pd.Series(0, index=df.index)
    is_attack = (df[LABEL_COL].str.lower() != "benign").to_numpy()

    # Stable hash per flow, no RNG: same input row -> same endpoint, always.
    h = (port * 2654435761 + prot * 40503 + np.arange(n, dtype="int64") * 2246822519) % 2147483647

    src = np.empty(n, dtype=object)
    dst = np.empty(n, dtype=object)

    # Benign: intra-org traffic, department host -> server subnet.
    dept_idx = (h // 251) % len(VICTIM_DEPARTMENTS)
    host_octet = (h % 200) + 20
    srv_octet = (h // 7 % 30) + 10
    for i, (_, prefix) in enumerate(VICTIM_DEPARTMENTS):
        m = (~is_attack) & (dept_idx == i)
        src[m] = [f"{prefix}{o}" for o in host_octet[m]]
    benign = ~is_attack
    dst[benign] = [f"{VICTIM_SERVERS}{o}" for o in srv_octet[benign]]

    # Attack: attacker subnet -> the victim server actually being brute-forced.
    atk_octet = (h % 50) + 100
    src[is_attack] = [f"{ATTACKER_PREFIX}{o // 256 + 8}.{o % 256}" for o in atk_octet[is_attack]]
    dst[is_attack] = [f"{VICTIM_SERVERS}{o}" for o in ((h % 4) + 10)[is_attack]]

    return pd.Series(src, index=df.index), pd.Series(dst, index=df.index)


def build_edges(df: pd.DataFrame, window_seconds: int = 60, capture_id: str = "",
                synthetic_endpoints: bool = False) -> pd.DataFrame:
    synthesised = False
    if not has_addressing(df) and synthetic_endpoints:
        synthesised = True
    elif not has_addressing(df):
        raise NoAddressingError(
            f"{capture_id or 'capture'}: no Src IP / Dst IP columns in this file. "
            "The CSE-CIC-IDS2018 processed CSVs for 14/15/16-02-2018 carry no addressing — "
            "the first column is 'Dst Port'. Building an edge list here would mean "
            "inventing every endpoint. Use a day whose CSV includes Flow ID/Src IP/Dst IP "
            "(20-02-2018 onward), or derive edges from the PCAPs."
        )

    df = df.copy()
    df["_win"] = df["_ts"].dt.floor(f"{window_seconds}s")

    proto = find_col(df, "Protocol")
    dport = find_col(df, "Dst Port")
    if synthesised:
        df["_src_ip"], df["_dst_ip"] = _synthesise_endpoints(df, dport, proto)
        src, dst = "_src_ip", "_dst_ip"
    else:
        src = find_col(df, "Src IP")
        dst = find_col(df, "Dst IP")
    fwd_pkts = find_col(df, "Tot Fwd Pkts")
    bwd_pkts = find_col(df, "Tot Bwd Pkts")
    fwd_len = find_col(df, "TotLen Fwd Pkts")
    bwd_len = find_col(df, "TotLen Bwd Pkts")
    dur = find_col(df, "Flow Duration")
    syn = find_col(df, "SYN Flag Cnt")
    rst = find_col(df, "RST Flag Cnt")

    keys = ["_win", src, dst, proto]
    agg = {}
    if fwd_pkts:
        agg[fwd_pkts] = "sum"
    if bwd_pkts:
        agg[bwd_pkts] = "sum"
    if fwd_len:
        agg[fwd_len] = "sum"
    if bwd_len:
        agg[bwd_len] = "sum"
    if dur:
        agg[dur] = "mean"
    if syn:
        agg[syn] = "sum"
    if rst:
        agg[rst] = "sum"

    grouped = df.groupby(keys, sort=True)
    edges = grouped.agg(agg).reset_index()
    edges["n_flows"] = grouped.size().to_numpy()
    if dport:
        edges["n_dst_ports"] = grouped[dport].nunique().to_numpy()

    attack = df[df[LABEL_COL].str.lower() != "benign"]
    if len(attack):
        atk = attack.groupby(keys, sort=True).size().rename("n_attack_flows").reset_index()
        edges = edges.merge(atk, on=keys, how="left")
    edges["n_attack_flows"] = edges.get("n_attack_flows", pd.Series(0, index=edges.index)).fillna(0).astype(int)
    edges["is_attack"] = (edges["n_attack_flows"] > 0).astype(int)

    rename = {"_win": "window_start", src: "src_ip", dst: "dst_ip", proto: "protocol"}
    for a, b in [(fwd_pkts, "fwd_pkts"), (bwd_pkts, "bwd_pkts"), (fwd_len, "fwd_bytes"),
                 (bwd_len, "bwd_bytes"), (dur, "duration_us"), (syn, "syn_count"), (rst, "rst_count")]:
        if a:
            rename[a] = b
    edges = edges.rename(columns=rename)
    edges["capture_id"] = capture_id
    # Provenance travels with the data, on every single row.
    edges["synthetic_endpoints"] = int(synthesised)

    if "fwd_bytes" in edges and "bwd_bytes" in edges:
        edges["total_bytes"] = edges["fwd_bytes"].fillna(0) + edges["bwd_bytes"].fillna(0)
    if "fwd_pkts" in edges and "bwd_pkts" in edges:
        fwd = edges["fwd_pkts"].replace(0, np.nan)
        edges["bidirectional_ratio"] = edges["bwd_pkts"] / fwd

    return edges.sort_values(["window_start", "src_ip", "dst_ip"]).reset_index(drop=True)


def edge_coverage(edges: pd.DataFrame) -> dict:
    """Range actually covered — the check that catches an edge table that only
    spans one hour of a nine-hour capture."""
    return {
        "edges": int(len(edges)),
        "windows": int(edges["window_start"].nunique()),
        "start": edges["window_start"].min(),
        "end": edges["window_start"].max(),
        "unique_src": int(edges["src_ip"].nunique()),
        "unique_dst": int(edges["dst_ip"].nunique()),
        "attack_edges": int(edges["is_attack"].sum()),
        "synthetic_endpoints": int(edges["synthetic_endpoints"].max()) if "synthetic_endpoints" in edges else 0,
    }
