/**
 * test-integration-smoke.mjs
 * ------------------------------------------------------------
 * index.html を実際にjsdomで読み込み、main.jsを走らせて
 * 「検索・地域選択・要素選択・ページネーションがDOM上で
 * 実際に噛み合っているか」を確認する統合テスト。
 * 個別モジュールの単体テストでは検出できない、
 * HTML側のID不一致や配線ミスを見つけるためのもの。
 */
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const html = readFileSync("./index.html", "utf-8");
const stationsJson = readFileSync("./data/stations.json", "utf-8");

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
});

// fetch("data/stations.json") をダミー実装で差し替える
dom.window.fetch = async (url) => {
  if (String(url).includes("stations.json")) {
    return { ok: true, json: async () => JSON.parse(stationsJson) };
  }
  throw new Error("unexpected fetch: " + url);
};

function loadScript(win, path) {
  const code = readFileSync(path, "utf-8");
  const script = win.document.createElement("script");
  script.type = "module";
  script.textContent = code;
  win.document.body.appendChild(script);
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const win = dom.window;
const doc = win.document;

// main.js は type="module" の相対importを使っているため、jsdom単体では
// モジュール解決ができない。代わりにNodeのESMローダーでmain.jsを直接importし、
// dom.window をグローバルとして差し込む簡易アプローチを取る。
global.window = win;
global.document = doc;
global.fetch = win.fetch;
global.Node = win.Node;
global.HTMLElement = win.HTMLElement;

await import("./js/main.js");

// 初期読み込み（fetch + 各モジュール初期化）が終わるまで少し待つ
await wait(50);

// --- 初期表示: 1ページ目が50件表示されている ---
const rowsInitial = doc.querySelectorAll("#station-table-container tbody tr");
assert(rowsInitial.length === 50, `初期表示は1ページ目の50件 (実際: ${rowsInitial.length})`);

const paginationButtons = doc.querySelectorAll("#pagination-container .pagination__page");
assert(paginationButtons.length > 0, "ページネーションのページ番号ボタンが描画されている");

// --- 検索: 「東京」で絞り込む ---
const searchInput = doc.querySelector("#keyword-search-container .keyword-search__input");
assert(searchInput != null, "検索ボックスが描画されている");

searchInput.value = "東京";
searchInput.dispatchEvent(new win.Event("input"));
await wait(300); // デバウンス(200ms)待ち

const rowsAfterSearch = doc.querySelectorAll("#station-table-container tbody tr");
assert(rowsAfterSearch.length > 0, "「東京」検索でヒットする観測所がある");
assert(rowsAfterSearch.length < 50, "「東京」検索で全1,287件よりずっと少ない件数に絞り込まれる");

const firstRowText = rowsAfterSearch[0].textContent;
assert(firstRowText.includes("東京") || firstRowText.includes("都"), "絞り込み結果に「東京」関連の文字列が含まれる");

// --- 検索クリアで全件表示に戻る ---
const clearBtn = doc.querySelector("#keyword-search-container .keyword-search__clear");
clearBtn.dispatchEvent(new win.Event("click"));
await wait(300);

const rowsAfterClear = doc.querySelectorAll("#station-table-container tbody tr");
assert(rowsAfterClear.length === 50, "検索クリア後は1ページ目の50件表示に戻る");

// --- プリセット: 「気象官署のみ」を適用する（フェーズ9） -----------------------
const presetButtons = [...doc.querySelectorAll("#preset-panel-container .preset-panel__btn")];
assert(presetButtons.length > 0, "プリセットボタンが描画されている");

const kanshoPresetBtn = presetButtons.find((btn) => btn.textContent.includes("気象官署のみ"));
assert(!!kanshoPresetBtn, "「気象官署のみ」プリセットボタンが存在する");

kanshoPresetBtn.click();
await wait(50);

const rowsAfterPreset = [...doc.querySelectorAll("#station-table-container tbody tr")];
assert(rowsAfterPreset.length > 0, "プリセット適用後も観測所が表示される");

// 気象官署56地点 + 南極・昭和基地 = 57地点
const kanshoCount = JSON.parse(stationsJson).stations.filter((s) => s.stationType === "気象官署").length;
const statusTextAfterPreset = doc.querySelector("#status-count").textContent;
assert(
  statusTextAfterPreset.includes(`絞り込み ${kanshoCount}件`),
  `「気象官署のみ」プリセットで絞り込み件数が${kanshoCount}件になる (実際の表示: ${statusTextAfterPreset})`
);

const typeCheckboxAfterPreset = doc.querySelector("#type-filter-container #type-気象官署");
assert(typeCheckboxAfterPreset?.checked === true, "プリセット適用後、種別フィルタUIにも「気象官署」が選択済みとして反映される");

// --- 件数表示が他の絞り込みに連動する（フェーズ10） -------------------------
// 種別プリセットが残っていると件数の期待値が変わるため、いったん全条件をクリアする
const clearPresetBtn = presetButtons.find((btn) => btn.textContent.includes("すべてクリア"));
assert(!!clearPresetBtn, "「すべてクリア」プリセットボタンが存在する");
clearPresetBtn.click();
await wait(50);

const elementLabelOf = (id) =>
  doc.querySelector(`#element-filter-container #element-${id} + .element-item__label`).textContent;

const tempLabelNationwide = elementLabelOf("temperature");

const hokkaidoCheckbox = doc.querySelector("#region-selector-container #region-hokkaido");
hokkaidoCheckbox.checked = true;
hokkaidoCheckbox.dispatchEvent(new win.Event("change"));
await wait(50);

const tempLabelHokkaido = elementLabelOf("temperature");
assert(
  tempLabelHokkaido !== tempLabelNationwide,
  `北海道を選ぶと観測要素の件数表示が変わる (全国: ${tempLabelNationwide} → 北海道: ${tempLabelHokkaido})`
);

const expectedHokkaidoTemp = JSON.parse(stationsJson).stations.filter(
  (s) => s.prefecture === "北海道" && s.elements.includes("temperature")
).length;
assert(
  tempLabelHokkaido.includes(`(${expectedHokkaidoTemp})`),
  `観測要素の件数が北海道内の気温観測地点数になる (期待: ${expectedHokkaidoTemp}, 実際: ${tempLabelHokkaido})`
);

console.log("\nAll integration smoke tests passed.");
