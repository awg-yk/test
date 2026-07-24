/**
 * test-map-selection.mjs
 * ------------------------------------------------------------
 * マーカー⇔一覧行の相互連携（フェーズ15）のうち、initMapView() 内部の
 * 「マーカークリック → store.selectedStationId 更新」「store.selectedStationId の
 * 変化 → マーカーのフォーカス（ハイライト・パン・ポップアップ）」を検証する。
 *
 * Leaflet本体は使わず、mapView.js が実際に呼び出すAPIだけを備えた
 * 最小限のフェイクL実装でテストする（本物のLeafletの見た目までは検証しない）。
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

// --- フェイクLeaflet -------------------------------------------------------

class FakeCircleMarker {
  constructor(latlng, options) {
    this.latlng = { lat: latlng[0], lng: latlng[1] };
    this.options = { ...options };
    this._listeners = {};
    this.popupOpened = false;
    this.styleHistory = [];
  }
  bindPopup(html) {
    this.popupHtml = html;
    return this;
  }
  openPopup() {
    this.popupOpened = true;
  }
  on(event, handler) {
    this._listeners[event] = handler;
    return this;
  }
  fireClick() {
    this._listeners.click?.();
  }
  setStyle(style) {
    this.styleHistory.push(style);
    Object.assign(this.options, style);
  }
  getLatLng() {
    return this.latlng;
  }
}

class FakeLayerGroup {
  constructor() {
    this.layers = [];
  }
  addTo() {
    return this;
  }
  addLayer(layer) {
    this.layers.push(layer);
  }
  clearLayers() {
    this.layers = [];
  }
}

class FakeMarkerClusterGroup extends FakeLayerGroup {
  zoomToShowLayer(marker, callback) {
    this.lastZoomedTo = marker;
    callback();
  }
}

function createFakeL({ withCluster }) {
  return {
    map: () => ({
      panCalls: [],
      addLayer() {},
      addControl() {},
      fitBounds() {},
      panTo(latlng) {
        this.panCalls.push(latlng);
      },
      getZoom: () => 5,
      setZoomAround() {},
      mouseEventToLatLng: () => ({ lat: 0, lng: 0 }),
      options: { zoomDelta: 1 },
      dragging: { enabled: () => false, enable() {}, disable() {} },
    }),
    tileLayer: () => ({ addTo: () => {} }),
    circleMarker: (latlng, options) => new FakeCircleMarker(latlng, options),
    layerGroup: () => new FakeLayerGroup(),
    markerClusterGroup: withCluster ? () => new FakeMarkerClusterGroup() : undefined,
    latLngBounds: () => ({ isValid: () => true }),
    Control: {
      extend: (def) =>
        class {
          onAdd() {
            return def.onAdd.call(this);
          }
        },
    },
    DomUtil: { create: (tag) => document.createElement(tag) },
    DomEvent: {
      disableClickPropagation() {},
      on(el, event, handler) {
        el.addEventListener(event, handler);
      },
    },
  };
}

function makeStore(initialState) {
  let state = { ...initialState };
  const listeners = [];
  return {
    getState: () => state,
    setState(partial) {
      state = { ...state, ...partial };
      listeners.forEach((l) => l(state));
    },
    subscribe(listener) {
      listeners.push(listener);
    },
  };
}

const stations = [
  { id: "A1", name: "地点A", lat: 35.0, lon: 135.0, elements: [], stationType: "アメダス" },
  { id: "A2", name: "地点B", lat: 36.0, lon: 136.0, elements: [], stationType: "アメダス" },
];

const { initMapView } = await import("./js/modules/mapView.js");

// --- マーカークリックで store.selectedStationId が更新される ---------------
// circleMarker の呼び出しを横取りして、render()が生成したマーカーを地点の描画順で取得する
{
  const fakeL = createFakeL({ withCluster: false });
  const createdMarkers = [];
  const originalCircleMarker = fakeL.circleMarker;
  fakeL.circleMarker = (...args) => {
    const marker = originalCircleMarker(...args);
    createdMarkers.push(marker);
    return marker;
  };
  window.L = fakeL;

  const container = document.createElement("div");
  const store = makeStore({
    status: "ready",
    allStations: stations,
    visibleStations: stations,
    page: 1,
    pageSize: 50,
    selectedStationId: null,
  });

  initMapView({ container, store, elementLabelMap: new Map() });
  assert(createdMarkers.length === 2, "描画対象の2地点分のマーカーが作られる");

  createdMarkers[1].fireClick();
  assert(store.getState().selectedStationId === "A2", "マーカークリックでstore.selectedStationIdがそのマーカーのIDになる");

  // --- store.selectedStationId の変化でマーカーがフォーカスされる（ハイライト・パン・ポップアップ） ---
  assert(createdMarkers[1].popupOpened === true, "選択されたマーカーのポップアップが開く");
  assert(
    createdMarkers[1].styleHistory.some((s) => s.radius === 9),
    "選択されたマーカーの見た目がハイライトされる（radius拡大）"
  );

  // 一覧の行クリックを模して、マーカークリック以外の経路でも同じ状態変化が伝播するか確認する
  store.setState({ selectedStationId: "A1" });
  assert(createdMarkers[0].popupOpened === true, "一覧側からの選択でも対応するマーカーのポップアップが開く");
  assert(
    createdMarkers[1].styleHistory.at(-1).radius === 6,
    "別の地点が選択されたら、前に選択されていたマーカーはハイライトが解除される"
  );
}

// --- クラスタ表示中は zoomToShowLayer 経由でクラスタを解いてから開く -------
{
  const fakeL = createFakeL({ withCluster: true });
  const createdMarkers = [];
  const originalCircleMarker = fakeL.circleMarker;
  fakeL.circleMarker = (...args) => {
    const marker = originalCircleMarker(...args);
    createdMarkers.push(marker);
    return marker;
  };
  window.L = fakeL;

  const container = document.createElement("div");
  const store = makeStore({
    status: "ready",
    allStations: stations,
    visibleStations: stations,
    page: 1,
    pageSize: 50,
    selectedStationId: null,
  });

  initMapView({ container, store, elementLabelMap: new Map() });
  store.setState({ selectedStationId: "A1" });
  assert(createdMarkers[0].popupOpened === true, "クラスタ表示中でも選択された地点のポップアップが開く");
}

// --- 現在の絞り込みで地図に表示されていない地点IDを選択しても例外を投げない ---
{
  window.L = createFakeL({ withCluster: false });
  const container = document.createElement("div");
  const store = makeStore({
    status: "ready",
    allStations: stations,
    visibleStations: stations,
    page: 1,
    pageSize: 50,
    selectedStationId: null,
  });
  initMapView({ container, store, elementLabelMap: new Map() });
  store.setState({ selectedStationId: "not-on-map" });
  assert(true, "地図に存在しない地点IDが選択されても例外を投げない");
}

console.log("\nAll map-selection tests passed.");
