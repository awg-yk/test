/**
 * presetPanel.js
 * ------------------------------------------------------------
 * プリセット（よく使う絞り込み条件）をボタンとして描画するUI（フェーズ9）。
 *
 *   initPresetPanel({
 *     container: HTMLElement,
 *     presets: Preset[],           // presets.js の PRESETS
 *     onSelect: (presetId: string) => void,
 *   })
 *
 * ボタン自体はどれが「選択中」かの状態を持たない（プリセットは瞬間的な
 * 一括適用アクションであり、後から地域・観測要素パネルを個別に操作すれば
 * その時点でプリセットとは異なる状態になるため、常時ハイライトし続けると
 * かえって誤解を招く）。
 */

import { h } from "../utils/helpers.js";

export function initPresetPanel({ container, presets, onSelect }) {
  container.innerHTML = "";

  const wrap = h("div", { class: "preset-panel" });

  presets.forEach((preset) => {
    const btn = h(
      "button",
      {
        type: "button",
        class: "preset-panel__btn",
        onClick: () => onSelect(preset.id),
      },
      preset.label
    );
    wrap.append(btn);
  });

  container.append(wrap);
}
