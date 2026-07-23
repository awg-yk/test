import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const dom = new JSDOM("<!DOCTYPE html><div id='root'></div>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

const { initRegionSelector } = await import("./js/modules/regionSelector.js");
const data = JSON.parse(readFileSync("./data/stations.json", "utf-8"));

const counts = new Map();
data.stations.forEach((s) => counts.set(s.prefecture, (counts.get(s.prefecture) ?? 0) + 1));

// 47都道府県 + 南極（昭和基地）。地域を増やしてもテストが壊れないようマスタから数える
const totalAreaCount = data.regions.reduce((sum, r) => sum + r.prefectures.length, 0);

let lastSelected = null;
const container = document.getElementById("root");

const regionSelector = initRegionSelector({
  container,
  regions: data.regions,
  stationCounts: counts,
  onChange: (selected) => {
    lastSelected = selected;
  },
});

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

// 1. 初期状態: 何も選択されていない
assert(lastSelected === null, "初期状態では onChange は呼ばれない");

// 2. 東北の地方チェックボックスをONにすると、配下の6県が選択される
const tohokuCheckbox = document.getElementById("region-tohoku");
tohokuCheckbox.checked = true;
tohokuCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === 6, `東北ON → 6県選択 (実際: ${lastSelected.size})`);
assert(lastSelected.has("青森県") && lastSelected.has("福島県"), "青森県・福島県が含まれる");

// 3. 東北の中の1県（青森県）だけ外すと、東北チェックボックスは indeterminate になる
const aomoriCheckbox = document.getElementById("pref-tohoku-青森県");
aomoriCheckbox.checked = false;
aomoriCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === 5, `青森県を外す → 5県選択 (実際: ${lastSelected.size})`);
assert(tohokuCheckbox.indeterminate === true, "東北チェックボックスが indeterminate になる");
assert(tohokuCheckbox.checked === false, "東北チェックボックス自体はONにならない");

// 4. 「全国」チェックボックスは一部選択のため indeterminate
const allCheckbox = document.getElementById("region-select-all");
assert(allCheckbox.indeterminate === true, "全国チェックボックスも indeterminate");

// 5. クリアボタンで全解除
const clearButton = container.querySelector(".region-controls__clear");
clearButton.dispatchEvent(new dom.window.Event("click"));
assert(lastSelected.size === 0, "クリア後は0件選択");
assert(tohokuCheckbox.checked === false && tohokuCheckbox.indeterminate === false, "クリア後は東北も未選択・indeterminate解除");

// 6. 一括選択チェックボックスONで全地域（47都道府県+南極）が選択される
allCheckbox.checked = true;
allCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === totalAreaCount, `一括選択ON → ${totalAreaCount}地域 (実際: ${lastSelected.size})`);
assert(lastSelected.has("南極"), "南極（昭和基地）も選択対象に含まれる");

// 7. updateCounts() で、選択状態を保ったまま件数表示だけが更新される（フェーズ10）
const hokkaidoLabelBefore = container.querySelector("#region-hokkaido + .region-group__label").textContent;
regionSelector.updateCounts(new Map([["北海道", 3]]));

const hokkaidoLabelAfter = container.querySelector("#region-hokkaido + .region-group__label").textContent;
assert(hokkaidoLabelBefore !== hokkaidoLabelAfter, "updateCounts() で地方の件数表示が変わる");
assert(hokkaidoLabelAfter === "北海道 (3)", `地方の件数は配下都道府県の合計になる (実際: ${hokkaidoLabelAfter})`);

const aomoriLabel = container.querySelector("#pref-tohoku-青森県 + .prefecture-item__label").textContent;
assert(aomoriLabel.includes("青森県 (0)"), `件数が渡されなかった都道府県は0件表示になる (実際: ${aomoriLabel})`);
assert(
  container.querySelector("#pref-tohoku-青森県").parentElement.classList.contains("prefecture-item--empty"),
  "0件の都道府県には prefecture-item--empty が付く"
);
assert(lastSelected.size === totalAreaCount, "updateCounts() は選択状態を変えない");
assert(container.querySelector("#pref-tohoku-青森県").checked === true, "updateCounts() はチェックボックスの状態も保つ");

console.log("\nすべてのテストが成功しました。");
