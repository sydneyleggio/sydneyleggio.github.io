"""
Generate rolling MST (Minimum Spanning Tree) data through the Feb-Apr 2020 crash.
Output: data/mst_crash.json

Usage: python scripts/generate_mst.py
Requires: pip install yfinance pandas numpy scipy
"""
import json, os, numpy as np, pandas as pd

try:
    import yfinance as yf
except ImportError:
    raise SystemExit("Install yfinance: pip install yfinance pandas numpy scipy")

TICKERS = [
    "XLK", "XLF", "XLV", "XLE", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE",
    "XLC", "GLD", "TLT", "HYG", "EEM", "SPY", "QQQ", "IWM", "VNQ", "XBI",
    "USO", "SLV", "DBO", "UUP", "TIP"
]

WINDOW = 40        # trading days
STEP = 3           # days between snapshots
START = "2019-11-01"
END   = "2020-06-30"


def pearson_to_dist(C):
    """Convert correlation matrix to MST-ready distance matrix."""
    return np.sqrt(2 * (1 - C))


def kruskal_mst(dist, labels):
    """Kruskal MST — returns list of (i, j, dist) edges."""
    n = len(labels)
    edges = sorted(
        [(dist[i, j], i, j) for i in range(n) for j in range(i + 1, n)]
    )
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x

    def union(a, b):
        a, b = find(a), find(b)
        if a == b: return False
        parent[a] = b; return True

    mst = []
    for d, i, j in edges:
        if union(i, j):
            mst.append({"source": labels[i], "target": labels[j], "distance": round(float(d), 4)})
            if len(mst) == n - 1: break
    return mst


def main():
    print("Downloading price data...")
    raw = yf.download(TICKERS, start=START, end=END, auto_adjust=True, progress=False)["Close"]
    raw = raw.dropna(axis=1, thresh=int(0.9 * len(raw)))
    raw = raw.ffill().dropna()
    tickers = list(raw.columns)
    rets = np.log(raw / raw.shift(1)).dropna()
    dates = list(rets.index.strftime("%Y-%m-%d"))

    snapshots = []
    for start_idx in range(0, len(rets) - WINDOW, STEP):
        window = rets.iloc[start_idx: start_idx + WINDOW]
        date = dates[start_idx + WINDOW - 1]
        C = window.corr().values
        np.fill_diagonal(C, 1.0)
        D = pearson_to_dist(np.clip(C, -1, 1))
        edges = kruskal_mst(D, tickers)
        snapshots.append({"date": date, "edges": edges})
        print(f"  {date} — {len(edges)} edges")

    # Compute per-ticker degree across all snapshots for layout hint
    degree = {t: 0 for t in tickers}
    for s in snapshots:
        for e in s["edges"]:
            degree[e["source"]] += 1
            degree[e["target"]] += 1
    max_deg = max(degree.values()) or 1
    nodes = [{"id": t, "centrality": round(degree[t] / max_deg, 3)} for t in tickers]

    out = {"nodes": nodes, "snapshots": snapshots}
    os.makedirs("data", exist_ok=True)
    with open("data/mst_crash.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"\nWrote data/mst_crash.json — {len(snapshots)} snapshots, {len(tickers)} tickers")


if __name__ == "__main__":
    main()
