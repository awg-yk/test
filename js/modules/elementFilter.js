/**
 * elementFilter.js
 * ------------------------------------------------------------
 * [フェーズ3で実装予定]
 * 観測要素（気温・降水量・積雪・風・湿度・日照時間）による
 * 絞り込みチェックボックスUIと、AND/OR切り替えロジックをここに実装する。
 *
 * 想定するAPI（フェーズ3でのインターフェース案）:
 *
 *   initElementFilter({
 *     container: HTMLElement,
 *     elements: Element[],              // data/stations.json の elements
 *     onChange: (selected: Set<string>, mode: "AND" | "OR") => void,
 *   })
 *
 *   matchesElementFilter(station, selectedElementIds, mode)
 *     -> mode === "AND": station.elements が selectedElementIds を全て含むか
 *     -> mode === "OR" : station.elements が selectedElementIds のいずれかを含むか
 */

export function initElementFilter(/* options */) {
  // TODO(フェーズ3): 観測要素チェックボックス + AND/OR切り替えを実装
  console.info("[elementFilter] フェーズ3で実装予定です。");
}

export function matchesElementFilter(station, selectedElementIds, mode = "AND") {
  if (selectedElementIds.size === 0) return true;
  const stationElements = new Set(station.elements);
  const selected = [...selectedElementIds];
  return mode === "AND"
    ? selected.every((id) => stationElements.has(id))
    : selected.some((id) => stationElements.has(id));
}
