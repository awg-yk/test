/**
 * filterEngine.js
 * ------------------------------------------------------------
 * 現在有効な絞り込み条件（地域・観測要素・種別・キーワード検索）を合成し、
 * allStations から visibleStations を計算する純粋関数群。
 *
 * フェーズ2: selectedPrefectures
 * フェーズ3: selectedElements / elementLogic を追加
 *   （AND/OR判定そのものは elementFilter.js の matchesElementFilter に委譲）
 * フェーズ5: keyword（地点名・かな・都道府県のフリーワード検索）を追加
 * フェーズ9: selectedStationTypes（気象官署／アメダス）を追加。プリセット機能の土台。
 * フェーズ10: buildFacetCounts を追加。各絞り込みUIの「(件数)」を、他の絞り込み条件を
 *   適用した状態の件数に更新するために使う（例: 北海道だけ選ぶと観測要素側の件数も北海道分になる）。
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

/** 種別（気象官署／アメダス）で絞り込む。未選択（空集合）は常にtrue（絞り込みなし＝regionSelector等と同じ方針） */
export function matchesTypeFilter(station, selectedStationTypes) {
  if (!selectedStationTypes || selectedStationTypes.size === 0) return true;
  return selectedStationTypes.has(station.stationType);
}

export function computeVisibleStations(allStations, filters) {
  const { selectedPrefectures, selectedElements, elementLogic, selectedStationTypes, keyword } = filters;

  return allStations.filter((station) => {
    const passesRegion =
      !selectedPrefectures ||
      selectedPrefectures.size === 0 ||
      selectedPrefectures.has(station.prefecture);

    const passesElements = matchesElementFilter(station, selectedElements ?? new Set(), elementLogic ?? "AND");

    const passesType = matchesTypeFilter(station, selectedStationTypes);

    const passesKeyword = matchesKeyword(station, keyword);

    return passesRegion && passesElements && passesType && passesKeyword;
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

/** 種別（気象官署／アメダス）ごとの観測所数を集計する（種別フィルタUIのカウント表示に使う） */
export function buildStationTypeCounts(allStations) {
  const counts = new Map();
  allStations.forEach((station) => {
    if (!station.stationType) return;
    counts.set(station.stationType, (counts.get(station.stationType) ?? 0) + 1);
  });
  return counts;
}

/**
 * 各絞り込みUIに表示する「(件数)」を、現在の他の絞り込み条件を反映した値として集計する。
 *
 * 数え方は一般的なファセット検索と同じで、「その軸自身の選択は無視し、他の軸の条件だけを
 * 適用した母集団」を数える。こうすると
 *   - 地域で北海道だけ選ぶ → 観測要素・種別の件数が北海道の中での件数になる
 *   - 観測要素で積雪を選ぶ → 都道府県の件数が積雪観測地点だけの件数になる
 *   - すでに選んでいる項目の件数が、自分自身の選択のせいで減って見えることはない
 * という挙動になる。キーワード検索は「軸」ではなく常時適用の条件として全ての件数に効かせる。
 *
 * @returns {{prefectureCounts: Map, elementCounts: Map, stationTypeCounts: Map}}
 */
export function buildFacetCounts(allStations, filters = {}) {
  const withoutPrefectures = computeVisibleStations(allStations, { ...filters, selectedPrefectures: new Set() });
  const withoutElements = computeVisibleStations(allStations, { ...filters, selectedElements: new Set() });
  const withoutTypes = computeVisibleStations(allStations, { ...filters, selectedStationTypes: new Set() });

  return {
    prefectureCounts: buildPrefectureCounts(withoutPrefectures),
    elementCounts: buildElementCounts(withoutElements),
    stationTypeCounts: buildStationTypeCounts(withoutTypes),
  };
}
