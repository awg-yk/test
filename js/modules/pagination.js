/**
 * pagination.js
 * ------------------------------------------------------------
 * 観測所一覧のページ分割。1,286件を一度に描画すると一覧が
 * 縦に長くなりすぎるため、1ページあたり pageSize 件ずつ表示する。
 *
 *   paginate(items, page, pageSize) -> { items, page, totalPages, total }
 *     page は 1始まり。範囲外の場合は自動的にクランプする。
 *
 *   renderPagination(container, { page, pageSize, total, onPageChange })
 *     ページ番号ボタン（前へ / 次へ / 現在ページ周辺）を描画する。
 */

import { h } from "../utils/helpers.js";

export function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: clampedPage,
    totalPages,
    total,
  };
}

/** 現在ページを中心に、表示するページ番号のリストを作る（例: 1 … 4 5 [6] 7 8 … 26） */
function buildPageNumbers(page, totalPages, span = 2) {
  const pages = new Set([1, totalPages]);
  for (let p = page - span; p <= page + span; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

export function renderPagination(container, { page, pageSize, total, onPageChange }) {
  container.innerHTML = "";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return; // 1ページに収まるなら何も表示しない

  const nav = h("nav", { class: "pagination", "aria-label": "観測所一覧のページ切り替え" });

  const prevBtn = h(
    "button",
    {
      type: "button",
      class: "pagination__btn",
      onClick: () => page > 1 && onPageChange(page - 1),
    },
    "← 前へ"
  );
  if (page <= 1) prevBtn.disabled = true;

  const nextBtn = h(
    "button",
    {
      type: "button",
      class: "pagination__btn",
      onClick: () => page < totalPages && onPageChange(page + 1),
    },
    "次へ →"
  );
  if (page >= totalPages) nextBtn.disabled = true;

  const pageNumbers = buildPageNumbers(page, totalPages);
  const numberEls = [];
  let lastRendered = 0;
  pageNumbers.forEach((p) => {
    if (p - lastRendered > 1) {
      numberEls.push(h("span", { class: "pagination__ellipsis" }, "…"));
    }
    const btn = h(
      "button",
      {
        type: "button",
        class: p === page ? "pagination__page is-current" : "pagination__page",
        "aria-current": p === page ? "page" : null,
        onClick: () => p !== page && onPageChange(p),
      },
      String(p)
    );
    numberEls.push(btn);
    lastRendered = p;
  });

  nav.append(prevBtn, ...numberEls, nextBtn);
  container.append(nav);
}
