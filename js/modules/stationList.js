/**
 * stationList.js
 * ------------------------------------------------------------
 * 観測所一覧をテーブルとして描画するモジュール。
 * フェーズ1では store.visibleStations をそのまま表示するだけだが、
 * フェーズ2/3で地域・要素フィルタが store を更新するたびに
 * 再描画されるよう、store.subscribe に接続する設計にしている。
 */

import { h } from "../utils/helpers.js";
import { buildJmaStationLink, buildJmaPrefectureLink } from "./exporter.js";

/** 観測要素タグは要素ごとに色分けする（CSS側の .tag--<id> と対応。凡例は観測要素フィルタのドット） */
function renderElementTags(elementIds, elementLabelMap) {
  const wrap = h("div", { class: "element-tags" });
  elementIds.forEach((id) => {
    const label = elementLabelMap.get(id) ?? id;
    wrap.append(h("span", { class: `tag tag--${id}` }, label));
  });
  return wrap;
}

/**
 * 地点名セル。気象庁「過去の気象データ検索」の当該地点ページへのリンクにする。
 * 地点番号が確定していない7地点は、都道府県までを選択済みのページへ案内する
 * （どのリンクも必ず有効なページに着地するようにしている）。
 */
function renderNameCell(station) {
  const stationUrl = buildJmaStationLink(station);
  if (stationUrl) {
    return h(
      "a",
      {
        class: "station-table__name station-table__name--link",
        href: stationUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        title: `気象庁「過去の気象データ検索」で${station.name}のデータを開く`,
      },
      `${station.name} ↗`
    );
  }

  const prefectureUrl = buildJmaPrefectureLink(station);
  if (prefectureUrl) {
    const candidates = station.blockNoAmbiguousCandidates?.join(" / ") ?? "";
    return h(
      "a",
      {
        class: "station-table__name station-table__name--link station-table__name--ambiguous",
        href: prefectureUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        title: `気象庁側に同名で複数の地点番号（${candidates}）があり自動判定を保留しています。都道府県の地点選択ページを開くので、地図から地点を選んでください。`,
      },
      `${station.name} ↗*`
    );
  }

  return h("span", { class: "station-table__name" }, station.name);
}

/** 行クリック（または行にフォーカスしてEnter/Space）で observeStation を選択状態にする。
 *  地図のマーカーをクリックしたときと同じ store.selectedStationId を介した相互連携（フェーズ15）。 */
function renderRow(station, elementLabelMap, regionLabelMap, selectedStationId, onSelectStation) {
  const isSelected = station.id === selectedStationId;
  const selectRow = () => onSelectStation?.(station.id);
  return h(
    "tr",
    {
      class: `station-table__row${isSelected ? " station-table__row--selected" : ""}`,
      tabindex: "0",
      "aria-selected": isSelected ? "true" : "false",
      onClick: selectRow,
      onKeydown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRow();
        }
      },
    },
    [
      h("td", {}, h("span", { class: "station-table__id mono" }, station.id)),
      h("td", {}, renderNameCell(station)),
      h("td", {}, h("span", { class: "station-table__kana" }, station.kana ?? "")),
      h("td", {}, station.prefecture),
      h("td", {}, regionLabelMap.get(station.region) ?? station.region),
      h("td", { class: "station-table__num" }, h("span", { class: "mono" }, formatNumber(station.alt, 0))),
      h("td", { class: "station-table__num" }, h("span", { class: "mono" }, formatNumber(station.lat, 4))),
      h("td", { class: "station-table__num" }, h("span", { class: "mono" }, formatNumber(station.lon, 4))),
      h("td", {}, renderElementTags(station.elements, elementLabelMap)),
      h("td", {}, h("span", { class: "badge-type" }, station.stationType)),
    ]
  );
}

/** 数値を固定小数桁で表示する（欠測は「—」）。緯度経度は4桁≒10m精度で十分 */
function formatNumber(value, digits) {
  return typeof value === "number" ? value.toFixed(digits) : "—";
}

export function renderStationTable(
  container,
  stations,
  { elementLabelMap, regionLabelMap, selectedStationId = null, onSelectStation } = {}
) {
  container.innerHTML = "";

  if (stations.length === 0) {
    container.append(h("div", { class: "empty-state" }, "条件に一致する観測所がありません。"));
    return;
  }

  const table = h("table", { class: "station-table" });
  const thead = h("thead", {}, h("tr", {}, [
    h("th", {}, "地点コード"),
    h("th", {}, "地点名"),
    h("th", {}, "かな"),
    h("th", {}, "都道府県"),
    h("th", {}, "地方"),
    h("th", { class: "station-table__num" }, "標高(m)"),
    h("th", { class: "station-table__num" }, "緯度"),
    h("th", { class: "station-table__num" }, "経度"),
    h("th", {}, "観測要素"),
    h("th", {}, "種別"),
  ]));

  const tbody = h("tbody", {});
  let selectedRow = null;
  stations.forEach((station) => {
    const row = renderRow(station, elementLabelMap, regionLabelMap, selectedStationId, onSelectStation);
    if (station.id === selectedStationId) selectedRow = row;
    tbody.append(row);
  });

  table.append(thead, tbody);
  container.append(table);

  // 地図のマーカークリックで選択された行を、一覧のスクロール位置に入れる（jsdomにはscrollIntoViewが無いため任意呼び出し）
  selectedRow?.scrollIntoView?.({ block: "nearest" });
}

export function renderLoading(container, message = "観測所データを読み込み中...") {
  container.innerHTML = "";
  container.append(h("div", { class: "loading-state" }, message));
}

export function renderError(container, message) {
  container.innerHTML = "";
  container.append(h("div", { class: "empty-state" }, message));
}
