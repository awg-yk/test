/**
 * filterEngine.js
 * ------------------------------------------------------------
 * 現在有効な絞り込み条件（地域・観測要素…）を合成し、
 * allStations から visibleStations を計算する純粋関数群。
 *
 * フェーズ2: selectedPrefectures のみを見る
 * フェーズ3: ここに selectedElements / elementLogic を追加する予定
 *   （matchesElementFilter は elementFilter.js に用意済み）
 */

export function computeVisibleStations(allStations, filters) {
  const { selectedPrefectures } = filters;

  return allStations.filter((station) => {
    const passesRegion =
      !selectedPrefectures ||
      selectedPrefectures.size === 0 ||
      selectedPrefectures.has(station.prefecture);

    return passesRegion;
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
