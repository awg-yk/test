/**
 * discontinuedFilter.js
 * ------------------------------------------------------------
 * 「廃止済み観測所を含める」単一のチェックボックスUI（フェーズ16）。
 *
 * 地域・観測要素・種別フィルタとは性質が異なり、「選択なし＝絞り込みなし」
 * ではなく「既定でオフ＝現行の観測所だけを表示」という単純なオン/オフの
 * トグルなので、regionSelector/elementFilter/typeFilter のような
 * 集合ベースの選択状態は使わず、真偽値ひとつだけを扱う。
 *
 *   initDiscontinuedFilter({
 *     container: HTMLElement,
 *     count: number,                 // 廃止済み観測所の総数（表示用。絞り込みには連動しない）
 *     initialChecked?: boolean,
 *     onChange: (checked: boolean) => void,
 *   }) -> void
 */

import { h } from "../utils/helpers.js";

export function initDiscontinuedFilter({ container, count, initialChecked = false, onChange }) {
  container.innerHTML = "";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "discontinued-filter__checkbox";
  checkbox.id = "discontinued-filter-checkbox";
  checkbox.checked = initialChecked;
  checkbox.addEventListener("change", () => onChange(checkbox.checked));

  const label = h(
    "label",
    { for: "discontinued-filter-checkbox", class: "discontinued-filter__label" },
    [checkbox, ` 廃止済み観測所を含める (${count}件)`]
  );

  container.append(label);
}
