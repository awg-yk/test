import { readFileSync } from "fs";
import { stationsToCsv, buildJmaDownloadUrl, buildJmaStationLink } from "./js/modules/exporter.js";

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
assert(lines[0] === "観測所ID,地点名,都道府県,地方,緯度,経度,種別,観測要素", `ヘッダー行が想定通り (実際: ${lines[0]})`);
assert(lines[1].includes(sample[0].name), "1行目のデータに地点名が含まれる");
assert(lines[1].includes(regionLabelMap.get(sample[0].region)), "1行目のデータに地方名（日本語ラベル）が含まれる");

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

console.log("\nAll exporter tests passed.");
