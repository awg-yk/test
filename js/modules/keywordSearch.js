/**
 * keywordSearch.js
 * ------------------------------------------------------------
 * 地点名・都道府県などでフリーワード検索するための入力欄。
 * 入力のたびに絞り込むと1,286件規模のデータでは負荷が気になるため、
 * 簡単なデバウンス（入力が止まってから発火）を入れている。
 *
 *   initKeywordSearch({
 *     container: HTMLElement,
 *     onChange: (keyword: string) => void,
 *     initialKeyword?: string, // 初期値（URLクエリ復元用。省略時は空）
 *     debounceMs?: number,   // 既定 200ms
 *   })
 */

import { h } from "../utils/helpers.js";

export function initKeywordSearch({ container, onChange, initialKeyword = "", debounceMs = 200 }) {
  container.innerHTML = "";

  let timer = null;

  const input = document.createElement("input");
  input.type = "search";
  input.className = "keyword-search__input";
  input.placeholder = "地点名・都道府県で検索（例: 富士山、札幌、青森県）";
  input.setAttribute("aria-label", "観測所を検索");
  input.value = initialKeyword;

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(input.value), debounceMs);
  });

  const clearButton = h(
    "button",
    {
      type: "button",
      class: "keyword-search__clear",
      "aria-label": "検索をクリア",
      onClick: () => {
        input.value = "";
        clearTimeout(timer);
        onChange("");
        input.focus();
      },
    },
    "×"
  );

  const wrap = h("div", { class: "keyword-search" }, [input, clearButton]);
  container.append(wrap);
}
