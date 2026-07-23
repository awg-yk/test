/**
 * filterEngine.js
 * ------------------------------------------------------------
 * 現在有効な絞り込み条件（地域・観測要素・キーワード検索）を合成し、
 * allStations から visibleStations を計算する純粋関数群。
 *
 * フェーズ2: selectedPrefectures
 * フェーズ3: selectedElements / elementLogic を追加
 *   （AND/OR判定そのものは elementFilter.js の matchesElementFilter に委譲）
 * フェーズ5: keyword（地点名・かな・都道府県のフリーワード検索）を追加
 */

import { matchesElementFilter } from "./elementFilter.js";

/** 地点名・かな・英名・都道府県名のいずれかに部分一致すれば true */
export function matchesKeyword(station, keyword) {
  const trimmed = (keyword ?? "").trim();
  if (trimmed === "") return true;
  const needle = trimmed.toLowerCase();
  const haystacks = [station.name, station.kana, station.enName, station.prefecture];
  return haystacks.some((v) => typeof v === "string" && v.toLowerCase().includes(needle));
}

export function computeVisibleStations(allStations, filters) {
  const { selectedPrefectures, selectedElements, elementLogic, keyword } = filters;

  return allStations.filter((station) => {
    const passesRegion =
      !selectedPrefectures ||
      selectedPrefectures.size === 0 ||
      selectedPrefectures.has(station.prefecture);

    const passesElements = matchesElementFilter(station, selectedElements ?? new Set(), elementLogic ?? "AND");

    const passesKeyword = matchesKeyword(station, keyword);

    return passesRegion && passesElements && passesKeyword;
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
