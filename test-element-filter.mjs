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

const elementFilter = initElementFilter({
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

// 6. updateCounts(): 他の絞り込み（地域など）に連動して件数表示だけを差し替える（フェーズ10）
const tempLabel = () => container.querySelector("#element-temperature ~ .element-item__label").textContent;

assert(tempLabel() === `気温 (${counts.get("temperature")})`, "初期表示は全観測所ベースの件数");

snowCheckbox.checked = true; // 件数更新でチェック状態が壊れないことの確認用
snowCheckbox.dispatchEvent(new dom.window.Event("change"));

elementFilter.updateCounts(new Map([["temperature", 174], ["snow", 120]]));
assert(tempLabel() === "気温 (174)", `updateCounts() で件数表示が更新される (実際: ${tempLabel()})`);
assert(snowCheckbox.checked === true, "updateCounts() はチェック状態を変えない");
assert(lastSelected.size === 1 && lastSelected.has("snow"), "updateCounts() は onChange を呼ばない（選択状態も不変）");
assert(
  container.querySelector("#element-precipitation").parentElement.classList.contains("element-item--empty"),
  "0件になった観測要素には element-item--empty が付く"
);
assert(
  !container.querySelector("#element-temperature").parentElement.classList.contains("element-item--empty"),
  "1件以上ある観測要素には element-item--empty は付かない"
);

// 7. 観測要素ごとの色ドット（一覧テーブルのタグ色の凡例）
data.elements.forEach((el) => {
  const dot = container.querySelector(`#element-${el.id} ~ .element-item__dot`);
  assert(
    dot?.classList.contains(`element-item__dot--${el.id}`),
    `${el.name}に要素ごとの色ドットが付く（.element-item__dot--${el.id}）`
  );
});

// 8. clearButtonSlot を渡すと、そちらに「選択をクリア」ボタンが描画される（フェーズ23）
{
  const bodyContainer = document.createElement("div");
  const headerSlot = document.createElement("span");
  let slotLastSelected = null;
  initElementFilter({
    container: bodyContainer,
    elements: data.elements,
    initialSelected: new Set(["temperature"]),
    clearButtonSlot: headerSlot,
    onChange: (sel) => {
      slotLastSelected = sel;
    },
  });
  assert(!bodyContainer.querySelector(".element-controls__clear"), "clearButtonSlot指定時はパネル本文側にクリアボタンが無い");
  const slotClearButton = headerSlot.querySelector(".element-controls__clear");
  assert(!!slotClearButton, "clearButtonSlotの中にクリアボタンが描画される");
  slotClearButton.dispatchEvent(new dom.window.Event("click"));
  assert(slotLastSelected.size === 0, "スロット内のクリアボタンでも選択解除が機能する");
}

console.log("\nAll element-filter tests passed.");
