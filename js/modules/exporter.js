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
 * URLパラメータとして受け取る。観測所マスタに precNo / blockNo（気象庁地点番号）が
 * 収録されていれば、その観測所を選択済みの状態で検索ページを開くリンクを生成できる
 * （buildJmaStationLink）。
 *
 * 【リンク先を etrn のトップ(index.php)にしている理由】
 * 日別値の直リンク（view/daily_s1.php）は、
 *   - 気象官署は daily_s1.php、アメダスは daily_a1.php と種別ごとにファイルが異なる
 *   - year / month を省略するとどちらも「ページを表示することが出来ませんでした」になる
 * ため、全観測所で同じ形の有効なリンクにならない（アメダス1,230地点で実際にエラーページ
 * になっていた）。etrn のトップは prec_no / block_no を渡すと該当地点が選択済みの状態で
 * 開き、そこから年月・データ種別（日別値・月別値・平年値など）を選べるので、
 * 種別に関係なく同じ形で有効なリンクになる。
 *
 *   exportStationsAsCSV(stations, options) -> void（ダウンロード実行）
 *   stationsToCsv(stations, options) -> string（CSV文字列。テスト用に分離）
 *   buildJmaDownloadUrl() -> string（気象庁ダウンロードページのURL）
 *   buildJmaStationLink(station) -> string | null（地点を選択済みのetrnページURL。データ不足時はnull）
 */

const JMA_OBSDL_URL = "https://www.data.jma.go.jp/risk/obsdl/index.php";
const JMA_ETRN_URL = "https://www.data.jma.go.jp/stats/etrn/index.php";

const CSV_HEADER = [
  "観測所ID",
  "地点名",
  "かな",
  "都道府県",
  "地方",
  "緯度",
  "経度",
  "標高(m)",
  "種別",
  "観測要素",
  "気象庁ページURL",
];

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
      station.kana ?? "",
      station.prefecture,
      regionName,
      station.lat,
      station.lon,
      station.alt ?? "",
      station.stationType ?? "",
      elementNames,
      buildJmaStationLink(station) ?? buildJmaPrefectureLink(station) ?? "",
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

/** etrn（過去の気象データ検索）のURLを組み立てる共通処理 */
function buildEtrnUrl(precNo, blockNo) {
  const params = new URLSearchParams({
    prec_no: precNo,
    block_no: blockNo,
    year: "",
    month: "",
    day: "",
    view: "",
  });
  return `${JMA_ETRN_URL}?${params.toString()}`;
}

/**
 * 観測所を選択済みの状態で「過去の気象データ検索」(etrn) を開くリンクを作る。
 * station.precNo / station.blockNo が揃っていない場合は null を返す。
 */
export function buildJmaStationLink(station) {
  if (!station?.precNo || !station?.blockNo) return null;
  return buildEtrnUrl(station.precNo, station.blockNo);
}

/**
 * 地点番号を確定できていない観測所（気象庁側に同名で複数のblock_noがある7地点）向けの、
 * 都道府県までは選択済みのetrnリンク。ユーザーが地図から地点を選び直せる状態で開く。
 * precNoAmbiguous も無い場合は null を返す。
 */
export function buildJmaPrefectureLink(station) {
  if (!station?.precNoAmbiguous) return null;
  return buildEtrnUrl(station.precNoAmbiguous, "");
}
