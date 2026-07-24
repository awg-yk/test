/**
 * test-discontinued.mjs
 * ------------------------------------------------------------
 * 「廃止済み観測所を含める」機能（フェーズ16）のテスト。
 *   - data/stations.json の discontinuedStations のデータ整合性
 *   - discontinuedFilter.js のチェックボックスUI
 *   - mapView.js（マーカー色・ポップアップ）の廃止済み観測所向けの表示
 *   - stationList.js（一覧の「廃止」タグ・観測期間表示）
 */
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

const data = JSON.parse(readFileSync("./data/stations.json", "utf-8"));

// --- データ整合性 -----------------------------------------------------------

assert(Array.isArray(data.discontinuedStations), "discontinuedStationsが配列として存在する");
assert(data.discontinuedStations.length === 21, `廃止済み観測所は21件 (実際: ${data.discontinuedStations.length})`);

const regionIds = new Set(data.regions.map((r) => r.id));
const mainIds = new Set(data.stations.map((s) => s.id));

data.discontinuedStations.forEach((s) => {
  assert(typeof s.id === "string" && s.id.length > 0, `id: ${s.name}`);
  assert(!mainIds.has(s.id), `${s.name}のidが現行観測所と重複していない`);
  assert(s.discontinued === true, `${s.name}: discontinued=trueが設定されている`);
  assert(typeof s.observedFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.observedFrom), `${s.name}: observedFromがISO日付形式`);
  assert(typeof s.observedTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.observedTo), `${s.name}: observedToがISO日付形式`);
  assert(regionIds.has(s.region), `${s.name}: regionが規定のregions master内`);
  assert(typeof s.lat === "number" && s.lat > 20 && s.lat < 46, `${s.name}: 緯度が日本国内の範囲`);
  assert(typeof s.lon === "number" && s.lon > 122 && s.lon < 154, `${s.name}: 経度が日本国内の範囲`);
  assert(!s.precNo && !s.blockNo, `${s.name}: precNo/blockNoは未設定（地点番号未確定のため）`);
});

const ids = data.discontinuedStations.map((s) => s.id);
assert(new Set(ids).size === ids.length, "discontinuedStations内でidの重複がない");

console.log("\nAll discontinued data-integrity checks passed.");

// --- discontinuedFilter.js --------------------------------------------------

const { initDiscontinuedFilter } = await import("./js/modules/discontinuedFilter.js");

const container = document.createElement("div");
let lastChange = null;
initDiscontinuedFilter({
  container,
  count: 21,
  initialChecked: false,
  onChange: (checked) => {
    lastChange = checked;
  },
});

const checkbox = container.querySelector("input[type=checkbox]");
assert(!!checkbox, "チェックボックスが描画される");
assert(checkbox.checked === false, "初期状態は未チェック（既定で廃止済みは含めない）");
assert(container.textContent.includes("21"), "件数(21件)がラベルに表示される");

checkbox.checked = true;
checkbox.dispatchEvent(new dom.window.Event("change"));
assert(lastChange === true, "チェックすると onChange(true) が呼ばれる");

// initialChecked: true の復元（URLクエリからの復元を想定）
const container2 = document.createElement("div");
initDiscontinuedFilter({ container: container2, count: 21, initialChecked: true, onChange: () => {} });
assert(container2.querySelector("input[type=checkbox]").checked === true, "initialChecked:trueで初期状態がチェック済みになる");

console.log("\nAll discontinuedFilter tests passed.");

// --- mapView.js（廃止済み観測所向けの表示） ---------------------------------

const { getMarkerColor, buildPopupHtml } = await import("./js/modules/mapView.js");

const discontinuedStation = data.discontinuedStations[0];
assert(getMarkerColor(discontinuedStation) === "#9AA1AA", "廃止済み観測所のマーカーは種別に関わらずグレーになる");
assert(
  getMarkerColor({ ...discontinuedStation, stationType: "気象官署" }) ===
    getMarkerColor({ ...discontinuedStation, stationType: "アメダス" }),
  "廃止済み観測所は種別が違っても同じグレーになる"
);

const popupHtml = buildPopupHtml(discontinuedStation, { elementLabelMap: new Map() });
assert(popupHtml.includes("廃止済み"), "廃止済み観測所のポップアップに「廃止済み」の表示が含まれる");
assert(popupHtml.includes(discontinuedStation.observedFrom), "ポップアップに観測開始日が含まれる");
assert(popupHtml.includes(discontinuedStation.observedTo), "ポップアップに観測終了日が含まれる");
assert(!popupHtml.includes('<a href'), "廃止済み観測所のポップアップにはリンクが無い（地点番号未確定のため）");

console.log("\nAll mapView discontinued-station tests passed.");

// --- stationList.js（一覧の「廃止」タグ・観測期間表示） ---------------------

const { renderStationTable } = await import("./js/modules/stationList.js");

const tableContainer = document.createElement("div");
const elementLabelMap = new Map(data.elements.map((el) => [el.id, el.name]));
const regionLabelMap = new Map(data.regions.map((r) => [r.id, r.name]));

renderStationTable(tableContainer, [data.stations[0], discontinuedStation], {
  elementLabelMap,
  regionLabelMap,
});

const rows = [...tableContainer.querySelectorAll("tbody tr")];
assert(rows.length === 2, "現役1件・廃止済み1件、あわせて2行描画される");
assert(!rows[0].classList.contains("station-table__row--discontinued"), "現役観測所の行には廃止クラスが付かない");
assert(rows[1].classList.contains("station-table__row--discontinued"), "廃止済み観測所の行に廃止クラスが付く");
assert(rows[1].querySelector(".station-table__discontinued-badge")?.textContent === "廃止", "廃止済み観測所の行に「廃止」バッジが表示される");
assert(
  rows[1].textContent.includes(discontinuedStation.observedFrom.slice(0, 4)),
  "廃止済み観測所の行に観測開始年が表示される"
);
assert(!rows[1].querySelector("a"), "廃止済み観測所の地点名はリンクにならない（地点番号未確定のため）");

console.log("\nAll stationList discontinued-station tests passed.");
