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
  3. 2でも一致しなかったものは、block_numbers.json側の名称が
     「地点名（別名）」という表記（例: つくば（館野）、南大東（南大東島））になっていないか、
     前方一致で確認する。1件だけヒットすればそれを採用する
  4. 1つの(都道府県, 地点名)に対してblock_numbers.json側の候補が複数見つかった場合、
     気象庁の地点選択ページ自体に同名で複数のblock_noが存在するケースであり、
     どちらが現在有効かを自動判定するのは危険なため確定はしない。
     代わりに precNoAmbiguous / blockNoAmbiguousCandidates として候補を記録し、
     precNo/blockNo（＝気象庁ダウンロードページへのリンク生成に使う値）は空のままにする
  5. どの方法でもマッチしないものは unmatched として一覧表示する
     （手動でのマッチング表整備や、amedastable.json側の県境判定の見直しに使う）

このスクリプトは複数回実行しても安全（precNo/blockNo・候補情報を都度上書きするだけ）。
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

    # (prefecture, name) -> [records] （同名地点が複数ある場合に備えてリストで持つ）
    by_pref_name = defaultdict(list)
    by_name_only = defaultdict(list)
    for rec in block_numbers:
        by_pref_name[(rec["prefName"], rec["name"])].append(rec)
        by_name_only[rec["name"]].append(rec)

    matched, matched_by_name_only, matched_by_alias = 0, 0, 0
    ambiguous_count, unmatched = 0, []

    for station in stations_data["stations"]:
        # 前回実行分の注記が残っていると再実行のたびに古い情報が残るのでクリアする
        station.pop("blockNoAmbiguousCandidates", None)
        station.pop("precNoAmbiguous", None)

        key = (station["prefecture"], station["name"])
        candidates = by_pref_name.get(key, [])
        name_only_fallback = False
        alias_fallback = False

        if not candidates:
            candidates = by_name_only.get(station["name"], [])
            name_only_fallback = True

        if not candidates:
            # 「つくば（館野）」「南大東（南大東島）」のような表記ゆれを前方一致で救済する
            alias_candidates = [
                rec
                for rec in block_numbers
                if rec["prefName"] == station["prefecture"] and rec["name"].startswith(station["name"])
            ]
            if alias_candidates:
                candidates = alias_candidates
                alias_fallback = True

        if len(candidates) == 1:
            rec = candidates[0]
            station["precNo"] = rec["precNo"]
            station["blockNo"] = rec["blockNo"]
            matched += 1
            if name_only_fallback:
                matched_by_name_only += 1
            if alias_fallback:
                matched_by_alias += 1
        elif len(candidates) > 1:
            # 同じ都道府県・同じ地点名で複数のblockNo候補がある = 自動判定は危険なのでスキップ。
            # 候補だけ記録しておき、手動確認できるようにする。
            station["precNoAmbiguous"] = candidates[0]["precNo"]
            station["blockNoAmbiguousCandidates"] = sorted({c["blockNo"] for c in candidates})
            ambiguous_count += 1
        else:
            unmatched.append((station["id"], station["name"], station["prefecture"]))

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(stations_data, f, ensure_ascii=False, indent=2)

    total = len(stations_data["stations"])
    print(f"matched (prefecture+name): {matched - matched_by_name_only - matched_by_alias} / {total}")
    print(f"matched (name only, unambiguous): {matched_by_name_only} / {total}")
    print(f"matched (alias/表記ゆれ救済): {matched_by_alias} / {total}")
    print(f"total matched: {matched} / {total}")
    print(f"ambiguous (candidates recorded, not linked): {ambiguous_count} / {total}")
    print(f"unmatched (no candidate found): {len(unmatched)} / {total}")

    if unmatched:
        print("\n--- unmatched stations (id, name, prefecture) ---")
        for row in unmatched[:50]:
            print("  ", row)
        if len(unmatched) > 50:
            print(f"  ... and {len(unmatched) - 50} more")
    print(f"\nwritten to {args.output}")


if __name__ == "__main__":
    main()
