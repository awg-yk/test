/**
 * helpers.js — 汎用ユーティリティ
 */

/** 観測要素IDから日本語ラベルを引く辞書を作る */
export function buildElementLabelMap(elementsMaster) {
  const map = new Map();
  elementsMaster.forEach((el) => map.set(el.id, el.name));
  return map;
}

/** 地方IDから地方名を引く辞書を作る */
export function buildRegionLabelMap(regionsMaster) {
  const map = new Map();
  regionsMaster.forEach((r) => map.set(r.id, r.name));
  return map;
}

/** DOM生成の小さなショートハンド */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "class") {
      el.className = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null) return;
    el.append(child instanceof Node ? child : document.createTextNode(child));
  });
  return el;
}
