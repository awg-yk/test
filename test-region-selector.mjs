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

let lastSelected = null;
const container = document.getElementById("root");

initRegionSelector({
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

// 6. 全国チェックボックスONで全47都道府県が選択される
allCheckbox.checked = true;
allCheckbox.dispatchEvent(new dom.window.Event("change"));
assert(lastSelected.size === 47, `全国ON → 47都道府県 (実際: ${lastSelected.size})`);

console.log("\nすべてのテストが成功しました。");
