"""
Extraction CLI.

    python -m pipeline.run extract --day data/raw/02-14-2018.csv --id 02-14-2018
    python -m pipeline.run extract-all
    python -m pipeline.run capture --seconds 30 --window 5
    python -m pipeline.run report

Each day is extracted on its own and written to its own files. Days are never
concatenated: a capture is a business day, and the gaps between them are part
of what makes the data real.
"""
from __future__ import annotations

import argparse
import glob
import os
import sys

import pandas as pd

from .cicids import capture_summary, load_day
from .edge_list import NoAddressingError, build_edges, edge_coverage
from .flow_features import episodes, window_flow_features
from . import packet_features as pk

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed")


def _fmt(ts):
    return pd.Timestamp(ts).strftime("%Y-%m-%d %H:%M")


def extract_day(path: str, capture_id: str, window_seconds: int = 60, nrows: int | None = None) -> dict:
    os.makedirs(OUT, exist_ok=True)
    print(f"\n=== {capture_id} :: {os.path.basename(path)} ===")

    df = load_day(path, nrows=nrows)
    summary = capture_summary(df)
    print(f"  flows          {summary['flows']:,}")
    print(f"  capture span   {_fmt(summary['start'])} -> {_fmt(summary['end'])}")
    if summary.get("dropped_off_date_rows"):
        print(f"  dropped        {summary['dropped_off_date_rows']} rows dated off {summary['capture_date']} (1970 artefact in the official file)")
    print(f"  addressing     {'present' if summary['has_addressing'] else 'ABSENT (no Src/Dst IP in this file)'}")
    for label, info in sorted(summary["labels"].items(), key=lambda kv: -kv[1]["flows"]):
        print(f"    {label:<24} {info['flows']:>8,} flows  {_fmt(info['first'])[-5:]} -> {_fmt(info['last'])[-5:]}  {info['duration_min']:>6.1f} min")

    feats = window_flow_features(df, window_seconds=window_seconds, capture_id=capture_id)
    fpath = os.path.join(OUT, f"flow_features_{capture_id}.parquet")
    feats.to_parquet(fpath, index=False)
    print(f"  -> {os.path.relpath(fpath)}  ({len(feats):,} windows x {len(feats.columns)} cols)")

    eps = episodes(feats)
    epath = os.path.join(OUT, f"episodes_{capture_id}.csv")
    eps.to_csv(epath, index=False)
    attack_eps = eps[eps["label"].str.lower() != "benign"] if len(eps) else eps
    print(f"  -> {os.path.relpath(epath)}  ({len(attack_eps)} attack episodes)")
    for _, e in attack_eps.iterrows():
        print(f"     {e['label']:<24} {_fmt(e['start'])[-5:]} -> {_fmt(e['end'])[-5:]}  {e['duration_min']:>6.1f} min  {e['windows']:>4} windows")

    result = {"capture_id": capture_id, "summary": summary, "windows": len(feats), "episodes": len(attack_eps)}

    try:
        edges = build_edges(df, window_seconds=window_seconds, capture_id=capture_id)
        gpath = os.path.join(OUT, f"edges_{capture_id}.parquet")
        edges.to_parquet(gpath, index=False)
        cov = edge_coverage(edges)
        print(f"  -> {os.path.relpath(gpath)}  ({cov['edges']:,} edges over {cov['windows']:,} windows, "
              f"{_fmt(cov['start'])[-5:]} -> {_fmt(cov['end'])[-5:]})")
        result["edges"] = cov
    except NoAddressingError as e:
        print(f"  !! edges NOT built: {e}")
        result["edges"] = None

    return result


def cmd_extract(args):
    extract_day(args.day, args.id or os.path.splitext(os.path.basename(args.day))[0],
                window_seconds=args.window, nrows=args.nrows)


def cmd_extract_all(args):
    days = sorted(glob.glob(os.path.join("data", "raw", "*.csv")))
    if not days:
        sys.exit("no captures in data/raw/")
    results = [extract_day(d, os.path.splitext(os.path.basename(d))[0], window_seconds=args.window, nrows=args.nrows)
               for d in days]

    print("\n=== captures extracted ===")
    print("Kept as separate captures — not stitched into a continuous timeline.")
    for r in results:
        s = r["summary"]
        print(f"  {r['capture_id']}  {_fmt(s['start'])} -> {_fmt(s['end'])}  "
              f"{r['windows']:,} windows, {r['episodes']} attack episodes, "
              f"edges: {'yes' if r['edges'] else 'no addressing in source'}")


CAPTURE_HELP = """
Live capture needs a packet-capture driver and elevated privileges:

  Windows   install Npcap (https://npcap.com), ticking "WinPcap API-compatible
            mode", then run this command from an Administrator terminal
  Linux     sudo setcap cap_net_raw,cap_net_admin=eip $(readlink -f $(which python))
            or run under sudo

Without one of those the interface cannot be opened for listening at all, so
there is nothing to extract. Packet columns stay absent and has_packet_data
stays 0 — they are never filled with zeros to make the table look complete.

To exercise the same extractor without a live interface, run it over a file:
  python -m pipeline.run pcap --file <capture.pcap>
"""


def cmd_pcap(args):
    """Packet features from a capture file — the same extractor live capture uses."""
    print(f"Extracting packet features from {args.file}")
    df = pk.from_pcap(args.file, window_seconds=args.window, limit=args.limit)
    if df.empty:
        sys.exit("no IP packets in that capture")
    os.makedirs(OUT, exist_ok=True)
    name = os.path.splitext(os.path.basename(args.file))[0]
    path = os.path.join(OUT, f"packet_features_{name}.parquet")
    df.to_parquet(path, index=False)
    s = pk.live_summary(df)
    print(f"  packets        {s['packets']:,}")
    print(f"  windows        {s['windows']}")
    print(f"  TTL range      {s['ttl_range'][0]:.0f} - {s['ttl_range'][1]:.0f}")
    print(f"  retransmits    {s['retransmits']}")
    carried = [c for c in pk.PACKET_COLUMNS if df[c].notna().any() and (df[c] != 0).any()]
    print(f"  packet columns carrying signal: {len(carried)}/{len(pk.PACKET_COLUMNS)}")
    for c in pk.PACKET_COLUMNS:
        if c not in carried:
            print(f"    {c}: measured zero across every window (not a missing column)")
    print(f"  -> {os.path.relpath(path)}")


def cmd_capture(args):
    print(f"Live capture: {args.seconds}s on {args.iface or 'default interface'} "
          f"(passive - listening only, nothing transmitted)")
    try:
        df = pk.from_live(seconds=args.seconds, window_seconds=args.window, iface=args.iface, bpf=args.bpf,
                          progress=lambda n, t: print(f"  {n:,} packets  {t:.0f}s", end="\r"))
    except Exception as exc:
        sys.exit(f"\nCannot open an interface for capture: {type(exc).__name__}: {exc}\n{CAPTURE_HELP}")
    if df.empty:
        sys.exit(f"\nInterface opened but no packets arrived.\n{CAPTURE_HELP}")
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "packet_features_live.parquet")
    df.to_parquet(path, index=False)
    s = pk.live_summary(df)
    print(f"\n  packets        {s['packets']:,}")
    print(f"  windows        {s['windows']}")
    print(f"  TTL range      {s['ttl_range'][0]:.0f} - {s['ttl_range'][1]:.0f}")
    print(f"  retransmits    {s['retransmits']}")
    print(f"  -> {os.path.relpath(path)}")


def cmd_report(args):
    files = sorted(glob.glob(os.path.join(OUT, "flow_features_*.parquet")))
    if not files:
        sys.exit("nothing extracted yet")
    for f in files:
        d = pd.read_parquet(f)
        cid = d["capture_id"].iloc[0]
        benign = d[d["label"].str.lower() == "benign"]
        by_hour = benign.groupby(benign["window_start"].dt.hour)["n_flows"].mean()
        print(f"\n{cid}: {len(d):,} windows, {_fmt(d['window_start'].min())} -> {_fmt(d['window_start'].max())}")
        print(f"  benign flows/window by hour: " + "  ".join(f"{h:02d}h={v:.0f}" for h, v in by_hour.items()))
        print(f"  benign volume range: {benign['n_flows'].min():.0f} - {benign['n_flows'].max():.0f} "
              f"({benign['n_flows'].max() / max(benign['n_flows'].min(), 1):.1f}x)")
        nz = [c for c in d.columns if c.startswith("flag_") and d[c].notna().any() and (d[c] != 0).any()]
        print(f"  flag columns carrying signal: {len(nz)}/12")
        print(f"  has_packet_data: {int(d['has_packet_data'].iloc[0])}")


def main():
    p = argparse.ArgumentParser(prog="pipeline.run")
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("extract", help="extract one day")
    e.add_argument("--day", required=True)
    e.add_argument("--id")
    e.add_argument("--window", type=int, default=60)
    e.add_argument("--nrows", type=int)
    e.set_defaults(fn=cmd_extract)

    a = sub.add_parser("extract-all", help="extract every capture in data/raw/")
    a.add_argument("--window", type=int, default=60)
    a.add_argument("--nrows", type=int)
    a.set_defaults(fn=cmd_extract_all)

    c = sub.add_parser("capture", help="live packet capture off a local interface")
    c.add_argument("--seconds", type=int, default=30)
    c.add_argument("--window", type=int, default=10)
    c.add_argument("--iface")
    c.add_argument("--bpf")
    c.set_defaults(fn=cmd_capture)

    pc = sub.add_parser("pcap", help="packet features from a capture file")
    pc.add_argument("--file", required=True)
    pc.add_argument("--window", type=int, default=10)
    pc.add_argument("--limit", type=int)
    pc.set_defaults(fn=cmd_pcap)

    r = sub.add_parser("report", help="sanity-check what was extracted")
    r.set_defaults(fn=cmd_report)

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
