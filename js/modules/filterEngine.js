/**
 * filterEngine.js
 * ------------------------------------------------------------
 * 現在有効な絞り込み条件（地域・観測要素）を合成し、
 * allStations から visibleStations を計算する純粋関数群。
 *
 * フェーズ2: selectedPrefectures
 * フェーズ3: selectedElements / elementLogic を追加
 *   （AND/OR判定そのものは elementFilter.js の matchesElementFilter に委譲）
 */

import { matchesElementFilter } from "./elementFilter.js";

export function computeVisibleStations(allStations, filters) {
  const { selectedPrefectures, selectedElements, elementLogic } = filters;

  return allStations.filter((station) => {
    const passesRegion =
      !selectedPrefectures ||
      selectedPrefectures.size === 0 ||
      selectedPrefectures.has(station.prefecture);

    const passesElements = matchesElementFilter(station, selectedElements ?? new Set(), elementLogic ?? "AND");

    return passesRegion && passesElements;
  });
}

/** 都道府県ごとの観測所数を集計する（地域選択UIのカウント表示に使う） */
export function buildPrefectureCounts(allStations) {
  const counts = new Map();
  allStations.forEach((station) => {
    counts.set(station.prefecture, (counts.get(station.prefecture) ?? 0) + 1);
  });
  return counts;
}

/** 観測要素ごとの観測所数を集計する（観測要素フィルタUIのカウント表示に使う） */
export function buildElementCounts(allStations) {
  const counts = new Map();
  allStations.forEach((station) => {
    (station.elements ?? []).forEach((elementId) => {
      counts.set(elementId, (counts.get(elementId) ?? 0) + 1);
    });
  });
  return counts;
}
