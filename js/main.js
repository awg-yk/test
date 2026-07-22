/**
 * main.js — エントリーポイント
 * ------------------------------------------------------------
 *   1. data/stations.json を読み込む
 *   2. store（状態管理）に格納する
 *   3. regionSelector を初期化し、地域選択の変化を store に反映する
 *   4. filterEngine で visibleStations を再計算する（applyFilters）
 *   5. stationList モジュールで一覧をテーブル描画する
 *   6. ステータスバーに件数を表示する
 *
 * フェーズ3では、ここに initElementFilter() を追加し、
 * applyFilters() に selectedElements / elementLogic を渡すだけで
 * 地域フィルタと組み合わせた絞り込みができるようにする想定。
 */

import { store } from "./modules/stateManager.js";
import { renderStationTable, renderLoading, renderError } from "./modules/stationList.js";
import { initRegionSelector } from "./modules/regionSelector.js";
import { computeVisibleStations, buildPrefectureCounts } from "./modules/filterEngine.js";
import { buildElementLabelMap, buildRegionLabelMap } from "./utils/helpers.js";

const tableContainer = document.getElementById("station-table-container");
const regionSelectorContainer = document.getElementById("region-selector-container");
const statusCount = document.getElementById("status-count");

let elementLabelMap = new Map();
let regionLabelMap = new Map();

/** allStations / selectedPrefectures の現在値から visibleStations を再計算する */
function applyFilters() {
  const state = store.getState();
  const visibleStations = computeVisibleStations(state.allStations, {
    selectedPrefectures: state.selectedPrefectures,
  });
  store.setState({ visibleStations });
}

// store の状態が変わるたびに一覧を再描画する
store.subscribe((state) => {
  if (state.status === "loading") {
    renderLoading(tableContainer);
    statusCount.textContent = "読み込み中...";
    return;
  }

  if (state.status === "error") {
    renderError(tableContainer, state.errorMessage);
    statusCount.textContent = "エラー";
    return;
  }

  renderStationTable(tableContainer, state.visibleStations, {
    elementLabelMap,
    regionLabelMap,
  });
  statusCount.textContent = `${state.visibleStations.length} 観測所を表示中（全 ${state.allStations.length} 件）`;
});

async function init() {
  try {
    const response = await fetch("data/stations.json");
    if (!response.ok) {
      throw new Error(`データの取得に失敗しました（HTTP ${response.status}）`);
    }
    const data = await response.json();

    elementLabelMap = buildElementLabelMap(data.elements);
    regionLabelMap = buildRegionLabelMap(data.regions);

    store.setState({
      allStations: data.stations,
      visibleStations: data.stations, // 初期状態は絞り込みなし＝全件表示
      status: "ready",
    });

    const prefectureCounts = buildPrefectureCounts(data.stations);
    initRegionSelector({
      container: regionSelectorContainer,
      regions: data.regions,
      stationCounts: prefectureCounts,
      onChange: (selectedPrefectures) => {
        store.setState({ selectedPrefectures });
        applyFilters();
      },
    });
  } catch (err) {
    console.error(err);
    store.setState({
      status: "error",
      errorMessage:
        "観測所データの読み込みに失敗しました。ローカルサーバー経由で開いているかご確認ください（例: python -m http.server）。",
    });
  }
}

init();
