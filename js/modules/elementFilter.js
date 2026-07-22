/**
 * elementFilter.js
 * ------------------------------------------------------------
 * 観測要素（気温・降水量・積雪・風・湿度・日照時間）による
 * 絞り込みチェックボックスUIと、AND/OR切り替えロジック。
 *
 * API:
 *
 *   initElementFilter({
 *     container: HTMLElement,
 *     elements: Element[],                       // data/stations.json の elements
 *     stationCounts?: Map<elementId, number>,     // 要素ごとの該当観測所数（表示用・省略可）
 *     onChange: (selected: Set<string>, mode: "AND" | "OR") => void,
 *   })
 *
 *   matchesElementFilter(station, selectedElementIds, mode)
 *     -> mode === "AND": station.elements が selectedElementIds を全て含むか
 *     -> mode === "OR" : station.elements が selectedElementIds のいずれかを含むか
 *
 * 選択状態の正は「選択中の観測要素IDの集合（selected）」と「モード（mode）」。
 * 何も選択されていない状態 = 絞り込みなし（全観測所を表示）として扱う
 * （regionSelector と同じ方針）。
 */

import { h } from "../utils/helpers.js";

export function initElementFilter({ container, elements, stationCounts, onChange }) {
  container.innerHTML = "";

  const selected = new Set(); // 選択中の観測要素ID
  const checkboxes = new Map(); // elementId -> <input>
  let mode = "AND";

  const countFor = (elementId) => (stationCounts ? stationCounts.get(elementId) ?? 0 : null);

  function emitChange() {
    onChange(new Set(selected), mode);
  }

  // --- AND/OR切り替え + クリアボタン --------------------------------
  const controls = h("div", { class: "element-controls" });

  const modeGroup = h("div", {
    class: "element-controls__mode",
    role: "radiogroup",
    "aria-label": "観測要素の絞り込みモード",
  });

  [
    { value: "AND", label: "すべて含む（AND）" },
    { value: "OR", label: "いずれか含む（OR）" },
  ].forEach(({ value, label }) => {
    const id = `element-mode-${value.toLowerCase()}`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "element-filter-mode";
    radio.id = id;
    radio.value = value;
    radio.checked = value === mode;
    radio.className = "element-controls__mode-radio";
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      mode = value;
      emitChange();
    });

    modeGroup.append(radio, h("label", { for: id, class: "element-controls__mode-label" }, label));
  });

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

  controls.append(modeGroup, clearButton);
  container.append(controls);

  // --- 観測要素チェックボックス一覧 ----------------------------------
  const list = h("div", { class: "element-list" });

  elements.forEach((el) => {
    const id = `element-${el.id}`;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "element-item__checkbox";
    cb.id = id;
    cb.addEventListener("change", () => {
      if (cb.checked) {
        selected.add(el.id);
      } else {
        selected.delete(el.id);
      }
      emitChange();
    });
    checkboxes.set(el.id, cb);

    const count = countFor(el.id);
    const labelText = count === null ? el.name : `${el.name} (${count})`;

    list.append(
      h("label", { for: id, class: "element-item" }, [cb, h("span", { class: "element-item__label" }, labelText)])
    );
  });

  container.append(list);
}

export function matchesElementFilter(station, selectedElementIds, mode = "AND") {
  if (selectedElementIds.size === 0) return true;
  const stationElements = new Set(station.elements);
  const selected = [...selectedElementIds];
  return mode === "AND"
    ? selected.every((id) => stationElements.has(id))
    : selected.some((id) => stationElements.has(id));
}
