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
assert.equal(categorize(4.495).status, "Memenuhi Standar KPI");
assert.equal(categorize(4.49).status, "Perlu Peningkatan / Belum Memenuhi Standar");
console.log("Airline parser dan KPI: OK");
