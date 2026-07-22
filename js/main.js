/**
 * main.js — エントリーポイント
 * ------------------------------------------------------------
 * フェーズ1の役割:
 *   1. data/stations.json を読み込む
 *   2. store（状態管理）に格納する
 *   3. stationList モジュールで一覧をテーブル描画する
 *   4. ステータスバーに件数を表示する
 *
 * フェーズ2/3では、この初期化処理のあとに
 * initRegionSelector() / initElementFilter() を呼び、
 * store の visibleStations を更新するだけで一覧側は自動的に
 * 再描画されるようにしてある（store.subscribe による連動）。
 */

import { store } from "./modules/stateManager.js";
import { renderStationTable, renderLoading, renderError } from "./modules/stationList.js";
import { buildElementLabelMap, buildRegionLabelMap } from "./utils/helpers.js";

const tableContainer = document.getElementById("station-table-container");
const statusCount = document.getElementById("status-count");

let elementLabelMap = new Map();
let regionLabelMap = new Map();

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
      visibleStations: data.stations, // フェーズ1では絞り込みなし＝全件表示
      status: "ready",
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
