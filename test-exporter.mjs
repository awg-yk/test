import { readFileSync } from "fs";
import {
  stationsToCsv,
  buildJmaDownloadUrl,
  buildJmaStationLink,
  buildJmaPrefectureLink,
} from "./js/modules/exporter.js";

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

const data = JSON.parse(readFileSync("./data/stations.json", "utf-8"));

const elementLabelMap = new Map(data.elements.map((el) => [el.id, el.name]));
const regionLabelMap = new Map(data.regions.map((r) => [r.id, r.name]));

// --- stationsToCsv ------------------------------------------------------

const sample = data.stations.slice(0, 2);
const csv = stationsToCsv(sample, { elementLabelMap, regionLabelMap });

assert(csv.startsWith("\uFEFF"), "CSVの先頭にUTF-8 BOMが付与される（Excel文字化け対策）");

const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
assert(lines.length === sample.length + 1, `ヘッダー行 + データ${sample.length}行 = ${sample.length + 1}行`);
assert(
  lines[0] === "観測所ID,地点名,かな,都道府県,地方,緯度,経度,標高(m),種別,観測要素,気象庁ページURL,状態,観測期間",
  `ヘッダー行が想定通り (実際: ${lines[0]})`
);
assert(lines[1].includes(sample[0].name), "1行目のデータに地点名が含まれる");
assert(lines[1].includes(regionLabelMap.get(sample[0].region)), "1行目のデータに地方名（日本語ラベル）が含まれる");
assert(lines[1].includes(String(sample[0].alt)), "1行目のデータに標高が含まれる");
assert(lines[1].includes("stats/etrn/index.php"), "1行目のデータに気象庁ページのURLが含まれる");

assert(lines[1].endsWith(",現役,"), "現役観測所は「状態」列が「現役」、「観測期間」列は空になる (実際: " + lines[1] + ")");

// 廃止済み観測所（フェーズ16）のCSV行
const discontinuedSample = data.discontinuedStations.slice(0, 1);
const discontinuedCsv = stationsToCsv(discontinuedSample, { elementLabelMap, regionLabelMap });
const discontinuedLines = discontinuedCsv.replace(/^\uFEFF/, "").trim().split("\r\n");
assert(discontinuedLines[1].includes("廃止済み"), "廃止済み観測所は「状態」列が「廃止済み」になる");
assert(
  discontinuedLines[1].includes(discontinuedSample[0].observedFrom),
  "廃止済み観測所は「観測期間」列に開始年月日が含まれる"
);

// カンマを含む地点名でもCSVとして壊れないこと（ダブルクォートで囲まれる）
const trickyStation = { ...sample[0], name: "テスト, 地点" };
const trickyCsv = stationsToCsv([trickyStation], { elementLabelMap, regionLabelMap });
assert(trickyCsv.includes('"テスト, 地点"'), "カンマを含む値はダブルクォートでエスケープされる");

// --- buildJmaDownloadUrl -------------------------------------------------

assert(
  buildJmaDownloadUrl() === "https://www.data.jma.go.jp/risk/obsdl/index.php",
  "気象庁ダウンロードページの正しいURLを返す"
);

// --- buildJmaStationLink --------------------------------------------------

// precNo/blockNo が無い観測所は null を返す（実データの内容に依存しない、合成データでテストする）
const stationWithoutCodes = { ...sample[0], precNo: undefined, blockNo: undefined };
assert(buildJmaStationLink(stationWithoutCodes) === null, "precNo/blockNoが無い観測所はnullを返す");

const stationWithCodes = { ...sample[0], precNo: "31", blockNo: "47581" };
const link = buildJmaStationLink(stationWithCodes);
assert(link !== null, "precNo/blockNoが揃っていればリンクを生成する");
assert(link.includes("prec_no=31"), "生成されたリンクにprec_noが含まれる");
assert(link.includes("block_no=47581"), "生成されたリンクにblock_noが含まれる");
assert(
  link.startsWith("https://www.data.jma.go.jp/stats/etrn/index.php?"),
  `リンク先はetrnのトップ（地点選択済み）。種別ごとに異なるdaily_s1/a1は使わない (実際: ${link})`
);
assert(!link.includes("daily_s1"), "アメダスで404になる daily_s1.php は使わない");

// --- buildJmaPrefectureLink（地点番号が確定していない7地点向け） -------------

const ambiguousStation = {
  ...sample[0],
  precNo: undefined,
  blockNo: undefined,
  precNoAmbiguous: "19",
  blockNoAmbiguousCandidates: ["0092", "1187"],
};
const prefectureLink = buildJmaPrefectureLink(ambiguousStation);
assert(prefectureLink !== null, "precNoAmbiguousがあれば都道府県ページのリンクを生成する");
assert(prefectureLink.includes("prec_no=19"), "都道府県ページのリンクにprec_noが含まれる");
assert(prefectureLink.includes("block_no=&"), "都道府県ページのリンクではblock_noは空にする");
assert(buildJmaPrefectureLink(stationWithCodes) === null, "地点番号が確定している観測所ではnullを返す");

// 全観測所が「地点リンク」か「都道府県リンク」のどちらかを必ず持つ（リンク切れを作らない）
const withoutAnyLink = data.stations.filter(
  (s) => buildJmaStationLink(s) === null && buildJmaPrefectureLink(s) === null
);
assert(
  withoutAnyLink.length === 0,
  `全観測所が有効な気象庁リンクを持つ (リンク無し: ${withoutAnyLink.length}件)`
);

console.log("\nAll exporter tests passed.");
