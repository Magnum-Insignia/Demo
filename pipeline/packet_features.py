"""
Packet-level features, extracted from actual packets.

The eleven packet columns that were reading as zeros cannot come from the
processed-flow CSVs — those are flow records, and TTL variance, IP fragment
flags, TCP window drift and retransmission counts are properties of individual
packets that flow aggregation has already discarded. There are exactly two
honest sources:

  * a PCAP file (the CIC-IDS-2018 PCAPs, or any capture on disk)
  * a live capture off a local interface

Both land in the same per-window feature table, so whatever consumes packet
features does not care which produced it. `has_packet_data` is set to 1 here
and only here — if this module has not run, it stays 0 upstream.

Live capture is passive: it opens the interface in promiscuous read mode and
never transmits. On Windows it needs Npcap; the CLI reports plainly when that
is missing rather than silently producing an empty table.
"""
from __future__ import annotations

import time
from collections import defaultdict

import numpy as np
import pandas as pd

try:
    from scapy.all import IP, TCP, UDP, PcapReader, sniff, conf  # noqa: F401
    SCAPY = True
except Exception:  # pragma: no cover - scapy missing
    SCAPY = False


PACKET_COLUMNS = [
    "pkt_ttl_mean", "pkt_ttl_std", "pkt_ttl_min", "pkt_ttl_max",
    "pkt_win_mean", "pkt_win_std",
    "pkt_frag_df_ratio", "pkt_frag_mf_ratio",
    "pkt_len_mean", "pkt_len_std",
    "pkt_retransmit_count",
]


def _row(window_start, pkts, window_seconds):
    """Collapse one window's packets into the eleven packet-level features."""
    ttl = np.array([p["ttl"] for p in pkts], dtype=float)
    win = np.array([p["win"] for p in pkts if p["win"] is not None], dtype=float)
    length = np.array([p["len"] for p in pkts], dtype=float)

    # A retransmission is the same (flow, seq) seen more than once. Counting
    # repeats rather than distinct sequences is what makes this a rate signal.
    seen = defaultdict(int)
    retx = 0
    for p in pkts:
        if p["seq"] is None:
            continue
        key = (p["src"], p["dst"], p["sport"], p["dport"], p["seq"], p["len"])
        seen[key] += 1
        if seen[key] > 1:
            retx += 1

    df_bits = np.array([p["df"] for p in pkts], dtype=float)
    mf_bits = np.array([p["mf"] for p in pkts], dtype=float)

    return {
        "window_start": window_start,
        "window_seconds": window_seconds,
        "n_packets": len(pkts),
        "pkt_ttl_mean": float(ttl.mean()) if ttl.size else np.nan,
        "pkt_ttl_std": float(ttl.std()) if ttl.size else np.nan,
        "pkt_ttl_min": float(ttl.min()) if ttl.size else np.nan,
        "pkt_ttl_max": float(ttl.max()) if ttl.size else np.nan,
        "pkt_win_mean": float(win.mean()) if win.size else np.nan,
        "pkt_win_std": float(win.std()) if win.size else np.nan,
        "pkt_frag_df_ratio": float(df_bits.mean()) if df_bits.size else np.nan,
        "pkt_frag_mf_ratio": float(mf_bits.mean()) if mf_bits.size else np.nan,
        "pkt_len_mean": float(length.mean()) if length.size else np.nan,
        "pkt_len_std": float(length.std()) if length.size else np.nan,
        "pkt_retransmit_count": int(retx),
        "has_packet_data": 1,
    }


def _extract(pkt):
    """Pull the packet-level fields we care about; None for anything non-IP."""
    if IP not in pkt:
        return None
    ip = pkt[IP]
    tcp = pkt[TCP] if TCP in pkt else None
    udp = pkt[UDP] if UDP in pkt else None
    return {
        "t": float(pkt.time),
        "src": ip.src,
        "dst": ip.dst,
        "ttl": int(ip.ttl),
        "len": int(ip.len),
        "df": 1 if (ip.flags & 0x2) else 0,
        "mf": 1 if (ip.flags & 0x1) else 0,
        "win": int(tcp.window) if tcp is not None else None,
        "seq": int(tcp.seq) if tcp is not None else None,
        "sport": int(tcp.sport) if tcp is not None else (int(udp.sport) if udp is not None else None),
        "dport": int(tcp.dport) if tcp is not None else (int(udp.dport) if udp is not None else None),
    }


def _windows_from_records(records, window_seconds):
    if not records:
        return pd.DataFrame(columns=["window_start"] + PACKET_COLUMNS)
    buckets = defaultdict(list)
    for r in records:
        bucket = int(r["t"] // window_seconds) * window_seconds
        buckets[bucket].append(r)
    rows = [
        _row(pd.to_datetime(b, unit="s"), pkts, window_seconds)
        for b, pkts in sorted(buckets.items())
    ]
    return pd.DataFrame(rows)


def from_pcap(path: str, window_seconds: int = 60, limit: int | None = None) -> pd.DataFrame:
    """Packet features from a capture file on disk."""
    if not SCAPY:
        raise RuntimeError("scapy is required for packet extraction (pip install scapy)")
    records = []
    with PcapReader(path) as reader:
        for i, pkt in enumerate(reader):
            if limit and i >= limit:
                break
            rec = _extract(pkt)
            if rec:
                records.append(rec)
    return _windows_from_records(records, window_seconds)


def from_live(seconds: int = 30, window_seconds: int = 10, iface: str | None = None,
              bpf: str | None = None, progress=None) -> pd.DataFrame:
    """Passive live capture off a local interface.

    Read-only: the interface is opened for listening and nothing is transmitted,
    which is the posture the product runs in on a monitored segment.
    """
    if not SCAPY:
        raise RuntimeError("scapy is required for live capture (pip install scapy)")

    records = []
    started = time.time()

    def on_packet(pkt):
        rec = _extract(pkt)
        if rec:
            records.append(rec)
            if progress and len(records) % 100 == 0:
                progress(len(records), time.time() - started)

    sniff(iface=iface, filter=bpf, prn=on_packet, timeout=seconds, store=False)
    return _windows_from_records(records, window_seconds)


def live_summary(records_df: pd.DataFrame) -> dict:
    if records_df.empty:
        return {"packets": 0, "windows": 0}
    return {
        "packets": int(records_df["n_packets"].sum()),
        "windows": int(len(records_df)),
        "start": records_df["window_start"].min(),
        "end": records_df["window_start"].max(),
        "ttl_range": (float(records_df["pkt_ttl_min"].min()), float(records_df["pkt_ttl_max"].max())),
        "retransmits": int(records_df["pkt_retransmit_count"].sum()),
    }
