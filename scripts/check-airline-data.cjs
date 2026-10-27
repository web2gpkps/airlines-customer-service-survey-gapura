const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

Module._extensions[".ts"] = (mod, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  mod._compile(code, filename);
};

const { parseSegment } = require("../src/lib/sheets.ts");
const { SECTION_CATALOG } = require("../src/lib/survey-config.ts");
const { categorize, computeSurvey } = require("../src/lib/scoring.ts");

const statements = SECTION_CATALOG.airline.flatMap((section) => section.statements);
assert.equal(SECTION_CATALOG.airline.length, 8);
assert.equal(statements.length, 38);

const headers = [
  "Submission ID",
  "Respondent ID",
  "Submitted at",
  "1. Nama maskapai (airline) yang Anda gunakan:",
  "2. Tanggal & nomor penerbangan:",
  "3. Rute / bandara keberangkatan – tujuan:",
  "4. Jenis penerbangan Anda:",
  "5. Tujuan perjalanan Anda:",
  ...statements.map((text) => `Pernyataan / Aspek yang Dinilai [${text}]`),
  "6. Seberapa besar kemungkinan Anda merekomendasikan maskapai ini kepada keluarga/kolega/rekan bisnis?",
];
const row = [
  "RESP1", "RESP-1", "2026-01-01 00:00:00", "Garuda Indonesia", "GA123", "CGK-DPS", "Domestik", "Bisnis",
  ...statements.map((_, index) => index === 0 ? "6" : "5"),
  "10",
];
const data = parseSegment("airline", [headers, row]);
assert.equal(data.sections.length, 8);
assert.equal(data.responses.length, 1);
assert.equal(data.responses[0].id, "RESP1");
assert.equal(data.responses[0].route, "CGK - DPS");
assert.equal(data.responses[0].nps, 10);
assert.equal(data.responses[0].scores[0], null);
assert.equal(data.sections[2].statements[1].text.includes("&amp;"), false);
assert.equal(computeSurvey(data.sections, data.responses).overall.n, 37);

const renumberedHeaders = [...headers];
renumberedHeaders[3] = renumberedHeaders[3].replace(/^1\./, "3.");
renumberedHeaders[4] = renumberedHeaders[4].replace(/^2\./, "4.");
renumberedHeaders[5] = renumberedHeaders[5].replace(/^3\./, "5.");
renumberedHeaders[6] = renumberedHeaders[6].replace(/^4\./, "6.");
renumberedHeaders[7] = renumberedHeaders[7].replace(/^5\./, "7.");
renumberedHeaders[renumberedHeaders.length - 1] = renumberedHeaders.at(-1).replace(/^6\./, "1.");
const renumberedData = parseSegment("airline", [renumberedHeaders, row]);
assert.equal(renumberedData.responses.length, 1);
assert.equal(renumberedData.responses[0].airline, "Garuda Indonesia");
assert.equal(renumberedData.responses[0].flight, "GA123");
assert.equal(renumberedData.responses[0].route, "CGK - DPS");
assert.equal(renumberedData.responses[0].flightType, "Domestik");
assert.equal(renumberedData.responses[0].travelPurpose, "Bisnis");
assert.equal(renumberedData.responses[0].nps, 10);

const unnumberedHeaders = [
  "Submission ID",
  "Respondent ID",
  "Submitted at",
  "Nama penumpang:",
  "Nomor HP penumpang (No. HP):",
  "Bandara keberangkatan / kedatangan / transit:",
  "Nama maskapai (airline) yang Anda gunakan:",
  "Nomor penerbangan & Tanggal:",
  "Rute / bandara keberangkatan – tujuan:",
  "Jenis penerbangan Anda:",
  "Tujuan perjalanan Anda:",
  ...SECTION_CATALOG.airline.flatMap((section) => section.statements.map((text, index) => `${index + 1}. ${text}`)),
  "1. Seberapa besar kemungkinan Anda merekomendasikan maskapai ini kepada keluarga/kolega/rekan bisnis?",
];
const unnumberedRow = [
  "RESP2", "RESP-2", "2026-01-02 00:00:00", "Nama Uji", "080000000000", "CGK", "Citilink", "QG456",
  "CGK-SUB", "Penerbangan langsung (direct flight)", "Bisnis / dinas",
  ...statements.map(() => "5"),
  "9",
];
const unnumberedData = parseSegment("airline", [unnumberedHeaders, unnumberedRow]);
assert.equal(unnumberedData.responses.length, 1);
assert.equal(unnumberedData.responses[0].airline, "Citilink");
assert.equal(unnumberedData.responses[0].flight, "QG456");
assert.equal(unnumberedData.responses[0].route, "CGK - SUB");
assert.equal(unnumberedData.responses[0].flightType, "Penerbangan langsung (direct flight)");
assert.equal(unnumberedData.responses[0].travelPurpose, "Bisnis / dinas");
assert.equal(unnumberedData.responses[0].nps, 9);
assert.equal(computeSurvey(unnumberedData.sections, unnumberedData.responses).overall.n, 38);

const invalidHeaders = [...unnumberedHeaders];
invalidHeaders[6] = "Maskapai:";
assert.throws(() => parseSegment("airline", [invalidHeaders, unnumberedRow]), /Kolom "Nama maskapai" tidak ditemukan/);

const unrelatedNumberedHeader = [...unnumberedHeaders];
unrelatedNumberedHeader[11] = "1. Kolom skor yang tidak dikenal";
const unrelatedData = parseSegment("airline", [unrelatedNumberedHeader, unnumberedRow]);
assert.equal(unrelatedData.sections.flatMap((section) => section.statements).length, 37);

assert.equal(categorize(4.495).status, "Memenuhi Standar KPI");
assert.equal(categorize(4.49).status, "Perlu Peningkatan / Belum Memenuhi Standar");
console.log("Airline parser dan KPI: OK");
