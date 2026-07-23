/**
 * urlState.js
 * ------------------------------------------------------------
 * 現在の絞り込み条件（地域・観測要素・モード・検索語・ページ）を
 * URLクエリパラメータとして読み書きするモジュール（フェーズ7: URLクエリ化）。
 *
 * パラメータ名:
 *   pref  - 選択中の都道府県（カンマ区切り。例: pref=青森県,秋田県）
 *   elem  - 選択中の観測要素ID（カンマ区切り。例: elem=temperature,wind）
 *   mode  - 観測要素の合成モード。"AND"（既定値）のときは省略してURLを短く保つ
 *   q     - キーワード検索文字列
 *   page  - 表示中のページ番号。1（既定値）のときは省略
 *
 * 「絞り込みなし」の状態はパラメータを一切付けない（＝トップページと同じURL）。
 * 都道府県名や検索語に含まれる日本語・カンマ等は URLSearchParams が自動でエンコードする。
 */

const PARAM_PREF = "pref";
const PARAM_ELEM = "elem";
const PARAM_MODE = "mode";
const PARAM_KEYWORD = "q";
const PARAM_PAGE = "page";

function splitCsv(value) {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * URLSearchParams（またはクエリ文字列 "?a=1&b=2" 等）から絞り込み状態を読み取る。
 * 純粋関数（DOM非依存）なのでユニットテストしやすい。
 */
export function parseStateFromUrl(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");

  const prefectures = new Set(splitCsv(params.get(PARAM_PREF)));
  const elements = new Set(splitCsv(params.get(PARAM_ELEM)));
  const elementLogic = params.get(PARAM_MODE) === "OR" ? "OR" : "AND";
  const keyword = params.get(PARAM_KEYWORD) ?? "";

  const pageRaw = Number.parseInt(params.get(PARAM_PAGE) ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  return { prefectures, elements, elementLogic, keyword, page };
}

/**
 * store の状態（selectedPrefectures / selectedElements / elementLogic / keyword / page）から
 * クエリ文字列を組み立てる（先頭の "?" は含まない）。既定値のパラメータは省略する。
 */
export function buildQueryString(state) {
  const params = new URLSearchParams();

  if (state.selectedPrefectures && state.selectedPrefectures.size > 0) {
    params.set(PARAM_PREF, [...state.selectedPrefectures].join(","));
  }
  if (state.selectedElements && state.selectedElements.size > 0) {
    params.set(PARAM_ELEM, [...state.selectedElements].join(","));
    if (state.elementLogic === "OR") {
      params.set(PARAM_MODE, "OR");
    }
  }
  if (state.keyword && state.keyword.trim() !== "") {
    params.set(PARAM_KEYWORD, state.keyword);
  }
  if (state.page && state.page > 1) {
    params.set(PARAM_PAGE, String(state.page));
  }

  return params.toString();
}

/**
 * 現在の絞り込み状態を、ブラウザ履歴を汚さずに（pushStateではなくreplaceState）URLへ反映する。
 * フィルタ操作のたびに履歴が積み上がって「戻る」が壊れるのを避けるための意図的な選択。
 */
export function syncUrlWithState(state, { location = window.location, history = window.history } = {}) {
  const query = buildQueryString(state);
  const newUrl = query ? `${location.pathname}?${query}${location.hash}` : `${location.pathname}${location.hash}`;
  const currentUrl = `${location.pathname}${location.search}${location.hash}`;
  if (newUrl !== currentUrl) {
    history.replaceState(null, "", newUrl);
  }
}
