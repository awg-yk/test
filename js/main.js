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
import { paginate, renderPagination } from "./modules/pagination.js";
import { computeVisibleStations, buildFacetCounts, buildStationTypeCounts } from "./modules/filterEngine.js";
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
const mapViewContainer = document.getElementById("map-view-container");
const statusCount = document.getElementById("status-count");
const exportCsvBtn = document.getElementById("export-csv-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");

let elementLabelMap = new Map();
let regionLabelMap = new Map();
let filterUIs = { region: null, element: null, type: null }; // 各絞り込みUIのハンドル（件数の更新に使う）

/** store の状態から filterEngine に渡す絞り込み条件を取り出す */
function filtersFromState(state) {
  return {
    selectedPrefectures: state.selectedPrefectures,
    selectedElements: state.selectedElements,
    elementLogic: state.elementLogic,
    selectedStationTypes: state.selectedStationTypes,
    keyword: state.keyword,
  };
}

/** 各絞り込みUIの「(件数)」を、他の絞り込み条件を反映した件数に更新する（フェーズ10）。
 *  例: 地域で北海道だけ選ぶと、観測要素・種別の件数が北海道の中での件数になる。 */
function refreshFacetCounts(allStations, filters) {
  const { prefectureCounts, elementCounts, stationTypeCounts } = buildFacetCounts(allStations, filters);
  filterUIs.region?.updateCounts(prefectureCounts);
  filterUIs.element?.updateCounts(elementCounts);
  filterUIs.type?.updateCounts(stationTypeCounts);
}

/** allStations / selectedPrefectures / selectedElements / selectedStationTypes / keyword の現在値から
 *  visibleStations を再計算する。絞り込み条件が変わったときは、存在しないページを見続けないよう1ページ目に戻す。 */
function applyFilters({ resetPage = true } = {}) {
  const state = store.getState();
  const filters = filtersFromState(state);
  const visibleStations = computeVisibleStations(state.allStations, filters);
  // 絞り込みが変わると選択中の観測所が表示から外れうるので、ページ同様に選択も解除する（フェーズ15）
  store.setState({ visibleStations, ...(resetPage ? { page: 1, selectedStationId: null } : {}) });
  refreshFacetCounts(state.allStations, filters);
}

/** 一覧の行クリックで呼ばれる選択ハンドラ（地図マーカー側は mapView.js が同じ store.selectedStationId を
 *  直接更新するので、一覧・地図どちらの操作でも最終的にここと同じ状態を共有する。フェーズ15） */
function selectStation(stationId) {
  store.setState({ selectedStationId: stationId });
}

/**
 * 地域・観測要素・種別・検索ボックスのUIを、与えられた初期選択値で構築する。
 * 初期選択値は、URLクエリから復元した絞り込み条件（共有リンクからのアクセス対応）。
 */
function initFilterUIs(data, initialValues) {
  // 初期表示の件数も、URLクエリ由来の絞り込みを反映した値にする
  const facetCounts = buildFacetCounts(data.stations, {
    selectedPrefectures: initialValues.prefectures,
    selectedElements: initialValues.elements,
    elementLogic: initialValues.elementLogic,
    selectedStationTypes: initialValues.stationTypes,
    keyword: initialValues.keyword,
  });

  filterUIs.region = initRegionSelector({
    container: regionSelectorContainer,
    regions: data.regions,
    stationCounts: facetCounts.prefectureCounts,
    initialSelected: initialValues.prefectures,
    onChange: (selectedPrefectures) => {
      store.setState({ selectedPrefectures });
      applyFilters();
    },
  });

  filterUIs.element = initElementFilter({
    container: elementFilterContainer,
    elements: data.elements,
    stationCounts: facetCounts.elementCounts,
    initialSelected: initialValues.elements,
    initialMode: initialValues.elementLogic,
    onChange: (selectedElements, elementLogic) => {
      store.setState({ selectedElements, elementLogic });
      applyFilters();
    },
  });

  // 選択肢そのもの（気象官署／アメダス）は全観測所から作り、件数だけ絞り込み連動にする
  // （件数0の種別も選択肢として残しておくため）
  filterUIs.type = initTypeFilter({
    container: typeFilterContainer,
    stationTypes: [...buildStationTypeCounts(data.stations).keys()],
    stationCounts: facetCounts.stationTypeCounts,
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

  renderStationTable(tableContainer, items, {
    elementLabelMap,
    regionLabelMap,
    selectedStationId: state.selectedStationId,
    onSelectStation: selectStation,
  });

  renderPagination(paginationContainer, {
    page,
    pageSize: state.pageSize,
    total,
    // 手動でのページ送りは、直前の選択行が別ページに残ったままにならないよう選択も解除する
    onPageChange: (nextPage) => store.setState({ page: nextPage, selectedStationId: null }),
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
