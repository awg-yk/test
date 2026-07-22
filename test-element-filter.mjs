import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

const { initElementFilter, matchesElementFilter } = await import("./js/modules/elementFilter.js");
const data = JSON.parse(readFileSync("./data/stations.json", "utf-8"));

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

// --- matchesElementFilter（純粋関数）のユニットテスト -----------------

const station = { elements: ["temperature", "precipitation", "wind"] };

assert(matchesElementFilter(station, new Set(), "AND") === true, "未選択(空集合)は常にtrue");
assert(matchesElementFilter(station, new Set(["temperature"]), "AND") === true, "1件一致(AND)はtrue");
assert(
  matchesElementFilter(station, new Set(["temperature", "snow"]), "AND") === false,
  "一部しか持たない場合(AND)はfalse"
);
assert(
  matchesElementFilter(station, new Set(["temperature", "snow"]), "OR") === true,
  "いずれか持っていれば(OR)はtrue"
);
assert(matchesElementFilter(station, new Set(["snow", "sunshine"]), "OR") === false, "どれも持たない場合(OR)はfalse");

// --- initElementFilter（UI）の統合テスト -------------------------------

let lastSelected = null;
let lastMode = null;
const container = document.getElementById("root");

const counts = new Map();
data.stations.forEach((s) => (s.elements ?? []).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));

initElementFilter({
  container,
  elements: data.elements,
  stationCounts: counts,
  onChange: (selected, mode) => {
    lastSelected = selected;
    lastMode = mode;
  },
});

// 1. 初期状態: 何も選択されていない
assert(lastSelected === null, "初期状態では onChange は呼ばれない");

// 2. 「気温」をONにすると選択に追加される
const tempCheckbox = document.getElementById("element-temperature");
tempCheckbox.checked = true;
tempCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === 1 && lastSelected.has("temperature"), "気温チェックで選択に追加される");
assert(lastMode === "AND", "デフォルトモードはAND");

// 3. 「積雪」も追加してAND/OR両モードを確認
const snowCheckbox = document.getElementById("element-snow");
snowCheckbox.checked = true;
snowCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === 2, "気温+積雪の2件選択");

const orRadio = document.getElementById("element-mode-or");
orRadio.checked = true;
orRadio.dispatchEvent(new dom.window.Event("change"));
assert(lastMode === "OR", "ORラジオ選択でモードがORになる");

// 4. チェックを外すと選択から除外される
tempCheckbox.checked = false;
tempCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === 1 && lastSelected.has("snow"), "気温を外すと積雪のみ残る");

// 5. クリアボタンで全解除（モードは維持される）
const clearButton = container.querySelector(".element-controls__clear");
clearButton.dispatchEvent(new dom.window.Event("click"));
assert(lastSelected.size === 0, "クリア後は0件選択");
assert(snowCheckbox.checked === false, "クリア後はチェックボックスの見た目もOFFになる");
assert(lastMode === "OR", "クリアしてもモードは維持される");

console.log("\nAll element-filter tests passed.");
