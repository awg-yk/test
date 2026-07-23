/**
 * mapView.js
 * ------------------------------------------------------------
 * Leaflet地図に現在の絞り込み結果（store.visibleStations）を
 * マーカーとして描画するモジュール（フェーズ6: 地図表示）。
 *
 * 設計方針:
 *   - store.subscribe() して visibleStations が変わったときだけ再描画する
 *     （ページ切り替えでは visibleStations 自体は変化しないので再描画しない）
 *   - 気象官署／アメダスを色分けしたマーカー（円形マーカー・低コスト）
 *   - 全国選択時は1,000件超になるため Leaflet.markercluster でクラスタリング
 *     （読み込まれていない場合は通常のレイヤーグループにフォールバック）
 *   - ポップアップの中身は buildPopupHtml() として純粋関数に分離し、
 *     Leaflet無しでもユニットテストできるようにしてある
 *
 * 前提: Leaflet / Leaflet.markercluster は index.html 側で
 *       CDN から読み込み、window.L としてグローバルに存在すること。
 */

import { buildJmaStationLink } from "./exporter.js";

const STATION_TYPE_COLORS = {
  気象官署: "#1C7C8C", // --color-teal
  アメダス: "#E8A33D", // --color-amber
};
const DEFAULT_MARKER_COLOR = "#5B6672"; // --color-ink-soft

/** 観測所種別からマーカー色を返す（テスト容易にするため独立関数） */
export function getMarkerColor(station) {
  return STATION_TYPE_COLORS[station?.stationType] ?? DEFAULT_MARKER_COLOR;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * マーカーのポップアップに表示するHTML文字列を組み立てる。
 * Leafletに依存しない純粋関数（ユニットテスト対象）。
 */
export function buildPopupHtml(station, { elementLabelMap } = {}) {
  const elementNames = (station.elements ?? [])
    .map((id) => elementLabelMap?.get(id) ?? id)
    .join("・");
  const jmaLink = buildJmaStationLink(station);
  const jmaLinkHtml = jmaLink
    ? `<a href="${jmaLink}" target="_blank" rel="noopener noreferrer">気象庁の観測データを見る ↗</a>`
    : `<span class="map-popup__no-link">気象庁リンク未収録</span>`;

  return [
    '<div class="map-popup">',
    `<p class="map-popup__title">${escapeHtml(station.name)}`,
    `<span class="map-popup__kana">（${escapeHtml(station.kana ?? "")}）</span></p>`,
    `<p class="map-popup__meta">${escapeHtml(station.prefecture)} ／ ${escapeHtml(
      station.stationType ?? ""
    )} ／ 標高${escapeHtml(station.alt ?? "-")}m</p>`,
    `<p class="map-popup__elements">${escapeHtml(elementNames || "観測要素データなし")}</p>`,
    `<p class="map-popup__link">${jmaLinkHtml}</p>`,
    "</div>",
  ].join("");
}

/**
 * 地図ビューを初期化し、store の変化を購読して自動描画するようにする。
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container - 地図を描画するDOM要素
 * @param {Object} opts.store - stateManager.js の store
 * @param {Map} opts.elementLabelMap - 観測要素ID→日本語ラベルの辞書
 * @returns {Object|null} Leaflet map インスタンス（Leaflet未読み込み時はnull）
 */
export function initMapView({ container, store, elementLabelMap }) {
  if (typeof window === "undefined" || !window.L) {
    container.innerHTML =
      '<p class="map-view__error">地図ライブラリ(Leaflet)の読み込みに失敗しました。ネットワーク接続をご確認のうえ再読み込みしてください。</p>';
    return null;
  }
  const L = window.L;

  const map = L.map(container, {
    center: [36.5, 138.0], // 日本全体がおおよそ収まる初期中心
    zoom: 5,
    preferCanvas: true, // 大量マーカー描画のパフォーマンス対策
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);

  const hasCluster = typeof L.markerClusterGroup === "function";
  const markerLayer = hasCluster
    ? L.markerClusterGroup({ maxClusterRadius: 50, disableClusteringAtZoom: 12, spiderfyOnMaxZoom: true })
    : L.layerGroup();
  markerLayer.addTo(map);

  let lastVisibleStations = null;
  let hasFitOnce = false;

  function render(stations) {
    markerLayer.clearLayers();

    const validStations = stations.filter(
      (s) => typeof s.lat === "number" && typeof s.lon === "number"
    );

    validStations.forEach((station) => {
      const marker = L.circleMarker([station.lat, station.lon], {
        radius: 6,
        color: "#fff",
        weight: 1,
        fillColor: getMarkerColor(station),
        fillOpacity: 0.9,
      });
      marker.bindPopup(buildPopupHtml(station, { elementLabelMap }), { maxWidth: 260 });
      markerLayer.addLayer(marker);
    });

    // 絞り込みが変わるたびに表示範囲を合わせ直す（初回は少し広めのzoom上限にする）
    if (validStations.length > 0) {
      const bounds = L.latLngBounds(validStations.map((s) => [s.lat, s.lon]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: hasFitOnce ? 9 : 7 });
      }
    }
    hasFitOnce = true;
  }

  store.subscribe((state) => {
    if (state.status !== "ready") return;
    if (state.visibleStations === lastVisibleStations) return; // ページ切り替え等は再描画しない
    lastVisibleStations = state.visibleStations;
    render(state.visibleStations);
  });

  // 購読開始時点で既に ready 状態なら即描画する
  const initialState = store.getState();
  if (initialState.status === "ready") {
    lastVisibleStations = initialState.visibleStations;
    render(initialState.visibleStations);
  }

  return map;
}
