/**
 * stationList.js
 * ------------------------------------------------------------
 * 観測所一覧をテーブルとして描画するモジュール。
 * フェーズ1では store.visibleStations をそのまま表示するだけだが、
 * フェーズ2/3で地域・要素フィルタが store を更新するたびに
 * 再描画されるよう、store.subscribe に接続する設計にしている。
 */

import { h } from "../utils/helpers.js";

const SNOW_ELEMENT_ID = "snow";

function renderElementTags(elementIds, elementLabelMap) {
  const wrap = h("div", { class: "element-tags" });
  elementIds.forEach((id) => {
    const label = elementLabelMap.get(id) ?? id;
    const tagClass = id === SNOW_ELEMENT_ID ? "tag tag--snow" : "tag";
    wrap.append(h("span", { class: tagClass }, label));
  });
  return wrap;
}

function renderRow(station, elementLabelMap, regionLabelMap) {
  return h("tr", {}, [
    h("td", {}, h("span", { class: "station-table__id mono" }, station.id)),
    h("td", {}, h("span", { class: "station-table__name" }, station.name)),
    h("td", {}, station.prefecture),
    h("td", {}, regionLabelMap.get(station.region) ?? station.region),
    h("td", {}, renderElementTags(station.elements, elementLabelMap)),
    h("td", {}, h("span", { class: "badge-type" }, station.stationType)),
  ]);
}

export function renderStationTable(container, stations, { elementLabelMap, regionLabelMap }) {
  container.innerHTML = "";

  if (stations.length === 0) {
    container.append(h("div", { class: "empty-state" }, "条件に一致する観測所がありません。"));
    return;
  }

  const table = h("table", { class: "station-table" });
  const thead = h("thead", {}, h("tr", {}, [
    h("th", {}, "地点コード"),
    h("th", {}, "地点名"),
    h("th", {}, "都道府県"),
    h("th", {}, "地方"),
    h("th", {}, "観測要素"),
    h("th", {}, "種別"),
  ]));

  const tbody = h("tbody", {});
  stations.forEach((station) => {
    tbody.append(renderRow(station, elementLabelMap, regionLabelMap));
  });

  table.append(thead, tbody);
  container.append(table);
}

export function renderLoading(container, message = "観測所データを読み込み中...") {
  container.innerHTML = "";
  container.append(h("div", { class: "loading-state" }, message));
}

export function renderError(container, message) {
  container.innerHTML = "";
  container.append(h("div", { class: "empty-state" }, message));
}
