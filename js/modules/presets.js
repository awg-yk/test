/**
 * presets.js
 * ------------------------------------------------------------
 * よく使う絞り込み条件をワンクリックで適用できるプリセット定義（フェーズ9）。
 *
 * 各プリセットは「絞り込み条件の完全な状態」を表す。中途半端に前の条件と
 * マージすると結果が予測しづらくなるため、プリセット適用時は指定していない
 * 項目もすべて既定値（絞り込みなし）にリセットする方針にしている。
 *
 *   PRESETS: Preset[]
 *   buildPresetState(preset) -> 完全な絞り込み状態オブジェクト（store.setState に渡せる形）
 */

const DEFAULT_STATE = () => ({
  selectedPrefectures: new Set(),
  selectedElements: new Set(),
  elementLogic: "AND",
  selectedStationTypes: new Set(),
  keyword: "",
});

export const PRESETS = [
  {
    id: "clear",
    label: "すべてクリア（全国・全観測所）",
    overrides: {},
  },
  {
    id: "kansho-only",
    label: "気象官署のみ",
    overrides: { selectedStationTypes: new Set(["気象官署"]) },
  },
  {
    id: "amedas-only",
    label: "アメダスのみ",
    overrides: { selectedStationTypes: new Set(["アメダス"]) },
  },
  {
    id: "temp-precip",
    label: "気温・降水量ともに観測",
    overrides: { selectedElements: new Set(["temperature", "precipitation"]), elementLogic: "AND" },
  },
  {
    id: "snow-only",
    label: "積雪観測地点のみ",
    overrides: { selectedElements: new Set(["snow"]) },
  },
  {
    id: "sunshine-only",
    label: "日照時間観測地点のみ",
    overrides: { selectedElements: new Set(["sunshine"]) },
  },
];

/** プリセットIDから完全な絞り込み状態を組み立てる。未知のIDの場合は既定値（絞り込みなし）を返す。
 *  呼び出しごとに新しいSetインスタンスを返す（呼び出し元がSetを変更してもプリセット定義自体は汚染されない）。 */
export function buildPresetState(presetId) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const merged = { ...DEFAULT_STATE(), ...(preset?.overrides ?? {}) };
  return {
    ...merged,
    selectedPrefectures: new Set(merged.selectedPrefectures),
    selectedElements: new Set(merged.selectedElements),
    selectedStationTypes: new Set(merged.selectedStationTypes),
  };
}
