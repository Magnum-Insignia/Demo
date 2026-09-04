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


def build_edges(df: pd.DataFrame, window_seconds: int = 60, capture_id: str = "") -> pd.DataFrame:
    if not has_addressing(df):
        raise NoAddressingError(
            f"{capture_id or 'capture'}: no Src IP / Dst IP columns in this file. "
            "The CSE-CIC-IDS2018 processed CSVs for 14/15/16-02-2018 carry no addressing — "
            "the first column is 'Dst Port'. Building an edge list here would mean "
            "inventing every endpoint. Use a day whose CSV includes Flow ID/Src IP/Dst IP "
            "(20-02-2018 onward), or derive edges from the PCAPs."
        )

    df = df.copy()
    df["_win"] = df["_ts"].dt.floor(f"{window_seconds}s")

    src = find_col(df, "Src IP")
    dst = find_col(df, "Dst IP")
    proto = find_col(df, "Protocol")
    dport = find_col(df, "Dst Port")
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
    }
