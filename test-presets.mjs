import { PRESETS, buildPresetState } from "./js/modules/presets.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

// --- PRESETS の基本形 -------------------------------------------------------

assert(Array.isArray(PRESETS) && PRESETS.length > 0, "PRESETSは1件以上の配列");
assert(
  PRESETS.every((p) => typeof p.id === "string" && typeof p.label === "string"),
  "各プリセットはidとlabelを持つ"
);
assert(new Set(PRESETS.map((p) => p.id)).size === PRESETS.length, "プリセットIDは重複しない");

// --- buildPresetState -------------------------------------------------------

const clearState = buildPresetState("clear");
assert(clearState.selectedPrefectures.size === 0, "clearプリセットは都道府県選択なし");
assert(clearState.selectedElements.size === 0, "clearプリセットは観測要素選択なし");
assert(clearState.selectedStationTypes.size === 0, "clearプリセットは種別選択なし");
assert(clearState.elementLogic === "AND", "clearプリセットのモードはAND");
assert(clearState.keyword === "", "clearプリセットはキーワードなし");

const kanshoState = buildPresetState("kansho-only");
assert(
  kanshoState.selectedStationTypes.size === 1 && kanshoState.selectedStationTypes.has("気象官署"),
  "kansho-onlyプリセットは気象官署のみを選択する"
);
assert(kanshoState.selectedElements.size === 0, "kansho-onlyプリセットは観測要素を絞り込まない（他の軸はリセットされる）");
assert(kanshoState.selectedPrefectures.size === 0, "kansho-onlyプリセットは地域を絞り込まない（他の軸はリセットされる）");

const tempPrecipState = buildPresetState("temp-precip");
assert(
  tempPrecipState.selectedElements.size === 2 &&
    tempPrecipState.selectedElements.has("temperature") &&
    tempPrecipState.selectedElements.has("precipitation"),
  "temp-precipプリセットは気温・降水量の2要素を選択する"
);
assert(tempPrecipState.elementLogic === "AND", "temp-precipプリセットはAND条件");

const unknownState = buildPresetState("does-not-exist");
assert(
  unknownState.selectedPrefectures.size === 0 &&
    unknownState.selectedElements.size === 0 &&
    unknownState.selectedStationTypes.size === 0,
  "未知のプリセットIDは既定値（絞り込みなし）を返す"
);

// --- 各プリセットが独立したSetインスタンスを返すこと（参照共有によるバグ防止） ---

const a = buildPresetState("kansho-only");
const b = buildPresetState("kansho-only");
a.selectedStationTypes.add("アメダス");
assert(!b.selectedStationTypes.has("アメダス"), "buildPresetStateは呼び出しごとに独立したSetを返す（参照共有しない）");

console.log("\nAll presets tests passed.");
