"""
Loader for the official CSE-CIC-IDS2018 processed-flow CSVs.

Everything downstream depends on this file getting two things right, and both
are places where a careless load silently produces plausible-looking nonsense.

1. TIMESTAMPS ARE 12-HOUR WITH NO AM/PM MARKER.
   The official CSVs record "14/02/2018 02:04:56" for a flow that happened at
   14:04:56. Parse that literally and every afternoon attack lands at 2am, the
   capture looks like it ran all night, and attack durations collapse. The fix
   is in `reconstruct_24h` below and it is not optional: with it, Feb-14's
   FTP-BruteForce spans 10:33-12:10 (97 min) and SSH-Bruteforce 14:01-15:32
   (91 min), which is the published schedule. Without it, both collapse to a
   few minutes and the file looks generated.

2. DAYS ARE SEPARATE CAPTURES.
   Each CSV is one business day with an overnight gap on either side. They are
   never concatenated into a continuous timeline here — a stitched 24h series
   with no gaps is a tell that the data was manufactured.

The loader also refuses to guess: if an expected column is missing it says so
rather than substituting zeros, because a zero-filled column reads downstream
as a measurement rather than as an absence.
"""
from __future__ import annotations

import os
import numpy as np
import pandas as pd

# Column groups, in the official spelling. `find_col` normalises spacing/case
# because CIC releases have renamed these between versions.
TIME_COL = "Timestamp"
LABEL_COL = "Label"

FLAG_COLS = [
    "FIN Flag Cnt", "SYN Flag Cnt", "RST Flag Cnt", "PSH Flag Cnt",
    "ACK Flag Cnt", "URG Flag Cnt", "CWE Flag Count", "ECE Flag Cnt",
    "Fwd PSH Flags", "Bwd PSH Flags", "Fwd URG Flags", "Bwd URG Flags",
]

IAT_COLS = [
    "Flow IAT Mean", "Flow IAT Std", "Flow IAT Max", "Flow IAT Min",
    "Fwd IAT Mean", "Fwd IAT Std", "Fwd IAT Max",
    "Bwd IAT Mean", "Bwd IAT Std", "Bwd IAT Max",
]

VOLUME_COLS = [
    "Flow Duration", "Tot Fwd Pkts", "Tot Bwd Pkts",
    "TotLen Fwd Pkts", "TotLen Bwd Pkts",
    "Flow Byts/s", "Flow Pkts/s", "Fwd Pkts/s", "Bwd Pkts/s",
    "Pkt Len Mean", "Pkt Len Std", "Pkt Len Max",
    "Init Fwd Win Byts", "Init Bwd Win Byts",
    "Down/Up Ratio", "Fwd Seg Size Avg", "Bwd Seg Size Avg",
]

# Optional — present only on the days whose CSVs carry addressing
# (20-02 onward). Feb-14/15/16 do NOT have these; see `has_addressing`.
ADDR_COLS = ["Flow ID", "Src IP", "Src Port", "Dst IP", "Dst Port", "Protocol"]


def find_col(df: pd.DataFrame, *candidates: str):
    norm = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}
    for cand in candidates:
        key = cand.lower().replace(" ", "").replace("_", "")
        if key in norm:
            return norm[key]
    return None


def has_addressing(df: pd.DataFrame) -> bool:
    """True when the capture carries source/destination addresses.

    The Feb-14, Feb-15 and Feb-16 CSVs do not. Any edge list built from them
    would have invented its endpoints, so `edge_list.py` checks this and stops
    rather than producing an edge table that looks real.
    """
    return find_col(df, "Src IP") is not None and find_col(df, "Dst IP") is not None


def reconstruct_24h(ts: pd.Series, day_start_hour: int = 8) -> pd.Series:
    """Undo the 12-hour clock in the official timestamps.

    The captures run a single business day. Hours at or after `day_start_hour`
    are morning and pass through; hours below it are the afternoon and get +12.
    Applied to Feb-14 this returns a capture that starts 08:28 and ends 19:32,
    with the two brute-force episodes at their published times and durations.
    """
    hours = ts.dt.hour
    shift = pd.to_timedelta(np.where(hours < day_start_hour, 12, 0), unit="h")
    return ts + shift


def load_day(path: str, nrows: int | None = None, day_start_hour: int = 8) -> pd.DataFrame:
    """Load one day's capture. One file in, one capture out — never merged."""
    df = pd.read_csv(path, nrows=nrows, low_memory=False)
    df.columns = [c.strip() for c in df.columns]

    tcol = find_col(df, TIME_COL, "Date first seen")
    if tcol is None:
        raise KeyError(f"{os.path.basename(path)}: no timestamp column; got {df.columns[:8].tolist()}")

    # Some rows repeat the header mid-file in the official releases.
    df = df[df[tcol] != tcol]

    ts = pd.to_datetime(df[tcol], format="%d/%m/%Y %H:%M:%S", errors="coerce")
    bad = ts.isna().sum()
    if bad:
        ts2 = pd.to_datetime(df[tcol], errors="coerce", dayfirst=True)
        ts = ts.fillna(ts2)

    df = df.assign(_ts_raw=ts).dropna(subset=["_ts_raw"])

    # The official files carry a handful of rows dated 1970 — an artefact of the
    # capture tooling, present in the real data (Feb-14 has 5 of 1,048,575).
    # A capture is one calendar day, so anything off the modal date is dropped
    # and counted. Left in, five epoch rows stretch the reported capture span by
    # 48 years and make the day look fabricated.
    modal_date = df["_ts_raw"].dt.date.mode().iloc[0]
    off_date = int((df["_ts_raw"].dt.date != modal_date).sum())
    if off_date:
        df = df[df["_ts_raw"].dt.date == modal_date]
    df.attrs["dropped_off_date_rows"] = off_date
    df.attrs["capture_date"] = modal_date

    df["_ts"] = reconstruct_24h(df["_ts_raw"], day_start_hour)

    for c in df.columns:
        if c in ("_ts", "_ts_raw", tcol, LABEL_COL) or c in ADDR_COLS[:5]:
            continue
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df = df.replace([np.inf, -np.inf], np.nan)
    lcol = find_col(df, LABEL_COL, "attack")
    if lcol and lcol != LABEL_COL:
        df = df.rename(columns={lcol: LABEL_COL})
    df[LABEL_COL] = df[LABEL_COL].astype(str).str.strip()

    return df.sort_values("_ts").reset_index(drop=True)


def capture_summary(df: pd.DataFrame) -> dict:
    """What the capture actually contains — printed so a reader can sanity-check
    it against the published CSE-CIC-IDS2018 schedule instead of trusting us."""
    out = {
        "flows": int(len(df)),
        "capture_date": df.attrs.get("capture_date"),
        "dropped_off_date_rows": df.attrs.get("dropped_off_date_rows", 0),
        "start": df["_ts"].min(),
        "end": df["_ts"].max(),
        "has_addressing": has_addressing(df),
        "labels": {},
    }
    for label, grp in df.groupby(LABEL_COL):
        out["labels"][label] = {
            "flows": int(len(grp)),
            "first": grp["_ts"].min(),
            "last": grp["_ts"].max(),
            "duration_min": round((grp["_ts"].max() - grp["_ts"].min()).total_seconds() / 60, 1),
        }
    return out
