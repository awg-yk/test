"""
scripts/build_stations.py
------------------------------------------------------------
気象庁の公式アメダス観測所マスタ（amedastable.json）から、
data/stations.json（このアプリの観測所マスタ）を再構築するスクリプト。

事前準備:
  1. 気象庁のアメダス観測所表をダウンロードする
       https://www.jma.go.jp/bosai/amedas/const/amedastable.json
     → このリポジトリ直下（またはお好きな場所）に保存する
  2. 都道府県境界のGeoJSONをダウンロードする（dataofjapan/land, 約13MB。
     サイズが大きいためこのリポジトリには同梱していない）
       https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson
  3. 依存ライブラリをインストールする
       pip install shapely

実行方法:
  python3 scripts/build_stations.py \
    --amedas /path/to/amedastable.json \
    --geojson /path/to/japan.geojson \
    --existing data/stations.json \
    --output data/stations.json

処理内容:
  1. lat/lon を [度, 分] から10進度に変換
  2. 都道府県境界GeoJSON + shapely で、点(lat, lon)がどの都道府県ポリゴンに
     属するかを判定（point-in-polygon）。ポリゴンに入らない場合（沿岸部・離島の
     座標誤差など）は最近傍の都道府県を採用する
  3. 既存の regions マスタ（8地方+沖縄）から都道府県→地方の逆引きテーブルを作成
  4. elems（8桁: 気温・降水量・風向・風速・日照時間・積雪深・湿度・気圧）から
     このアプリの6要素（temperature/precipitation/wind/snow/humidity/sunshine）を
     導出する。wind は風向・風速のいずれかが1なら有効。気圧はこのアプリの要素に
     無いため無視する
  5. type（A〜G）から stationType を単純化する（A=気象官署、それ以外=アメダス）

注意:
  precNo / blockNo（気象庁「過去の気象データ検索」(etrn) 用の地点番号）は、
  amedastable.json の観測所コードとは異なる採番のため、このスクリプトでは
  生成しない。正確な対応表を用意できた場合は、生成後の stations.json に
  手動 or 別スクリプトで追加することを想定している。
"""

import argparse
import json
from collections import Counter

from shapely.geometry import Point, shape

# elems の桁 -> このアプリの要素ID （None は対応要素なし = 無視）
ELEMS_INDEX_MAP = {
    0: "temperature",
    1: "precipitation",
    2: "wind",  # 風向
    3: "wind",  # 風速（風向と同じ扱い。どちらかが1ならwind=観測あり）
    4: "sunshine",
    5: "snow",
    6: "humidity",
    7: None,  # 気圧（このアプリでは扱わない）
}


def dms_to_decimal(dm):
    """[度, 分] -> 10進度"""
    deg, minute = dm
    return round(deg + minute / 60, 6)


def elems_to_element_list(elems: str):
    ids, seen = [], set()
    for i, ch in enumerate(elems):
        target = ELEMS_INDEX_MAP.get(i)
        if target is None:
            continue
        if ch != "0" and target not in seen:  # '1'(観測) or '2'(推定値) を「観測あり」扱い
            ids.append(target)
            seen.add(target)
    return ids


def station_type_label(type_code: str) -> str:
    return "気象官署" if type_code == "A" else "アメダス"


def main():
    parser = argparse.ArgumentParser(description="Rebuild data/stations.json from JMA amedastable.json")
    parser.add_argument("--amedas", required=True, help="path to amedastable.json")
    parser.add_argument("--geojson", required=True, help="path to Japan prefecture boundary GeoJSON")
    parser.add_argument("--existing", required=True, help="path to existing stations.json (for regions/elements master)")
    parser.add_argument("--output", required=True, help="path to write the rebuilt stations.json")
    args = parser.parse_args()

    amedas = json.load(open(args.amedas, encoding="utf-8"))
    geo = json.load(open(args.geojson, encoding="utf-8"))
    existing = json.load(open(args.existing, encoding="utf-8"))

    pref_polygons = [(f["properties"]["nam_ja"], shape(f["geometry"])) for f in geo["features"]]

    pref_to_region = {}
    for region in existing["regions"]:
        for pref in region["prefectures"]:
            pref_to_region[pref] = region["id"]

    stations = []
    unmatched = []

    for code, info in amedas.items():
        lat = dms_to_decimal(info["lat"])
        lon = dms_to_decimal(info["lon"])
        point = Point(lon, lat)  # GeoJSONはlon,lat順

        matched_pref = None
        for pref_name, poly in pref_polygons:
            if poly.contains(point):
                matched_pref = pref_name
                break

        if matched_pref is None:
            best_pref, best_dist = None, float("inf")
            for pref_name, poly in pref_polygons:
                d = poly.distance(point)
                if d < best_dist:
                    best_dist = d
                    best_pref = pref_name
            matched_pref = best_pref
            unmatched.append((code, info["kjName"], matched_pref, round(best_dist, 4)))

        region_id = pref_to_region.get(matched_pref)
        elements = elems_to_element_list(info["elems"])

        stations.append(
            {
                "id": code,
                "name": info["kjName"],
                "kana": info.get("knName", ""),
                "enName": info.get("enName", ""),
                "prefecture": matched_pref,
                "region": region_id,
                "lat": lat,
                "lon": lon,
                "alt": info.get("alt"),
                "elements": elements,
                "stationType": station_type_label(info["type"]),
            }
        )

    stations.sort(key=lambda s: s["id"])

    output = {"regions": existing["regions"], "elements": existing["elements"], "stations": stations}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"total stations: {len(stations)}")
    print(f"unmatched (nearest-neighbor fallback used): {len(unmatched)}")
    for row in unmatched:
        print("  ", row)

    pref_counts = Counter(s["prefecture"] for s in stations)
    missing_prefs = set(pref_to_region.keys()) - set(pref_counts.keys())
    print(f"\nprefecture counts: {len(pref_counts)} / 47")
    print("prefectures with 0 stations:", missing_prefs or "(none)")


if __name__ == "__main__":
    main()
