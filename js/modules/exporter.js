/**
 * exporter.js
 * ------------------------------------------------------------
 * 現在絞り込まれている観測所リストの CSV エクスポート、および
 * 気象庁公式ページへ案内するリンクの生成。
 *
 * 【気象庁側の仕様について（要仕様調査の結果）】
 * 「過去の気象データ・ダウンロード」(https://www.data.jma.go.jp/risk/obsdl/index.php)
 * は観測所・項目・期間をJS制御のフォームで選択する方式で、URLパラメータによる
 * 観測所の事前選択（ディープリンク）には対応していない。
 * そのため本ツールでは:
 *   1) 絞り込んだ観測所一覧を CSV としてダウンロードできるようにし（地点名や
 *      地方・都道府県・観測要素を手元に残せるようにする）、
 *   2) 気象庁公式ページへは「常に有効なトップページURL」を案内する
 * という設計にしている。
 *
 * 一方、姉妹サイトの「過去の気象データ検索」(etrn) は prec_no / block_no を
 * URLパラメータとして受け取る個別地点ページを持つ。観測所マスタに
 * precNo / blockNo（気象庁地点番号）が収録されていれば、その観測所の
 * 個別ページへ直接案内するリンクも生成できる（buildJmaStationLink）。
 * 現在のサンプルデータには収録されていないため、実データ整備後に有効化される想定。
 *
 *   exportStationsAsCSV(stations, options) -> void（ダウンロード実行）
 *   stationsToCsv(stations, options) -> string（CSV文字列。テスト用に分離）
 *   buildJmaDownloadUrl() -> string（気象庁ダウンロードページのURL）
 *   buildJmaStationLink(station) -> string | null（地点別ページのURL。データ不足時はnull）
 */

const JMA_OBSDL_URL = "https://www.data.jma.go.jp/risk/obsdl/index.php";
const JMA_ETRN_STATION_VIEW_URL = "https://www.data.jma.go.jp/stats/etrn/view/daily_s1.php";

const CSV_HEADER = ["観測所ID", "地点名", "都道府県", "地方", "緯度", "経度", "種別", "観測要素"];

function toCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatTimestampForFilename(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}`;
}

/** 観測所配列からCSV文字列を組み立てる（Excelでの文字化け対策としてUTF-8 BOM付き） */
export function stationsToCsv(stations, { elementLabelMap, regionLabelMap } = {}) {
  const rows = stations.map((station) => {
    const elementNames = (station.elements ?? [])
      .map((id) => elementLabelMap?.get(id) ?? id)
      .join(" / ");
    const regionName = regionLabelMap?.get(station.region) ?? station.region ?? "";
    return [
      station.id,
      station.name,
      station.prefecture,
      regionName,
      station.lat,
      station.lon,
      station.stationType ?? "",
      elementNames,
    ];
  });

  const lines = [CSV_HEADER, ...rows].map((row) => row.map(toCsvCell).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** 現在の観測所一覧をCSVファイルとしてダウンロードする */
export function exportStationsAsCSV(stations, options = {}) {
  if (!stations || stations.length === 0) {
    console.warn("[exporter] エクスポート対象の観測所がありません。");
    return false;
  }

  const csv = stationsToCsv(stations, options);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = options.filename ?? `stations_${formatTimestampForFilename(new Date())}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

/** 気象庁「過去の気象データ・ダウンロード」トップページのURL（常に有効な誘導先） */
export function buildJmaDownloadUrl() {
  return JMA_OBSDL_URL;
}

/**
 * 観測所ごとの「過去の気象データ検索」(etrn) 個別ページへのリンクを作る。
 * station.precNo / station.blockNo が揃っていない場合は null を返す。
 */
export function buildJmaStationLink(station) {
  if (!station?.precNo || !station?.blockNo) return null;
  const params = new URLSearchParams({
    prec_no: station.precNo,
    block_no: station.blockNo,
    year: "",
    month: "",
    day: "",
    view: "",
  });
  return `${JMA_ETRN_STATION_VIEW_URL}?${params.toString()}`;
}
