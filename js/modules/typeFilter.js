/**
 * typeFilter.js
 * ------------------------------------------------------------
 * 観測所の種別（気象官署／アメダス）で絞り込むチェックボックスUI。
 *
 *   initTypeFilter({
 *     container: HTMLElement,
 *     stationTypes: string[],                 // 例: ["気象官署", "アメダス"]
 *     stationCounts?: Map<stationType, number>,
 *     initialSelected?: Set<string>,          // 初期選択（URLクエリ・プリセット復元用）
 *     onChange: (selected: Set<string>) => void,
 *   })
 *
 * 選択状態の正は「選択中の種別の集合（selected）」。
 * 何も選択されていない状態 = 絞り込みなし（全観測所を表示）として扱う
 * （regionSelector / elementFilter と同じ方針）。
 * 種別は排他ではなく複数選択可（両方選択 = 絞り込みなしと同義）。
 */

import { h } from "../utils/helpers.js";

export function initTypeFilter({ container, stationTypes, stationCounts, initialSelected, onChange }) {
  container.innerHTML = "";

  const selected = new Set(initialSelected ?? []);
  const checkboxes = new Map();

  const countFor = (type) => (stationCounts ? stationCounts.get(type) ?? 0 : null);

  function emitChange() {
    onChange(new Set(selected));
  }

  const clearButton = h(
    "button",
    {
      type: "button",
      class: "element-controls__clear",
      onClick: () => {
        if (selected.size === 0) return;
        selected.clear();
        checkboxes.forEach((cb) => (cb.checked = false));
        emitChange();
      },
    },
    "選択をクリア"
  );

  const controls = h("div", { class: "element-controls" }, [clearButton]);
  container.append(controls);

  const list = h("div", { class: "element-list" });

  stationTypes.forEach((type) => {
    const id = `type-${type}`;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "element-item__checkbox";
    cb.id = id;
    cb.checked = selected.has(type);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        selected.add(type);
      } else {
        selected.delete(type);
      }
      emitChange();
    });
    checkboxes.set(type, cb);

    const count = countFor(type);
    const labelText = count === null ? type : `${type} (${count})`;

    list.append(
      h("label", { for: id, class: "element-item" }, [cb, h("span", { class: "element-item__label" }, labelText)])
    );
  });

  container.append(list);
}
