/**
 * main.js — エントリーポイント
 * ------------------------------------------------------------
 *   1. data/stations.json を読み込む
 *   2. store（状態管理）に格納する
 *   3. regionSelector / elementFilter を初期化し、変化を store に反映する
 *   4. filterEngine で visibleStations を再計算する（applyFilters）
 *   5. stationList モジュールで一覧をテーブル描画する
 *   6. ステータスバーに件数を表示する
 */

import { store } from "./modules/stateManager.js";
import { renderStationTable, renderLoading, renderError } from "./modules/stationList.js";
import { initRegionSelector } from "./modules/regionSelector.js";
import { initElementFilter } from "./modules/elementFilter.js";
import { initTypeFilter } from "./modules/typeFilter.js";
import { initKeywordSearch } from "./modules/keywordSearch.js";
import { initPresetPanel } from "./modules/presetPanel.js";
import { PRESETS, buildPresetState } from "./modules/presets.js";
import { paginate, renderPagination } from "./modules/pagination.js";
import {
  computeVisibleStations,
  buildPrefectureCounts,
  buildElementCounts,
  buildStationTypeCounts,
} from "./modules/filterEngine.js";
import { exportStationsAsCSV } from "./modules/exporter.js";
import { initMapView } from "./modules/mapView.js";
import { parseStateFromUrl, syncUrlWithState } from "./modules/urlState.js";
import { buildElementLabelMap, buildRegionLabelMap } from "./utils/helpers.js";

const tableContainer = document.getElementById("station-table-container");
const paginationContainer = document.getElementById("pagination-container");
const regionSelectorContainer = document.getElementById("region-selector-container");
const elementFilterContainer = document.getElementById("element-filter-container");
const typeFilterContainer = document.getElementById("type-filter-container");
const keywordSearchContainer = document.getElementById("keyword-search-container");
const presetPanelContainer = document.getElementById("preset-panel-container");
const mapViewContainer = document.getElementById("map-view-container");
const statusCount = document.getElementById("status-count");
const exportCsvBtn = document.getElementById("export-csv-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");

let elementLabelMap = new Map();
let regionLabelMap = new Map();
let stationData = null; // init() 完了後、data/stations.json の regions/elements を保持（プリセット適用時のUI再構築に使う）

/** allStations / selectedPrefectures / selectedElements / selectedStationTypes / keyword の現在値から
 *  visibleStations を再計算する。絞り込み条件が変わったときは、存在しないページを見続けないよう1ページ目に戻す。 */
function applyFilters({ resetPage = true } = {}) {
  const state = store.getState();
  const visibleStations = computeVisibleStations(state.allStations, {
    selectedPrefectures: state.selectedPrefectures,
    selectedElements: state.selectedElements,
    elementLogic: state.elementLogic,
    selectedStationTypes: state.selectedStationTypes,
    keyword: state.keyword,
  });
  store.setState({ visibleStations, ...(resetPage ? { page: 1 } : {}) });
}

/**
 * 地域・観測要素・種別・検索ボックスのUIを、与えられた初期選択値で（再）構築する。
 * 初回読み込み時（URLクエリ由来の初期値）と、プリセット適用時（プリセットの値）の
 * 両方から呼ばれる共通処理。
 */
function initFilterUIs(data, initialValues) {
  const prefectureCounts = buildPrefectureCounts(data.stations);
  initRegionSelector({
    container: regionSelectorContainer,
    regions: data.regions,
    stationCounts: prefectureCounts,
    initialSelected: initialValues.prefectures,
    onChange: (selectedPrefectures) => {
      store.setState({ selectedPrefectures });
      applyFilters();
    },
  });

  const elementCounts = buildElementCounts(data.stations);
  initElementFilter({
    container: elementFilterContainer,
    elements: data.elements,
    stationCounts: elementCounts,
    initialSelected: initialValues.elements,
    initialMode: initialValues.elementLogic,
    onChange: (selectedElements, elementLogic) => {
      store.setState({ selectedElements, elementLogic });
      applyFilters();
    },
  });

  const stationTypeCounts = buildStationTypeCounts(data.stations);
  initTypeFilter({
    container: typeFilterContainer,
    stationTypes: [...stationTypeCounts.keys()],
    stationCounts: stationTypeCounts,
    initialSelected: initialValues.stationTypes,
    onChange: (selectedStationTypes) => {
      store.setState({ selectedStationTypes });
      applyFilters();
    },
  });

  initKeywordSearch({
    container: keywordSearchContainer,
    initialKeyword: initialValues.keyword,
    onChange: (keyword) => {
      store.setState({ keyword });
      applyFilters();
    },
  });
}

/** プリセットボタンが選ばれたときの処理（フェーズ9）。
 *  絞り込み条件をプリセットの内容で完全に置き換え、各UIをその値で作り直す。 */
function applyPreset(presetId) {
  if (!stationData) return;
  const presetState = buildPresetState(presetId);

  store.setState({ ...presetState, page: 1 });

  initFilterUIs(stationData, {
    prefectures: presetState.selectedPrefectures,
    elements: presetState.selectedElements,
    elementLogic: presetState.elementLogic,
    stationTypes: presetState.selectedStationTypes,
    keyword: presetState.keyword,
  });

  applyFilters({ resetPage: false }); // 上でpage:1に設定済みなのでここではリセット不要
}

exportCsvBtn.addEventListener("click", () => {
  const state = store.getState();
  const exported = exportStationsAsCSV(state.visibleStations, { elementLabelMap, regionLabelMap });
  if (!exported) {
    const previousText = statusCount.textContent;
    statusCount.textContent = "エクスポート対象の観測所がありません（絞り込み条件を確認してください）";
    setTimeout(() => {
      statusCount.textContent = previousText;
    }, 3000);
  }
});

copyLinkBtn?.addEventListener("click", async () => {
  const previousText = copyLinkBtn.textContent;
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.textContent = "コピーしました ✓";
  } catch (err) {
    console.error(err);
    copyLinkBtn.textContent = "コピーに失敗しました";
  }
  setTimeout(() => {
    copyLinkBtn.textContent = previousText;
  }, 2000);
});

// store の状態が変わるたびに一覧・ページネーションを再描画する
store.subscribe((state) => {
  if (state.status === "loading") {
    renderLoading(tableContainer);
    statusCount.textContent = "読み込み中...";
    paginationContainer.innerHTML = "";
    return;
  }

  if (state.status === "error") {
    renderError(tableContainer, state.errorMessage);
    statusCount.textContent = "エラー";
    paginationContainer.innerHTML = "";
    return;
  }

  syncUrlWithState(state); // フェーズ7: 絞り込み条件をURLクエリに反映（履歴は汚さない）

  const { items, page, totalPages, total } = paginate(state.visibleStations, state.page, state.pageSize);

  renderStationTable(tableContainer, items, { elementLabelMap, regionLabelMap });

  renderPagination(paginationContainer, {
    page,
    pageSize: state.pageSize,
    total,
    onPageChange: (nextPage) => store.setState({ page: nextPage }),
  });

  if (total === 0) {
    statusCount.textContent = `0 観測所を表示中（全 ${state.allStations.length} 件）`;
  } else {
    const start = (page - 1) * state.pageSize + 1;
    const end = Math.min(page * state.pageSize, total);
    statusCount.textContent = `${start}〜${end}件 / 絞り込み ${total}件（全 ${state.allStations.length} 件中）・${page}/${totalPages}ページ`;
  }
});

async function init() {
  try {
    const response = await fetch("data/stations.json");
    if (!response.ok) {
      throw new Error(`データの取得に失敗しました（HTTP ${response.status}）`);
    }
    const data = await response.json();
    stationData = data; // プリセット適用時にUIを作り直すため保持しておく

    elementLabelMap = buildElementLabelMap(data.elements);
    regionLabelMap = buildRegionLabelMap(data.regions);

    // フェーズ7: URLクエリから初期の絞り込み状態を復元する（共有リンクからのアクセス対応）
    const urlState = parseStateFromUrl(new URLSearchParams(window.location.search));

    store.setState({
      allStations: data.stations,
      visibleStations: data.stations, // applyFilters() で絞り込み結果に更新される
      selectedPrefectures: urlState.prefectures,
      selectedElements: urlState.elements,
      elementLogic: urlState.elementLogic,
      selectedStationTypes: urlState.stationTypes,
      keyword: urlState.keyword,
      page: urlState.page,
      status: "ready",
    });

    initFilterUIs(data, {
      prefectures: urlState.prefectures,
      elements: urlState.elements,
      elementLogic: urlState.elementLogic,
      stationTypes: urlState.stationTypes,
      keyword: urlState.keyword,
    });

    initPresetPanel({
      container: presetPanelContainer,
      presets: PRESETS,
      onSelect: applyPreset,
    });

    initMapView({
      container: mapViewContainer,
      store,
      elementLabelMap,
    });

    // URLに絞り込み条件が含まれていた場合、その条件で visibleStations を計算する
    // （ページ番号はURL由来のものを保持したいので resetPage: false）
    applyFilters({ resetPage: false });
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
