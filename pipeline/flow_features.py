"""
Windowed flow features from one real CIC-IDS-2018 capture.

One row per time window per capture. Nothing is invented: every column is an
aggregate over flows that are actually in the source file, and columns the
source cannot support are left absent rather than zero-filled — a zero reads
downstream as a measurement, and that is how "11 packet columns of zeros" gets
mistaken for extracted data.

Two properties are worth checking in the output, because they are what
distinguishes a real extraction from a generated one:

  * benign volume varies severalfold across the day and drops to nothing
    overnight, because the capture is a business day with gaps at both ends
  * attack episodes have the durations the published schedule gives them
    (Feb-14: FTP-BruteForce 97 min, SSH-Bruteforce 91 min), not a uniform
    few minutes each
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import entropy

from .cicids import FLAG_COLS, IAT_COLS, LABEL_COL, VOLUME_COLS, find_col


def _shannon(series: pd.Series) -> float:
    if len(series) == 0:
        return 0.0
    counts = series.value_counts().to_numpy(dtype=float)
    if counts.sum() == 0:
        return 0.0
    return float(entropy(counts / counts.sum(), base=2))


def _agg(grp: pd.DataFrame, col: str | None, how: str = "mean") -> float:
    """Aggregate one source column, or NaN when the source does not have it.

    NaN, never 0. A missing column is an absence of measurement and has to stay
    distinguishable from a measured zero.
    """
    if col is None or col not in grp.columns:
        return np.nan
    s = pd.to_numeric(grp[col], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if s.empty:
        return np.nan
    return float(getattr(s, how)())


def window_flow_features(df: pd.DataFrame, window_seconds: int = 60, capture_id: str = "") -> pd.DataFrame:
    """One feature row per `window_seconds` of the capture.

    Windows with no flows are NOT emitted. A capture is a business day; padding
    the empty hours would manufacture a seamless 24h timeline that the source
    never contained.
    """
    df = df.copy()
    df["_win"] = df["_ts"].dt.floor(f"{window_seconds}s")

    cols = {name: find_col(df, name) for name in FLAG_COLS + IAT_COLS + VOLUME_COLS}
    dport = find_col(df, "Dst IP", "Dst Port")
    dport_col = find_col(df, "Dst Port")
    proto_col = find_col(df, "Protocol")
    src_col = find_col(df, "Src IP")
    dst_col = find_col(df, "Dst IP")

    rows = []
    for win, grp in df.groupby("_win", sort=True):
        labels = grp[LABEL_COL]
        attack = labels[labels.str.lower() != "benign"]
        dominant = attack.value_counts().idxmax() if len(attack) else "Benign"

        row = {
            "capture_id": capture_id,
            "window_start": win,
            "window_seconds": window_seconds,
            "n_flows": int(len(grp)),
            "n_attack_flows": int(len(attack)),
            "attack_ratio": float(len(attack) / len(grp)) if len(grp) else 0.0,
            "label": dominant,
            "is_attack": int(len(attack) > 0),
        }

        # --- flow-level volume -------------------------------------------
        for name in VOLUME_COLS:
            key = "flow_" + name.lower().replace(" ", "_").replace("/", "_per_").replace(".", "")
            row[key] = _agg(grp, cols[name], "mean")

        row["flow_duration_max"] = _agg(grp, cols["Flow Duration"], "max")
        row["tot_fwd_pkts_sum"] = _agg(grp, cols["Tot Fwd Pkts"], "sum")
        row["tot_bwd_pkts_sum"] = _agg(grp, cols["Tot Bwd Pkts"], "sum")
        row["totlen_fwd_sum"] = _agg(grp, cols["TotLen Fwd Pkts"], "sum")
        row["totlen_bwd_sum"] = _agg(grp, cols["TotLen Bwd Pkts"], "sum")

        fwd, bwd = row["tot_fwd_pkts_sum"], row["tot_bwd_pkts_sum"]
        row["bidirectional_ratio"] = float(bwd / fwd) if fwd and not np.isnan(fwd) and fwd > 0 else np.nan

        # --- TCP flags ----------------------------------------------------
        # These are the columns that were reading as broken. They are summed,
        # not averaged: the count of SYNs in a window is the signal, and a mean
        # over flows flattens a SYN flood into something unremarkable.
        for name in FLAG_COLS:
            key = "flag_" + name.lower().replace(" ", "_").replace("cnt", "count")
            row[key] = _agg(grp, cols[name], "sum")

        syn = row.get("flag_syn_flag_count", np.nan)
        ack = row.get("flag_ack_flag_count", np.nan)
        row["syn_ack_ratio"] = float(syn / ack) if ack and not np.isnan(ack) and ack > 0 else np.nan
        row["rst_rate"] = (
            float(row.get("flag_rst_flag_count", np.nan) / row["n_flows"]) if row["n_flows"] else np.nan
        )

        # --- inter-arrival timing ----------------------------------------
        for name in IAT_COLS:
            key = "iat_" + name.lower().replace(" ", "_")
            row[key] = _agg(grp, cols[name], "mean")

        # --- distributional structure -------------------------------------
        row["dst_port_entropy"] = _shannon(grp[dport_col]) if dport_col else np.nan
        row["n_unique_dst_ports"] = int(grp[dport_col].nunique()) if dport_col else np.nan
        row["proto_entropy"] = _shannon(grp[proto_col]) if proto_col else np.nan
        row["n_unique_src"] = int(grp[src_col].nunique()) if src_col else np.nan
        row["n_unique_dst"] = int(grp[dst_col].nunique()) if dst_col else np.nan

        # --- packet-level presence ----------------------------------------
        # The processed-flow CSVs are flow records. Packet-level features (TTL
        # variance, IP fragment flags, retransmission counts, per-session window
        # size drift) are not derivable from them — they need the PCAPs, or a
        # live capture. Declared, not faked.
        row["has_packet_data"] = 0

        rows.append(row)

    out = pd.DataFrame(rows).sort_values("window_start").reset_index(drop=True)

    # Gap accounting, so a reader can see the capture is a business day rather
    # than a seamless 24h stream.
    if len(out) > 1:
        deltas = out["window_start"].diff().dt.total_seconds()
        out["gap_before_seconds"] = deltas.fillna(0).astype(int)
    else:
        out["gap_before_seconds"] = 0

    return out


def episodes(features: pd.DataFrame) -> pd.DataFrame:
    """Contiguous runs of the same attack label — the episode view the schedule
    is checked against. A run ends when the label changes or a window is
    missing (an actual gap in the capture), never by a fixed length."""
    rows = []
    cur = None
    prev_win = None
    step = int(features["window_seconds"].iloc[0]) if len(features) else 60

    for _, r in features.iterrows():
        lab = r["label"]
        contiguous = prev_win is not None and (r["window_start"] - prev_win).total_seconds() <= step
        if cur and cur["label"] == lab and contiguous:
            cur["end"] = r["window_start"]
            cur["windows"] += 1
            cur["flows"] += int(r["n_flows"])
        else:
            if cur:
                rows.append(cur)
            cur = {"label": lab, "start": r["window_start"], "end": r["window_start"], "windows": 1, "flows": int(r["n_flows"])}
        prev_win = r["window_start"]
    if cur:
        rows.append(cur)

    ep = pd.DataFrame(rows)
    if len(ep):
        ep["duration_min"] = ((ep["end"] - ep["start"]).dt.total_seconds() + step) / 60
    return ep
