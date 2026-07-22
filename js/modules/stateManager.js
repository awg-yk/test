/**
 * stateManager.js
 * ------------------------------------------------------------
 * アプリ全体の選択状態を一元管理する、ごく小さな Pub/Sub ストア。
 * フェーズ2以降で「地域選択」「観測要素フィルタ」が増えても、
 * ここに状態を足していくだけで済むようにしてある。
 *
 * 使い方:
 *   import { store } from "./stateManager.js";
 *   store.subscribe((state) => { ... });
 *   store.setState({ stations: [...] });
 */

function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(partial) {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}

// フェーズ1時点で扱う状態:
// - allStations: 読み込んだ観測所マスタ全件
// - visibleStations: 現在の絞り込み条件で表示すべき観測所
//   （フェーズ1では allStations と同一。フェーズ2/3でフィルタを適用する）
// - status: "loading" | "ready" | "error"
export const store = createStore({
  allStations: [],
  visibleStations: [],
  status: "loading",
  errorMessage: "",
});
