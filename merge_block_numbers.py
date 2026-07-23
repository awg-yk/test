"""
scripts/merge_block_numbers.py
------------------------------------------------------------
scripts/fetch_block_numbers.py が出力した data/block_numbers.json を、
data/stations.json の各観測所に precNo / blockNo としてマージする。

実行方法:
  python3 scripts/merge_block_numbers.py \
    --stations data/stations.json \
    --block-numbers data/block_numbers.json \
    --output data/stations.json

マッチング方法:
  1. (都道府県名, 地点名) の完全一致でマッチさせる
     （北海道は14地方に分かれているが、prefName は「北海道」に統一済み）
  2. 完全一致しなかったものは、地点名のみでの一致を試みる
     （表記ゆれで都道府県境界付近の判定がずれているケースの救済）
  3. それでもマッチしないものは unmatched として一覧表示する
     （手動でのマッチング表整備や、amedastable.json側の県境判定の見直しに使う）

このスクリプトは複数回実行しても安全（precNo/blockNoを都度上書きするだけ）。
"""

import argparse
import json
from collections import defaultdict


def main():
    parser = argparse.ArgumentParser(description="Merge precNo/blockNo into stations.json")
    parser.add_argument("--stations", default="data/stations.json")
    parser.add_argument("--block-numbers", default="data/block_numbers.json")
    parser.add_argument("--output", default="data/stations.json")
    args = parser.parse_args()

    stations_data = json.load(open(args.stations, encoding="utf-8"))
    block_numbers = json.load(open(args.block_numbers, encoding="utf-8"))

    # (prefecture, name) -> record 、name のみ -> [records] の索引を作る
    by_pref_name = {}
    by_name_only = defaultdict(list)
    for rec in block_numbers:
        by_pref_name[(rec["prefName"], rec["name"])] = rec
        by_name_only[rec["name"]].append(rec)

    matched, matched_by_name_only, unmatched = 0, 0, []

    for station in stations_data["stations"]:
        key = (station["prefecture"], station["name"])
        rec = by_pref_name.get(key)

        if rec is None:
            candidates = by_name_only.get(station["name"], [])
            if len(candidates) == 1:
                rec = candidates[0]
                matched_by_name_only += 1

        if rec is not None:
            station["precNo"] = rec["precNo"]
            station["blockNo"] = rec["blockNo"]
            matched += 1
        else:
            unmatched.append((station["id"], station["name"], station["prefecture"]))

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(stations_data, f, ensure_ascii=False, indent=2)

    total = len(stations_data["stations"])
    print(f"matched (prefecture+name): {matched - matched_by_name_only} / {total}")
    print(f"matched (name only, unambiguous): {matched_by_name_only} / {total}")
    print(f"total matched: {matched} / {total}")
    print(f"unmatched: {len(unmatched)} / {total}")
    if unmatched:
        print("\n--- unmatched stations (id, name, prefecture) ---")
        for row in unmatched[:50]:
            print("  ", row)
        if len(unmatched) > 50:
            print(f"  ... and {len(unmatched) - 50} more")
    print(f"\nwritten to {args.output}")


if __name__ == "__main__":
    main()
