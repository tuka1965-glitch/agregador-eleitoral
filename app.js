const PAGE_TITLE = "Pesquisas de opinião para a eleição presidencial no Brasil em 2026";
const API_URL = `https://pt.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE_TITLE)}&prop=text&format=json&origin=*`;

const COLORS = [
  "#0b6f77",
  "#c84f31",
  "#6b5b95",
  "#2e7d32",
  "#b8860b",
  "#8a2d3f",
  "#2f5597",
  "#5d6d1e",
  "#00856f",
  "#9a4f13",
];

const HOUSE_EFFECT_CORRECTION = 0.6;
const BOLSONARO_SYSTEMIC_BIAS = 2.5;
const REGIME_SHIFT_THRESHOLD = 3;
const REGIME_HALF_LIFE_DAYS = 7;
const MOMENTUM_WEIGHT = 2;
const MOMENTUM_POLL_COUNT = 5;
const VICTORY_SIMULATIONS = 100000;
const VICTORY_SIMULATION_SEED = 20260601;

const POLLSTER_RATINGS = [
  ["AtlasIntel", 2.6, 79, -0.58, "A"],
  ["Datafolha", 3.16, 190, -0.4, "B+"],
  ["Ipec (antigo Ibope)", 3.34, 1089, -0.61, "A"],
  ["Paraná Pesquisas", 3.33, 126, -0.42, "B+"],
  ["Quaest", 3.44, 31, 0.01, "B"],
  ["Real Time Big Data", 4.0, 158, 0.07, "B"],
  ["PoderData", 3.3, 9, 0.37, "B"],
  ["Ipespe", 4.22, 58, 0.17, "B"],
  ["MDA", 3.92, 29, -0.42, "B+"],
  ["FSB Pesquisa", 3.41, 10, 0.01, "B"],
  ["Futura", 3.29, 72, -0.75, "A"],
  ["Ideia Big Data", 2.89, 14, -0.16, "B+"],
  ["Brasmarket", 5.82, 15, 2.0, "D"],
  ["Ranking Pesquisa", 4.88, 56, 0.09, "B"],
  ["Veritá", 4.85, 155, 0.44, "B"],
  ["Vox Populi", 4.29, 50, 0.07, "B"],
  ["Ibrape", 5.17, 36, -0.05, "B+"],
  ["Agorasei Pesquisa", 4.92, 35, 0.22, "B"],
  ["Consult Pesquisa (RN)", 4.69, 47, 0.12, "B"],
  ["Instituto Seta", 4.77, 47, 0.24, "B"],
  ["Escutec", 5.08, 111, 0.04, "B"],
  ["Ipec", 3.34, 1089, -0.61, "A"],
  ["Ibope", 3.34, 1089, -0.61, "A"],
  ["Genial/Quaest", 3.44, 31, 0.01, "B"],
  ["Meio/Ideia", 2.89, 14, -0.16, "B+"],
];

const state = {
  polls: [],
  scenarios: [],
  selectedScenario: "",
  selectedCandidates: new Set(),
  selectedMonths: new Set(),
  selectedPollsters: new Set(),
  houseEffects: new Map(),
};

const els = {
  scenarioSelect: document.querySelector("#scenarioSelect"),
  monthSelect: document.querySelector("#monthSelect"),
  pollsterSelect: document.querySelector("#pollsterSelect"),
  candidateSelect: document.querySelector("#candidateSelect"),
  loessSpan: document.querySelector("#loessSpan"),
  loessSpanValue: document.querySelector("#loessSpanValue"),
  halfLife: document.querySelector("#halfLife"),
  halfLifeValue: document.querySelector("#halfLifeValue"),
  chart: document.querySelector("#pollChart"),
  chartTitle: document.querySelector("#chartTitle"),
  chartMeta: document.querySelector("#chartMeta"),
  status: document.querySelector("#status"),
  legend: document.querySelector("#legend"),
  bayesMeta: document.querySelector("#bayesMeta"),
  bayesRows: document.querySelector("#bayesRows"),
  probabilityMeta: document.querySelector("#probabilityMeta"),
  probabilityRows: document.querySelector("#probabilityRows"),
  probabilityBaseHeader: document.querySelector("#probabilityBaseHeader"),
  pollRows: document.querySelector("#pollRows"),
  commentaryMeta: document.querySelector("#commentaryMeta"),
  commentaryBody: document.querySelector("#commentaryBody"),
  reloadButton: document.querySelector("#reloadButton"),
  copyChartButton: document.querySelector("#copyChartButton"),
  copyChartPanelButton: document.querySelector("#copyChartPanelButton"),
  copyBayesButton: document.querySelector("#copyBayesButton"),
  copyProbabilityButton: document.querySelector("#copyProbabilityButton"),
  copyPollsButton: document.querySelector("#copyPollsButton"),
  downloadButton: document.querySelector("#downloadButton"),
  pdfButton: document.querySelector("#pdfButton"),
};

function cleanText(value) {
  return (value || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeName(value) {
  return cleanText(value)
    .replace(/\(.+?\)/g, "")
    .replace(/^[0-9]+[.,]?\s*/, "")
    .trim();
}

function normalizePollsterKey(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.+?\)/g, "")
    .replace(/\b(instituto|pesquisa|pesquisas|consultoria|dados)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

const POLLSTER_RATING_INDEX = new Map(
  POLLSTER_RATINGS.map(([name, meanError, pollsAnalyzed, score, grade]) => [
    normalizePollsterKey(name),
    { name, meanError, pollsAnalyzed, score, grade },
  ]),
);

const POLLSTER_ALIAS_INDEX = new Map(
  [
    ["Apex/Futura", "Apex/Futura"],
    ["Futura/Apex", "Apex/Futura"],
    ["Genial/Quaest", "Genial/Quaest"],
    ["Quaest/Genial", "Genial/Quaest"],
    ["CNT/MDA", "CNT/MDA"],
    ["MDA/CNT", "CNT/MDA"],
    ["Vetor/Arrow", "Vetor/Arrow"],
    ["Arrow/Vetor", "Vetor/Arrow"],
    ["Meio/Ideia", "Meio/Ideia"],
    ["Ideia/Meio", "Meio/Ideia"],
  ].map(([alias, canonical]) => [normalizePollsterKey(alias), canonical]),
);

function canonicalPollsterName(name) {
  const cleaned = cleanText(name);
  return POLLSTER_ALIAS_INDEX.get(normalizePollsterKey(cleaned)) || cleaned;
}

function pollsterRatingFor(name) {
  const key = normalizePollsterKey(name);
  if (POLLSTER_RATING_INDEX.has(key)) return POLLSTER_RATING_INDEX.get(key);
  for (const [ratingKey, rating] of POLLSTER_RATING_INDEX.entries()) {
    if (key.includes(ratingKey) || ratingKey.includes(key)) return rating;
  }
  return null;
}

function pollsterQualityWeight(name) {
  const rating = pollsterRatingFor(name);
  if (!rating) return 1;
  const errorWeight = (4 / Math.max(2, rating.meanError)) ** 2;
  const scoreWeight = Math.exp(-0.18 * rating.score);
  const sampleConfidence = Math.min(1.15, Math.max(0.75, Math.log10(rating.pollsAnalyzed + 1) / 2));
  return Math.min(2.2, Math.max(0.35, errorWeight * scoreWeight * sampleConfidence));
}

function houseEffectFor(name) {
  return state.houseEffects.get(normalizePollsterKey(canonicalPollsterName(name))) || null;
}

function houseEffectWeight(name) {
  const houseEffect = houseEffectFor(name);
  if (!houseEffect || houseEffect.n <= 2) return 1;
  return Math.min(1.1, Math.max(0.35, 1 / (1 + Math.abs(houseEffect.effect) / 4)));
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value));
}

function systemicCandidateBias(candidate) {
  if (isSpecialChoice(candidate)) return 0;
  return /bolsonaro/i.test(candidate) ? BOLSONARO_SYSTEMIC_BIAS : 0;
}

function isSpecialChoice(candidate) {
  const text = normalizeName(candidate).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /(indecis|nao sabe|nao respondeu|branco|nulo|nenhum|absten|ausente|absent)/i.test(text);
}

function isOtherChoice(candidate) {
  const text = normalizeName(candidate).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /^outros?$|outros candidatos|demais/.test(text);
}

function normalizeSpecialChoice(header) {
  const text = normalizeName(header);
  const plain = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/indecis|nao sabe|nao respondeu/i.test(plain)) return "Indecisos";
  if (/absten|ausente|absent/i.test(plain)) return "Absten\u00e7\u00e3o";
  if (/branco|nulo|nenhum/i.test(plain)) return "Brancos/nulos/nenhum";
  return text;
}

function houseAdjustedValue(value, pollster, candidate = "") {
  if (isSpecialChoice(candidate)) return value;
  const houseEffect = houseEffectFor(pollster);
  if (!houseEffect || houseEffect.n <= 2 || value < 15) return value;
  return clampPercent(value - HOUSE_EFFECT_CORRECTION * houseEffect.effect);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeHeader(parts) {
  const cleaned = parts.map(normalizeName).filter(Boolean);
  const partyOrMeta = /^(pt|pl|psb|psdb|pdt|psol|mdb|novo|psd|uni[aã]o|republicanos|sem partido|cidadania|podemos|avante|solidariedade|dc|prtb|pcb|pcdo?b|pv|rede|up)$/i;
  const generic = /(instituto|empresa|contratante|pesquisa|data|per[ií]odo|campo|amostra|entrevistados|margem|erro|imagem|foto)/i;
  const candidate = cleaned.find((part) => !partyOrMeta.test(part) && !generic.test(part) && part.length <= 26);
  return candidate || cleaned.join(" ");
}

function parseNumber(value) {
  const match = cleanText(value).match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(".", "").replace(",", ".")) : null;
}

function parsePercent(value) {
  const text = cleanText(value);
  if (!/%|\d/.test(text)) return null;
  if (/^[—–-]$/.test(text)) return null;
  const number = parseNumber(text);
  if (number == null || number > 100) return null;
  return number;
}

function parseSample(value) {
  const text = cleanText(value);
  const match = text.match(/\d[\d. ]+/);
  return match ? Number(match[0].replace(/[. ]/g, "")) : null;
}

function parseDateRange(value, fallbackYear = 2026) {
  const text = cleanText(value).toLowerCase();
  const monthMap = {
    jan: 0,
    janeiro: 0,
    fev: 1,
    fevereiro: 1,
    mar: 2,
    março: 2,
    marco: 2,
    abr: 3,
    abril: 3,
    mai: 4,
    maio: 4,
    jun: 5,
    junho: 5,
    jul: 6,
    julho: 6,
    ago: 7,
    agosto: 7,
    set: 8,
    setembro: 8,
    out: 9,
    outubro: 9,
    nov: 10,
    novembro: 10,
    dez: 11,
    dezembro: 11,
  };
  const parts = [...text.matchAll(/(\d{1,2})(?:\s*(?:a|e|-|–)\s*(\d{1,2}))?\s*(?:de\s*)?([a-zç]+)\s*(?:de\s*)?(20\d{2})?/gi)];
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const day1 = Number(last[1]);
  const day2 = Number(last[2] || last[1]);
  const month = monthMap[last[3]];
  const hasExplicitYear = Boolean(last[4]);
  let year = Number(last[4] || fallbackYear);
  if (month == null) return null;
  let start = new Date(Date.UTC(year, month, day1));
  let end = new Date(Date.UTC(year, month, day2));
  let mid = new Date((start.getTime() + end.getTime()) / 2);
  const futureTolerance = 7 * 24 * 60 * 60 * 1000;
  if (!hasExplicitYear && mid.getTime() > Date.now() + futureTolerance) {
    year -= 1;
    start = new Date(Date.UTC(year, month, day1));
    end = new Date(Date.UTC(year, month, day2));
    mid = new Date((start.getTime() + end.getTime()) / 2);
  }
  return { start, end, mid };
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function monthKey(dateText) {
  return dateText.slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

function looksLikeDateText(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return false;
  if (/^\d{1,2}(\s*(a|e|-|–)\s*\d{1,2})?\s*(de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i.test(text)) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(text);
}

function isValidPollsterName(value) {
  const text = cleanText(value);
  if (text.length < 2 || text.length > 70) return false;
  if (looksLikeDateText(text)) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(text)) return false;
  return !/(recusa|declara|anuncia|convida|desiste|lança|oficializa|presidência|república)/i.test(text);
}

function headingFromNode(node) {
  if (/^H[2-4]$/.test(node.tagName)) {
    return {
      level: Number(node.tagName.slice(1)),
      text: cleanText(node.textContent),
    };
  }
  if (node.classList?.contains("mw-heading")) {
    const heading = node.querySelector("h2,h3,h4");
    if (heading) {
      return {
        level: Number(heading.tagName.slice(1)),
        text: cleanText(heading.textContent),
      };
    }
  }
  return null;
}

function getHeadingPath(table) {
  const headings = [];
  let node = table.previousElementSibling;
  while (node) {
    const heading = headingFromNode(node);
    if (heading) {
      headings.unshift(heading.text);
      if (heading.level === 2) break;
    }
    node = node.previousElementSibling;
  }
  return headings.filter(Boolean);
}

function inferYear(headingPath) {
  const yearHeading = headingPath.findLast((heading) => /20\d{2}/.test(heading));
  return yearHeading ? Number(yearHeading.match(/20\d{2}/)[0]) : 2026;
}

function isCalendarHeading(heading) {
  return /^(20\d{2}|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)$/i.test(
    heading,
  );
}

function getScenarioBase(headingPath) {
  const round = headingPath.find((heading) => /primeiro turno|segundo turno/i.test(heading));
  return round || headingPath.find((heading) => !isCalendarHeading(heading)) || "Tabela";
}

function expandRowCells(row) {
  const cells = [...row.children].filter((cell) => ["TH", "TD"].includes(cell.tagName));
  return cells.map((cell) => ({
    text: cleanText(cell.textContent),
    colspan: Number(cell.getAttribute("colspan") || 1),
    rowspan: Number(cell.getAttribute("rowspan") || 1),
  }));
}

function buildGrid(rowElements) {
  const carry = [];
  return rowElements.map((row) => {
    const cells = expandRowCells(row);
    const values = [];
    let col = 0;

    function fillCarry() {
      while (carry[col]) {
        values[col] = carry[col].text;
        carry[col].remaining -= 1;
        if (carry[col].remaining <= 0) delete carry[col];
        col += 1;
      }
    }

    cells.forEach((cell) => {
      fillCarry();
      for (let i = 0; i < cell.colspan; i += 1) {
        values[col + i] = cell.text;
        if (cell.rowspan > 1) {
          carry[col + i] = { text: cell.text, remaining: cell.rowspan - 1 };
        }
      }
      col += cell.colspan;
    });
    fillCarry();
    return values;
  });
}

function extractHeaders(headerRows) {
  const matrix = buildGrid(headerRows);
  const width = Math.max(0, ...matrix.map((row) => row.length));
  const headers = Array.from({ length: width }, () => []);
  matrix.forEach((row) => {
    row.forEach((text, col) => {
      if (text && !headers[col].includes(text)) headers[col].push(text);
    });
  });
  return headers.map((parts) => normalizeHeader(parts));
}

function classifyColumns(headers) {
  const columns = {
    pollster: -1,
    date: -1,
    sample: -1,
    margin: -1,
    candidates: [],
  };
  headers.forEach((header, index) => {
    const lower = header.toLowerCase();
    if (columns.pollster < 0 && /(instituto|empresa|pesquisa|realizador)/.test(lower)) columns.pollster = index;
    if (columns.date < 0 && /(data|período|periodo|campo)/.test(lower)) columns.date = index;
    if (columns.sample < 0 && /(amostra|entrevistados)/.test(lower)) columns.sample = index;
    if (columns.margin < 0 && /(margem|erro)/.test(lower)) columns.margin = index;
  });

  const blocked = new Set([columns.pollster, columns.date, columns.sample, columns.margin]);
  const blockedWords = /(instituto|empresa|data|período|periodo|campo|amostra|entrevistados|margem|erro|vantagem|fonte|ref)/i;
  headers.forEach((header, index) => {
    if (blocked.has(index) || !header || blockedWords.test(header)) return;
    if (header.length > 32) return;
    columns.candidates.push({ index, name: normalizeSpecialChoice(header) });
  });
  return columns;
}

function parseTables(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = [...doc.querySelectorAll("table.wikitable")];
  const rows = [];
  const carry = {};

  tables.forEach((table) => {
    const tableRows = [...table.querySelectorAll("tr")];
    const headerRows = [];
    const dataRows = [];
    let inBody = false;
    tableRows.forEach((row) => {
      const hasData = row.querySelector("td");
      if (!inBody && !hasData) headerRows.push(row);
      else {
        inBody = true;
        dataRows.push(row);
      }
    });

    const headers = extractHeaders(headerRows);
    const columns = classifyColumns(headers);
    if (columns.date < 0 || columns.candidates.length < 2) return;

    const headingPath = getHeadingPath(table);
    const round = headingPath.find((h) => /primeiro turno|segundo turno/i.test(h)) || headingPath[0] || "Tabela";
    const baseScenario = getScenarioBase(headingPath);
    const tableYear = inferYear(headingPath);
    const bodyRows = buildGrid(dataRows);
    const tableRecords = [];

    bodyRows.forEach((cellTexts) => {
      if (cellTexts.length < 4) return;

      const pollster = canonicalPollsterName(cleanText(cellTexts[columns.pollster]) || carry[baseScenario]?.pollster);
      const dateInfo = parseDateRange(cellTexts[columns.date] || "", tableYear);
      if (!pollster || !isValidPollsterName(pollster) || !dateInfo) return;

      carry[baseScenario] = { pollster };
      tableRecords.push({
        cellTexts,
        pollster,
        dateInfo,
        dateStart: dateKey(dateInfo.start),
        dateEnd: dateKey(dateInfo.end),
        dateMid: dateKey(dateInfo.mid),
        sample: parseSample(cellTexts[columns.sample] || ""),
        margin: parseNumber(cellTexts[columns.margin] || ""),
      });
    });

    const samePollGroups = groupBy(tableRecords, (record) =>
      [baseScenario, record.pollster.toLowerCase(), record.dateStart, record.dateEnd].join("|"),
    );
    const scenarioCounts = new Map();

    tableRecords.forEach((record) => {
      const pollKey = [baseScenario, record.pollster.toLowerCase(), record.dateStart, record.dateEnd].join("|");
      const group = samePollGroups.get(pollKey) || [];
      const scenarioIndex = (scenarioCounts.get(pollKey) || 0) + 1;
      scenarioCounts.set(pollKey, scenarioIndex);
      const scenario = baseScenario;
      const scenarioVariant = group.length > 1 ? `Cenário ${scenarioIndex}` : "";
      const pollId = `${record.pollster} | ${record.dateStart} a ${record.dateEnd}`;

      const { cellTexts, dateInfo, pollster, sample, margin } = record;
      columns.candidates.forEach(({ index, name }) => {
        const percent = parsePercent(cellTexts[index]);
        if (percent == null) return;
        rows.push({
          round,
          scenario,
          baseScenario,
          scenarioIndex,
          scenarioVariant,
          pollId,
          pollster,
          dateStart: record.dateStart,
          dateEnd: record.dateEnd,
          dateMid: record.dateMid,
          month: monthKey(record.dateMid),
          t: dateInfo.mid.getTime(),
          sample,
          margin,
          candidate: name,
          pct: percent,
        });
      });
    });
  });

  return rows.sort((a, b) => a.t - b.t);
}

function groupBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function tricube(x) {
  const v = Math.max(0, 1 - Math.abs(x) ** 3);
  return v ** 3;
}

function loess(points, span) {
  if (points.length < 3) return points.map((point) => ({ x: point.x, y: point.y }));
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const k = Math.max(3, Math.ceil(sorted.length * span));
  return sorted.map((target) => {
    const distances = sorted.map((point) => Math.abs(point.x - target.x)).sort((a, b) => a - b);
    const bandwidth = distances[k - 1] || distances[distances.length - 1] || 1;
    let sw = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    sorted.forEach((point) => {
      const w = tricube((point.x - target.x) / bandwidth) * (point.weight || 1);
      sw += w;
      sx += w * point.x;
      sy += w * point.y;
      sxx += w * point.x * point.x;
      sxy += w * point.x * point.y;
    });
    const denom = sw * sxx - sx * sx;
    const beta = Math.abs(denom) < 1e-9 ? 0 : (sw * sxy - sx * sy) / denom;
    const alpha = sw ? (sy - beta * sx) / sw : target.y;
    return { x: target.x, y: alpha + beta * target.x };
  });
}

function bayesianCurve(points, halfLifeDays, candidate = "") {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const priorMean = sorted.reduce((sum, point) => sum + point.y, 0) / sorted.length;
  const priorWeight = 2500;
  const dayMs = 24 * 60 * 60 * 1000;
  return sorted.map((target) => {
    let weightSum = priorWeight;
    let valueSum = priorMean * priorWeight;
    sorted.forEach((point) => {
      const ageDays = Math.abs(target.x - point.x) / dayMs;
      const timeWeight = 0.5 ** (ageDays / halfLifeDays);
      const sampleWeight = Math.max(300, point.sample || 1000);
      const marginWeight = point.margin ? 1 / Math.max(0.0001, point.margin * point.margin) : 1;
      const qualityWeight = point.pollster ? pollsterQualityWeight(point.pollster) : 1;
      const houseWeight = point.pollster && !isSpecialChoice(candidate) ? houseEffectWeight(point.pollster) : 1;
      const momentumWeight = point.isRecent ? MOMENTUM_WEIGHT : 1;
      const w = sampleWeight * marginWeight * timeWeight * qualityWeight * houseWeight * momentumWeight;
      const adjustedY = houseAdjustedValue(point.y, point.pollster, candidate);
      weightSum += w;
      valueSum += adjustedY * w;
    });
    return { x: target.x, y: clampPercent(valueSum / weightSum + systemicCandidateBias(candidate)) };
  });
}

function bayesianEstimateAt(points, allCandidatePoints, targetTime, halfLifeDays, candidate = "") {
  if (!points.length) return null;
  const priorSource = allCandidatePoints.length ? allCandidatePoints : points;
  const priorMean = priorSource.reduce((sum, point) => sum + point.pct, 0) / priorSource.length;
  const priorWeight = 2500;
  const dayMs = 24 * 60 * 60 * 1000;
  let weightSum = priorWeight;
  let valueSum = priorMean * priorWeight;

  points.forEach((point) => {
    const ageDays = Math.max(0, (targetTime - point.t) / dayMs);
    const timeWeight = 0.5 ** (ageDays / halfLifeDays);
    const sampleWeight = Math.max(300, point.sample || 1000);
    const marginWeight = point.margin ? 1 / Math.max(0.0001, point.margin * point.margin) : 1;
    const weight =
      sampleWeight *
      marginWeight *
      timeWeight *
      pollsterQualityWeight(point.pollster) *
      (isSpecialChoice(candidate) ? 1 : houseEffectWeight(point.pollster)) *
      (point.isRecent ? MOMENTUM_WEIGHT : 1);
    const adjustedPct = houseAdjustedValue(point.pct, point.pollster, candidate);
    weightSum += weight;
    valueSum += adjustedPct * weight;
  });

  return clampPercent(valueSum / weightSum + systemicCandidateBias(candidate));
}

function pollUnitsFromRows(rows, scenario) {
  const units = new Map();
  rows
    .filter((poll) => poll.scenario === scenario)
    .forEach((poll) => {
      const key = [poll.scenario, poll.pollId, poll.scenarioIndex || 1].join("|");
      if (!units.has(key)) {
        units.set(key, {
          key,
          scenario: poll.scenario,
          pollster: poll.pollster,
          dateMid: poll.dateMid,
          t: poll.t,
          sample: poll.sample,
          margin: poll.margin,
          candidates: {},
        });
      }
      units.get(key).candidates[poll.candidate] = poll.pct;
    });
  return [...units.values()].sort((a, b) => a.t - b.t);
}

function regimeStrengthFromRows(rows, scenario, candidates) {
  const units = pollUnitsFromRows(rows, scenario);
  const recent = units.slice(-MOMENTUM_POLL_COUNT);
  const prior = units.slice(-MOMENTUM_POLL_COUNT * 2, -MOMENTUM_POLL_COUNT);
  if (recent.length < MOMENTUM_POLL_COUNT || prior.length < MOMENTUM_POLL_COUNT) return 0;
  return Math.max(
    ...candidates.map((candidate) => {
      const recentValues = recent.map((unit) => unit.candidates[candidate]).filter((value) => value != null);
      const priorValues = prior.map((unit) => unit.candidates[candidate]).filter((value) => value != null);
      if (!recentValues.length || !priorValues.length) return 0;
      return Math.abs(mean(recentValues) - mean(priorValues));
    }),
  );
}

function effectiveHalfLife(rows, scenario, candidates, configuredHalfLife) {
  return regimeStrengthFromRows(rows, scenario, candidates) >= REGIME_SHIFT_THRESHOLD
    ? Math.min(configuredHalfLife, REGIME_HALF_LIFE_DAYS)
    : configuredHalfLife;
}

function recentPollTimes(rows, scenario) {
  return new Set(
    pollUnitsFromRows(rows, scenario)
      .slice(-MOMENTUM_POLL_COUNT)
      .map((unit) => unit.t),
  );
}

function bayesianMeanFromUnits(units, candidate) {
  const values = units.map((unit) => unit.candidates[candidate]).filter((value) => value != null);
  if (!values.length) return null;
  const priorMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let weightSum = 2500;
  let valueSum = priorMean * weightSum;
  units.forEach((unit) => {
    const value = unit.candidates[candidate];
    if (value == null) return;
    const sampleWeight = Math.max(300, unit.sample || 1000);
    const marginWeight = unit.margin ? 1 / Math.max(0.0001, unit.margin * unit.margin) : 1;
    const qualityWeight = pollsterQualityWeight(unit.pollster);
    const weight = sampleWeight * marginWeight * qualityWeight;
    weightSum += weight;
    valueSum += value * weight;
  });
  return valueSum / weightSum;
}

function referenceLeaderFromLast10(previousUnits) {
  const windowUnits = previousUnits.slice(-10);
  const candidates = [...new Set(windowUnits.flatMap((unit) => Object.keys(unit.candidates)))];
  return candidates
    .map((candidate) => ({ candidate, estimate: bayesianMeanFromUnits(windowUnits, candidate) }))
    .filter((row) => row.estimate != null)
    .sort((a, b) => b.estimate - a.estimate)[0];
}

function computeHouseEffects(rows) {
  const effects = [];
  const scenarios = [...new Set(rows.map((poll) => poll.scenario))];
  scenarios.forEach((scenario) => {
    const units = pollUnitsFromRows(rows, scenario);
    units.forEach((unit, index) => {
      const reference = referenceLeaderFromLast10(units.slice(0, index));
      if (!reference) return;
      const instituteValue = unit.candidates[reference.candidate];
      if (instituteValue == null) return;
      effects.push({
        pollster: unit.pollster,
        scenario,
        effect: instituteValue - reference.estimate,
        abs: Math.abs(instituteValue - reference.estimate),
      });
    });
  });

  const grouped = groupBy(effects, (effect) => normalizePollsterKey(canonicalPollsterName(effect.pollster)));
  return new Map(
    [...grouped.entries()].map(([key, items]) => [
      key,
      {
        n: items.length,
        effect: items.reduce((sum, item) => sum + item.effect, 0) / items.length,
        abs: items.reduce((sum, item) => sum + item.abs, 0) / items.length,
      },
    ]),
  );
}

function selectedPolls() {
  return state.polls.filter(
    (poll) =>
      poll.scenario === state.selectedScenario &&
      state.selectedCandidates.has(poll.candidate) &&
      state.selectedMonths.has(poll.month) &&
      state.selectedPollsters.has(poll.pollster),
  );
}

function selectedPollsForExport() {
  return state.polls.filter(
    (poll) =>
      poll.scenario === state.selectedScenario &&
      state.selectedMonths.has(poll.month) &&
      state.selectedPollsters.has(poll.pollster),
  );
}

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const polls = selectedPolls();
  if (!polls.length) {
    ctx.fillStyle = "#65726c";
    ctx.font = "15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Nenhuma pesquisa para os filtros selecionados.", w / 2, h / 2);
    els.legend.innerHTML = "";
    return;
  }
  const padding = { left: 54, right: 18, top: 18, bottom: 44 };
  const xMin = Math.min(...polls.map((p) => p.t));
  const xMax = Math.max(...polls.map((p) => p.t));
  const yMax = Math.min(100, Math.ceil((Math.max(...polls.map((p) => p.pct)) + 8) / 5) * 5);
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const xScale = (x) => padding.left + ((x - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const yScale = (y) => padding.top + (1 - y / yMax) * plotH;

  ctx.strokeStyle = "#e2e7de";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#65726c";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = 0; y <= yMax; y += 5) {
    const py = yScale(y);
    ctx.beginPath();
    ctx.moveTo(padding.left, py);
    ctx.lineTo(w - padding.right, py);
    ctx.stroke();
    ctx.fillText(`${y}%`, padding.left - 8, py);
  }

  const dates = [...new Set(polls.map((p) => p.dateMid))].slice(0, 8);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  dates.forEach((date) => {
    const x = xScale(new Date(`${date}T00:00:00Z`).getTime());
    ctx.fillText(date.slice(5), x, h - padding.bottom + 14);
  });

  const byCandidate = groupBy(polls, (poll) => poll.candidate);
  const activeCandidates = [...byCandidate.keys()];
  const adaptiveHalfLife = effectiveHalfLife(polls, state.selectedScenario, activeCandidates, Number(els.halfLife.value));
  const latestTimes = recentPollTimes(polls, state.selectedScenario);
  els.legend.innerHTML = "";
  [...byCandidate.entries()].forEach(([candidate, candidatePolls], idx) => {
    const color = COLORS[idx % COLORS.length];
    const points = candidatePolls.map((poll) => ({
      x: poll.t,
      y: poll.pct,
      sample: poll.sample,
      margin: poll.margin,
      pollster: poll.pollster,
      weight: Math.max(300, poll.sample || 1000),
      isRecent: latestTimes.has(poll.t),
    }));
    const loessPoints = loess(points, Number(els.loessSpan.value));
    const bayesPoints = bayesianCurve(points, adaptiveHalfLife, candidate);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    loessPoints.forEach((point, pointIdx) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      if (pointIdx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    bayesPoints.forEach((point, pointIdx) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      if (pointIdx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(xScale(point.x), yScale(point.y), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const legendItem = document.createElement("span");
    legendItem.className = "legendItem";
    legendItem.innerHTML = `<span class="swatch" style="background:${color}"></span>${candidate}`;
    els.legend.appendChild(legendItem);
  });

  ctx.fillStyle = "#65726c";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("Linha cheia: LOESS · tracejada: bayesiana ponderada por tempo, n e margem", padding.left, h - 8);
}

function renderTable() {
  const polls = selectedPolls().slice().sort((a, b) => b.t - a.t).slice(0, 220);
  els.pollRows.innerHTML = polls
    .map(
      (poll) => `<tr>
        <td>${poll.dateMid}</td>
        <td>${poll.pollster}</td>
        <td>${poll.candidate}</td>
        <td>${poll.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
        <td>${poll.sample || ""}</td>
        <td>${poll.scenarioVariant || poll.scenario}</td>
      </tr>`,
    )
    .join("");
}

function bayesianSummaryData() {
  const polls = selectedPolls();
  const halfLifeDays = Number(els.halfLife.value);
  if (!polls.length) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const latestTime = Math.max(...polls.map((poll) => poll.t));
  const windowStart = latestTime - halfLifeDays * dayMs;
  const windowPolls = polls.filter((poll) => poll.t >= windowStart && poll.t <= latestTime);
  const adaptiveHalfLife = effectiveHalfLife(windowPolls, state.selectedScenario, [...state.selectedCandidates], halfLifeDays);
  const latestTimes = recentPollTimes(windowPolls, state.selectedScenario);
  const byCandidate = groupBy(windowPolls, (poll) => poll.candidate);
  const allByCandidate = groupBy(polls, (poll) => poll.candidate);

  const rows = [...state.selectedCandidates]
    .map((candidate) => {
      const candidateWindowPolls = byCandidate.get(candidate) || [];
      const candidateAllPolls = allByCandidate.get(candidate) || [];
      const candidateWindowPoints = candidateWindowPolls.map((poll) => ({ ...poll, isRecent: latestTimes.has(poll.t) }));
      const estimate = bayesianEstimateAt(candidateWindowPoints, candidateAllPolls, latestTime, adaptiveHalfLife, candidate);
      if (estimate == null) return null;
      const dates = candidateWindowPolls.map((poll) => poll.t);
      return {
        candidate,
        estimate,
        observations: candidateWindowPolls.length,
        pollsters: new Set(candidateWindowPolls.map((poll) => poll.pollster)).size,
        ratedPollsters: new Set(candidateWindowPolls.filter((poll) => pollsterRatingFor(poll.pollster)).map((poll) => poll.pollster))
          .size,
        start: dateKey(new Date(Math.min(...dates))),
        end: dateKey(new Date(Math.max(...dates))),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.estimate - a.estimate);

  const houseAdjustedPollsters = new Set(
    windowPolls.filter((poll) => {
      const houseEffect = houseEffectFor(poll.pollster);
      return houseEffect && houseEffect.n > 2;
    }).map((poll) => poll.pollster),
  ).size;

  return {
    polls,
    halfLifeDays,
    latestTime,
    windowStart,
    windowPolls,
    adaptiveHalfLife,
    rows,
    houseAdjustedPollsters,
  };
}

function renderBayesianSummary() {
  const summary = bayesianSummaryData();
  if (!summary) {
    els.bayesMeta.textContent = "Sem dados para os filtros atuais.";
    els.bayesRows.innerHTML = "";
    return;
  }

  const { halfLifeDays, latestTime, adaptiveHalfLife, houseAdjustedPollsters, rows } = summary;
  els.bayesMeta.textContent = `Janela configurada: ${halfLifeDays} dias até ${dateKey(new Date(latestTime))}. Meia-vida efetiva: ${adaptiveHalfLife} dias. Ponderação por recência, n, margem de erro, rating histórico, momentum das últimas ${MOMENTUM_POLL_COUNT} pesquisas, correção parcial de house effect com n > 2 (${houseAdjustedPollsters} institutos) e ajuste sistêmico Bolsonaro de +${BOLSONARO_SYSTEMIC_BIAS.toLocaleString("pt-BR")} pp.`;
  els.bayesRows.innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.candidate)}</td>
        <td>${row.estimate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
        <td>${row.observations}</td>
        <td>${row.pollsters}</td>
        <td>${row.ratedPollsters}</td>
        <td>${row.start} a ${row.end}</td>
      </tr>`,
    )
    .join("");
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random) {
  const u1 = Math.max(Number.EPSILON, random());
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function simulationSd(candidate, summary) {
  const candidatePolls = summary.windowPolls.filter((poll) => poll.candidate === candidate);
  if (!candidatePolls.length) return 4;
  const margins = candidatePolls.map((poll) => poll.margin).filter((value) => value != null && value > 0);
  const avgMargin = margins.length ? mean(margins) : 3;
  const totalSample = candidatePolls.reduce((sum, poll) => sum + Math.max(300, poll.sample || 1000), 0);
  const p = (summary.rows.find((row) => row.candidate === candidate)?.estimate || 0) / 100;
  const samplingSd = Math.sqrt(Math.max(0.0001, p * (1 - p)) / Math.max(300, totalSample)) * 100;
  return Math.min(8, Math.max(1.2, avgMargin / Math.sqrt(candidatePolls.length), samplingSd * 2));
}

function percentText(value) {
  if (value == null || Number.isNaN(value)) return "sem dados";
  if (value > 0 && value < 0.05) return "<0,1%";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function pairKey(a, b) {
  return [a, b].sort((x, y) => x.localeCompare(y, "pt-BR")).join("|");
}

function secondRoundRowsFor(candidateA, candidateB, scenario = null) {
  const candidateSet = new Set([candidateA, candidateB]);
  const secondRoundPolls = state.polls.filter(
    (poll) =>
      /segundo turno/i.test(poll.round || poll.scenario) &&
      (!scenario || poll.scenario === scenario) &&
      state.selectedMonths.has(poll.month) &&
      state.selectedPollsters.has(poll.pollster) &&
      candidateSet.has(poll.candidate),
  );
  const units = [...groupBy(secondRoundPolls, (poll) => [poll.scenario, poll.pollId, poll.scenarioIndex || 1].join("|")).values()]
    .map((polls) => ({
      pollster: polls[0].pollster,
      dateMid: polls[0].dateMid,
      t: polls[0].t,
      sample: polls[0].sample,
      margin: polls[0].margin,
      candidates: Object.fromEntries(polls.map((poll) => [poll.candidate, poll.pct])),
    }))
    .filter((unit) => unit.candidates[candidateA] != null && unit.candidates[candidateB] != null);
  return units.map((unit) => {
    const a = unit.candidates[candidateA];
    const b = unit.candidates[candidateB];
    return {
      candidate: candidateA,
      pollster: unit.pollster,
      t: unit.t,
      dateMid: unit.dateMid,
      sample: unit.sample,
      margin: unit.margin,
      pct: (a / Math.max(0.0001, a + b)) * 100,
    };
  });
}

function secondRoundWinProbability(candidate, opponent, scenario = null) {
  const pairRows = secondRoundRowsFor(candidate, opponent, scenario);
  if (!pairRows.length) return null;
  const latestTime = Math.max(...pairRows.map((poll) => poll.t));
  const halfLifeDays = Number(els.halfLife.value);
  const latestTimes = recentPollTimes(pairRows.map((poll) => ({ ...poll, scenario: "Segundo turno", pollId: `${poll.pollster}|${poll.dateMid}` })), "Segundo turno");
  const estimate = bayesianEstimateAt(
    pairRows.map((poll) => ({ ...poll, isRecent: latestTimes.has(poll.t) })),
    pairRows,
    latestTime,
    halfLifeDays,
    candidate,
  );
  const margins = pairRows.map((poll) => poll.margin).filter((value) => value != null && value > 0);
  const avgMargin = margins.length ? mean(margins) : 3;
  const sd = Math.min(8, Math.max(1.4, avgMargin / Math.sqrt(pairRows.length)));
  const random = seededRandom(VICTORY_SIMULATION_SEED + candidate.length * 31 + opponent.length * 17 + (scenario || "").length);
  let wins = 0;
  for (let i = 0; i < VICTORY_SIMULATIONS; i += 1) {
    if (estimate + normalRandom(random) * sd > 50) wins += 1;
  }
  return wins / VICTORY_SIMULATIONS;
}

function probabilityRowHtml(row) {
  const firstRound = row.firstRoundWin === "na" ? "—" : percentText(row.firstRoundWin == null ? null : row.firstRoundWin * 100);
  const runoff = row.runoff === "na" ? "—" : percentText(row.runoff == null ? null : row.runoff * 100);
  const secondRound =
    row.secondRoundWin === "na" ? "—" : percentText(row.secondRoundWin == null ? null : row.secondRoundWin * 100);
  return `<tr>
        <td>${escapeHtml(row.candidate)}</td>
        <td>${firstRound}</td>
        <td>${runoff}</td>
        <td>${secondRound}</td>
        <td>${row.estimate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
      </tr>`;
}

function currentSecondRoundOpponentWeights(candidate) {
  const scenarioPolls = state.polls.filter(
    (poll) =>
      poll.scenario === state.selectedScenario &&
      /segundo turno/i.test(poll.round || poll.scenario) &&
      state.selectedMonths.has(poll.month) &&
      state.selectedPollsters.has(poll.pollster) &&
      !isSpecialChoice(poll.candidate) &&
      !isOtherChoice(poll.candidate),
  );
  const weights = new Map();
  [...groupBy(scenarioPolls, (poll) => [poll.pollId, poll.scenarioIndex || 1].join("|")).values()].forEach((polls) => {
    const names = [...new Set(polls.map((poll) => poll.candidate))];
    if (!names.includes(candidate)) return;
    names
      .filter((name) => name !== candidate)
      .forEach((opponent) => weights.set(opponent, (weights.get(opponent) || 0) + 1));
  });
  return weights;
}

function renderFirstRoundVictoryProbabilities(summary, validRows, displayRows) {
  if (displayRows.length < 2 || validRows.length < 2) {
    els.probabilityMeta.textContent = "São necessários ao menos dois candidatos com votos válidos para simular.";
    els.probabilityRows.innerHTML = "";
    return;
  }

  const random = seededRandom(VICTORY_SIMULATION_SEED);
  const candidates = validRows.map((row) => ({
    candidate: row.candidate,
    mean: row.estimate,
    sd: simulationSd(row.candidate, summary),
  }));
  const displaySet = new Set(displayRows.map((row) => row.candidate));
  const stats = new Map(displayRows.map((row) => [row.candidate, { firstRoundWins: 0, runoff: 0, opponents: new Map() }]));

  for (let i = 0; i < VICTORY_SIMULATIONS; i += 1) {
    const draw = candidates.map((row) => ({
      candidate: row.candidate,
      value: Math.max(0, row.mean + normalRandom(random) * row.sd),
    }));
    const total = draw.reduce((sum, row) => sum + row.value, 0) || 1;
    const validShares = draw
      .map((row) => ({ candidate: row.candidate, share: (row.value / total) * 100 }))
      .sort((a, b) => b.share - a.share);
    const leader = validShares[0];
    const runnerUp = validShares[1];

    if (leader.share > 50 && displaySet.has(leader.candidate)) {
      stats.get(leader.candidate).firstRoundWins += 1;
    }
    [leader, runnerUp].forEach((row) => {
      if (!displaySet.has(row.candidate)) return;
      const candidateStats = stats.get(row.candidate);
      const opponent = row.candidate === leader.candidate ? runnerUp.candidate : leader.candidate;
      candidateStats.runoff += 1;
      candidateStats.opponents.set(opponent, (candidateStats.opponents.get(opponent) || 0) + 1);
    });
  }

  const pairProbabilities = new Map();
  const rows = displayRows.map((row) => {
    const candidateStats = stats.get(row.candidate);
    let weightedSecondRound = null;
    if (candidateStats.runoff) {
      let knownOpponentRuns = 0;
      let winProbabilitySum = 0;
      candidateStats.opponents.forEach((count, opponent) => {
        const key = `${row.candidate}|${opponent}`;
        if (!pairProbabilities.has(key)) {
          pairProbabilities.set(key, secondRoundWinProbability(row.candidate, opponent));
        }
        const probability = pairProbabilities.get(key);
        if (probability == null) return;
        knownOpponentRuns += count;
        winProbabilitySum += probability * count;
      });
      weightedSecondRound = knownOpponentRuns ? winProbabilitySum / knownOpponentRuns : null;
    }
    return {
      candidate: row.candidate,
      estimate: row.estimate,
      firstRoundWin: stats.get(row.candidate).firstRoundWins / VICTORY_SIMULATIONS,
      runoff: stats.get(row.candidate).runoff / VICTORY_SIMULATIONS,
      secondRoundWin: weightedSecondRound,
    };
  });

  els.probabilityMeta.textContent =
    `${VICTORY_SIMULATIONS.toLocaleString("pt-BR")} simulações. Cálculo sobre votos válidos: indecisos, brancos/nulos e abstenção ficam fora; Outros permanece no denominador quando selecionado.`;
  els.probabilityRows.innerHTML = rows.map(probabilityRowHtml).join("");
}

function renderSecondRoundVictoryProbabilities(summary, displayRows) {
  if (displayRows.length < 2) {
    els.probabilityMeta.textContent = "São necessários ao menos dois candidatos com votos válidos para simular o segundo turno.";
    els.probabilityRows.innerHTML = "";
    return;
  }

  const pairProbabilities = new Map();
  const rows = displayRows.map((row) => {
    const opponentWeights = currentSecondRoundOpponentWeights(row.candidate);
    let knownOpponentRuns = 0;
    let winProbabilitySum = 0;
    opponentWeights.forEach((count, opponent) => {
      const key = `${row.candidate}|${opponent}|${state.selectedScenario}`;
      if (!pairProbabilities.has(key)) {
        pairProbabilities.set(key, secondRoundWinProbability(row.candidate, opponent, state.selectedScenario));
      }
      const probability = pairProbabilities.get(key);
      if (probability == null) return;
      knownOpponentRuns += count;
      winProbabilitySum += probability * count;
    });
    return {
      candidate: row.candidate,
      estimate: row.estimate,
      firstRoundWin: "na",
      runoff: "na",
      secondRoundWin: knownOpponentRuns ? winProbabilitySum / knownOpponentRuns : null,
    };
  });

  els.probabilityMeta.textContent =
    `${VICTORY_SIMULATIONS.toLocaleString("pt-BR")} simulações de segundo turno, usando os confrontos diretos disponíveis nos filtros atuais.`;
  els.probabilityRows.innerHTML = rows.map(probabilityRowHtml).join("");
}

function renderVictoryProbabilities() {
  const summary = bayesianSummaryData();
  if (!summary) {
    els.probabilityMeta.textContent = "Sem dados para estimar probabilidades.";
    els.probabilityRows.innerHTML = "";
    return;
  }

  const validRows = summary.rows.filter((row) => !isSpecialChoice(row.candidate));
  const displayRows = validRows.filter((row) => !isOtherChoice(row.candidate)).slice(0, 6);
  const isFirstRound = /primeiro turno/i.test(state.selectedScenario);
  const isSecondRound = /segundo turno/i.test(state.selectedScenario);
  els.probabilityBaseHeader.textContent = isSecondRound ? "Base 2º turno" : "Base 1º turno";

  if (isFirstRound) {
    renderFirstRoundVictoryProbabilities(summary, validRows, displayRows);
    return;
  }
  if (isSecondRound) {
    renderSecondRoundVictoryProbabilities(summary, displayRows);
    return;
  }

  els.probabilityMeta.textContent = "Selecione um cenário de primeiro ou segundo turno para estimar probabilidades.";
  els.probabilityRows.innerHTML = "";
}

function modelSnapshotAt(rows, candidates, targetTime, configuredHalfLife, windowDays = null) {
  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = windowDays == null ? -Infinity : targetTime - windowDays * dayMs;
  const usable = rows.filter((poll) => poll.t <= targetTime && poll.t >= windowStart);
  if (!usable.length) return [];
  const adaptiveHalfLife = effectiveHalfLife(usable, state.selectedScenario, candidates, configuredHalfLife);
  const latestTimes = recentPollTimes(usable, state.selectedScenario);
  const byCandidate = groupBy(usable, (poll) => poll.candidate);
  const allByCandidate = groupBy(rows.filter((poll) => poll.t <= targetTime), (poll) => poll.candidate);
  return candidates
    .map((candidate) => {
      const candidatePolls = byCandidate.get(candidate) || [];
      const allCandidatePolls = allByCandidate.get(candidate) || [];
      if (!candidatePolls.length) return null;
      return {
        candidate,
        estimate: bayesianEstimateAt(
          candidatePolls.map((poll) => ({ ...poll, isRecent: latestTimes.has(poll.t) })),
          allCandidatePolls,
          targetTime,
          adaptiveHalfLife,
          candidate,
        ),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.estimate - a.estimate);
}

function pointsLabel(value) {
  const abs = Math.abs(value);
  return `${abs.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${abs === 1 ? "ponto" : "pontos"}`;
}

function directionText(value) {
  if (Math.abs(value) < 0.15) return "ficou praticamente estável";
  return value > 0 ? `subiu ${pointsLabel(value)}` : `caiu ${pointsLabel(value)}`;
}

function renderCommentary() {
  const summary = bayesianSummaryData();
  if (!summary || summary.rows.length < 2) {
    els.commentaryMeta.textContent = "Selecione ao menos dois itens com dados na tabela bayesiana para gerar um comentário.";
    els.commentaryBody.innerHTML = "";
    return;
  }

  const { polls, halfLifeDays, latestTime, adaptiveHalfLife, windowPolls } = summary;
  const current = summary.rows;
  const candidates = current.map((row) => row.candidate);
  const previous14 = modelSnapshotAt(polls, candidates, latestTime - 14 * 86400000, halfLifeDays, halfLifeDays);
  const previous30 = modelSnapshotAt(polls, candidates, latestTime - 30 * 86400000, halfLifeDays, halfLifeDays);

  const prev14Map = new Map(previous14.map((row) => [row.candidate, row.estimate]));
  const prev30Map = new Map(previous30.map((row) => [row.candidate, row.estimate]));
  const leader = current[0];
  const runnerUp = current[1];
  const currentMargin = leader.estimate - runnerUp.estimate;
  const prev30Leader = prev30Map.get(leader.candidate);
  const prev30Runner = prev30Map.get(runnerUp.candidate);
  const prev30Margin = prev30Leader != null && prev30Runner != null ? prev30Leader - prev30Runner : null;
  const monthMovers = current
    .map((row) => ({ ...row, change30: row.estimate - (prev30Map.get(row.candidate) ?? row.estimate) }))
    .sort((a, b) => b.change30 - a.change30);
  const biggestGain = monthMovers[0];
  const biggestLoss = monthMovers.at(-1);
  const comparisonAvailable = previous30.length >= 2;

  const paragraphs = [];
  paragraphs.push(
    `Na tabela bayesiana exibida para ${state.selectedScenario.toLowerCase()}, ${leader.candidate} aparece com ${leader.estimate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% e ${runnerUp.candidate} com ${runnerUp.estimate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%. ` +
      `A vantagem atual é de ${pointsLabel(currentMargin)}${prev30Margin == null ? "." : `; há 30 dias, com os mesmos filtros e janela bayesiana, ela era de ${pointsLabel(prev30Margin)}.`}`,
  );

  if (current.length > 2) {
    if (comparisonAvailable) {
      paragraphs.push(
        `Dentro dos parâmetros selecionados, ${leader.candidate} ${directionText(leader.estimate - (prev30Map.get(leader.candidate) ?? leader.estimate))}, enquanto ${runnerUp.candidate} ${directionText(runnerUp.estimate - (prev30Map.get(runnerUp.candidate) ?? runnerUp.estimate))} em relação ao retrato de 30 dias atrás. ` +
          `${biggestGain.candidate} foi quem mais ganhou terreno nessa comparação (${directionText(biggestGain.change30)}), e ${biggestLoss.candidate} teve o movimento mais fraco (${directionText(biggestLoss.change30)}).`,
      );
    } else {
      paragraphs.push(
        "Como a seleção atual não tem observações suficientes para reconstruir uma comparação confiável de 30 dias, o comentário se limita ao retrato da tabela bayesiana exibida agora.",
      );
    }
    paragraphs.push(
      `A leitura do modelo, portanto, deve ser tomada como uma interpretação da própria tabela: ${currentMargin < 1 ? "a disputa principal está praticamente empatada" : `${leader.candidate} lidera entre os itens selecionados`}. ` +
        `Foram usadas ${windowPolls.length} observações candidato-pesquisa na janela efetiva da tabela, com meia-vida efetiva de ${adaptiveHalfLife} dias.`,
    );
  } else {
    const leader14 = prev14Map.get(leader.candidate);
    const runner14 = prev14Map.get(runnerUp.candidate);
    const margin14 = leader14 != null && runner14 != null ? leader14 - runner14 : null;
    if (comparisonAvailable) {
      paragraphs.push(
        `Em relação a 30 dias atrás, ${leader.candidate} ${directionText(leader.estimate - (prev30Map.get(leader.candidate) ?? leader.estimate))}, e ${runnerUp.candidate} ${directionText(runnerUp.estimate - (prev30Map.get(runnerUp.candidate) ?? runnerUp.estimate))}. ` +
          `Na comparação com 14 dias atrás, a margem passou de ${margin14 == null ? "valor indisponível" : pointsLabel(margin14)} para ${pointsLabel(currentMargin)}.`,
      );
    }
    paragraphs.push(
      `A leitura do modelo, usando exatamente os filtros e a janela da tabela, é que ${currentMargin < 1 ? "o confronto está tecnicamente aberto" : `${leader.candidate} mantém vantagem no confronto`}. ` +
        `Foram usadas ${windowPolls.length} observações candidato-pesquisa na janela efetiva da tabela, com meia-vida efetiva de ${adaptiveHalfLife} dias.`,
    );
  }

  els.commentaryMeta.textContent = `Comentário gerado a partir da mesma tabela bayesiana exibida acima, até ${dateKey(new Date(latestTime))}, respeitando cenário, meses, institutos, itens selecionados e meia-vida bayesiana.`;
  els.commentaryBody.innerHTML = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function renderControls() {
  state.scenarios = [...new Set(state.polls.map((poll) => poll.scenario))];
  state.selectedScenario = state.scenarios.find((s) => /primeiro turno/i.test(s)) || state.scenarios[0];
  els.scenarioSelect.innerHTML = state.scenarios.map((scenario) => `<option>${scenario}</option>`).join("");
  els.scenarioSelect.value = state.selectedScenario;
  updateDateAndPollsterFilters();
  updateCandidates();
}

function updateDateAndPollsterFilters() {
  const scenarioPolls = state.polls.filter((poll) => poll.scenario === state.selectedScenario);
  const months = [...new Set(scenarioPolls.map((poll) => poll.month))].sort();
  const pollsters = [...new Set(scenarioPolls.map((poll) => poll.pollster).filter(isValidPollsterName))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const defaultMonths = months.slice(Math.max(0, months.length - 4));
  state.selectedMonths = new Set(defaultMonths);
  state.selectedPollsters = new Set(pollsters);
  els.monthSelect.innerHTML = months
    .map((month) => `<option value="${month}"${state.selectedMonths.has(month) ? " selected" : ""}>${monthLabel(month)}</option>`)
    .join("");
  els.pollsterSelect.innerHTML = pollsters.map((pollster) => `<option selected>${pollster}</option>`).join("");
}

function updateCandidates() {
  const filteredPolls = state.polls.filter(
    (poll) =>
      poll.scenario === state.selectedScenario &&
      state.selectedMonths.has(poll.month) &&
      state.selectedPollsters.has(poll.pollster),
  );
  const latestMonth = [...state.selectedMonths].sort().at(-1);
  const stats = new Map();

  filteredPolls.forEach((poll) => {
    if (!stats.has(poll.candidate)) {
      stats.set(poll.candidate, {
        candidate: poll.candidate,
        latestTime: poll.t,
        observations: 0,
        latestMonthObservations: 0,
      });
    }
    const row = stats.get(poll.candidate);
    row.latestTime = Math.max(row.latestTime, poll.t);
    row.observations += 1;
    if (poll.month === latestMonth) row.latestMonthObservations += 1;
  });

  const candidates = [...stats.values()]
    .sort(
      (a, b) =>
        Number(isSpecialChoice(a.candidate)) - Number(isSpecialChoice(b.candidate)) ||
        Number(b.latestMonthObservations > 0) - Number(a.latestMonthObservations > 0) ||
        b.latestTime - a.latestTime ||
        b.latestMonthObservations - a.latestMonthObservations ||
        b.observations - a.observations ||
        a.candidate.localeCompare(b.candidate, "pt-BR"),
    )
    .map((row) => row.candidate);

  const defaultCandidates = candidates.filter((candidate) => !isSpecialChoice(candidate)).slice(0, 6);
  if (defaultCandidates.length < Math.min(6, candidates.length)) {
    defaultCandidates.push(
      ...candidates.filter((candidate) => isSpecialChoice(candidate)).slice(0, 6 - defaultCandidates.length),
    );
  }
  state.selectedCandidates = new Set(defaultCandidates);
  els.candidateSelect.innerHTML = candidates
    .map((candidate) => `<option${state.selectedCandidates.has(candidate) ? " selected" : ""}>${candidate}</option>`)
    .join("");
}

function render() {
  const polls = selectedPolls();
  els.chartTitle.textContent = state.selectedScenario || "Sem cenário";
  els.chartMeta.textContent = `${polls.length} observações candidato-pesquisa · ${new Set(polls.map((p) => p.pollster)).size} institutos · ${new Set(polls.map((p) => p.month)).size} meses`;
  els.loessSpanValue.textContent = Number(els.loessSpan.value).toLocaleString("pt-BR");
  els.halfLifeValue.textContent = `${els.halfLife.value} dias`;
  renderBayesianSummary();
  renderVictoryProbabilities();
  renderTable();
  renderCommentary();
  drawChart();
}

async function loadData() {
  els.status.textContent = "Lendo Wikipédia";
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
  const payload = await response.json();
  const html = payload.parse?.text?.["*"];
  if (!html) throw new Error("A API não retornou HTML da página.");
  state.polls = parseTables(html);
  if (!state.polls.length) throw new Error("Nenhuma pesquisa reconhecida nas tabelas.");
  state.houseEffects = computeHouseEffects(state.polls);
  renderControls();
  els.status.textContent = "Atualizado";
  render();
}

function downloadCsv() {
  const header = [
    "round",
    "scenario",
    "base_scenario",
    "scenario_index",
    "scenario_variant",
    "poll_id",
    "pollster",
    "pollster_grade",
    "pollster_mean_error",
    "pollster_quality_weight",
    "house_effect_n",
    "house_effect",
    "house_effect_abs",
    "house_effect_weight",
    "house_effect_correction",
    "systemic_candidate_bias",
    "date_start",
    "date_end",
    "date_mid",
    "month",
    "sample",
    "margin",
    "candidate",
    "pct",
  ];
  const lines = [header.join(",")].concat(
    selectedPollsForExport().map((poll) =>
      header
        .map((key) => {
          const value =
            {
              round: poll.round,
              scenario: poll.scenario,
              base_scenario: poll.baseScenario,
              scenario_index: poll.scenarioIndex,
              scenario_variant: poll.scenarioVariant,
              poll_id: poll.pollId,
              pollster: poll.pollster,
              pollster_grade: pollsterRatingFor(poll.pollster)?.grade,
              pollster_mean_error: pollsterRatingFor(poll.pollster)?.meanError,
              pollster_quality_weight: pollsterQualityWeight(poll.pollster).toFixed(3),
              house_effect_n: houseEffectFor(poll.pollster)?.n,
              house_effect: houseEffectFor(poll.pollster)?.effect?.toFixed(3),
              house_effect_abs: houseEffectFor(poll.pollster)?.abs?.toFixed(3),
              house_effect_weight: houseEffectWeight(poll.pollster).toFixed(3),
              house_effect_correction:
                houseEffectFor(poll.pollster)?.n > 2 && poll.pct >= 15 ? HOUSE_EFFECT_CORRECTION.toFixed(2) : "",
              systemic_candidate_bias: systemicCandidateBias(poll.candidate).toFixed(3),
              date_start: poll.dateStart,
              date_end: poll.dateEnd,
              date_mid: poll.dateMid,
              sample: poll.sample,
          margin: poll.margin,
          month: poll.month,
          candidate: poll.candidate,
              pct: poll.pct,
            }[key] ?? "";
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(","),
    ),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pesquisas-presidencial-2026.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyChart() {
  [els.copyChartButton, els.copyChartPanelButton].filter(Boolean).forEach((button) => {
    button.disabled = true;
  });
  const previousStatus = els.status.textContent;
  try {
    const blob = await new Promise((resolve) => els.chart.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Canvas sem imagem.");
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      els.status.textContent = "Gráfico copiado";
    } else {
      downloadBlob(blob, "grafico-agregador-eleitoral.png");
      els.status.textContent = "PNG exportado";
    }
  } catch (error) {
    const blob = await new Promise((resolve) => els.chart.toBlob(resolve, "image/png"));
    if (blob) downloadBlob(blob, "grafico-agregador-eleitoral.png");
    els.status.textContent = "PNG exportado";
  } finally {
    window.setTimeout(() => {
      els.status.textContent = previousStatus;
      [els.copyChartButton, els.copyChartPanelButton].filter(Boolean).forEach((button) => {
        button.disabled = false;
      });
    }, 1800);
  }
}

function tableToTsv(table) {
  const rows = [...table.querySelectorAll("tr")];
  return rows
    .map((row) =>
      [...row.children]
        .map((cell) => cell.textContent.replace(/\s+/g, " ").trim())
        .map((value) => value.replaceAll("\t", " ").replaceAll("\n", " "))
        .join("\t"),
    )
    .join("\n");
}

async function copyText(text, label, button = null) {
  const previousStatus = els.status.textContent;
  if (button) button.disabled = true;
  try {
    await navigator.clipboard.writeText(text);
    els.status.textContent = `${label} copiada`;
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    els.status.textContent = `${label} copiada`;
  } finally {
    window.setTimeout(() => {
      els.status.textContent = previousStatus;
      if (button) button.disabled = false;
    }, 1800);
  }
}

function copyTable(tableSelector, label, button) {
  const table = document.querySelector(tableSelector);
  if (!table) return;
  copyText(tableToTsv(table), label, button);
}

function asciiText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value) {
  return asciiText(value).replace(/[\\()]/g, "\\$&");
}

function wrapPdfText(value, max = 92) {
  const words = asciiText(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines;
}

function selectedLabels(select) {
  return [...select.selectedOptions].map((option) => option.textContent.trim());
}

function reportTextLines() {
  const bayesRows = [...els.bayesRows.querySelectorAll("tr")].slice(0, 10).map((row) =>
    [...row.cells].map((cell) => cell.textContent.trim()).join(" | "),
  );
  const probabilityRows = [...els.probabilityRows.querySelectorAll("tr")].slice(0, 10).map((row) =>
    [...row.cells].map((cell) => cell.textContent.trim()).join(" | "),
  );
  const commentary = [...els.commentaryBody.querySelectorAll("p")].flatMap((p) => wrapPdfText(p.textContent, 96));
  return [
    "Relatorio do Agregador Eleitoral",
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    `Cenario: ${els.chartTitle.textContent}`,
    `Resumo: ${els.chartMeta.textContent}`,
    `Meses: ${selectedLabels(els.monthSelect).join(", ")}`,
    `Institutos: ${selectedLabels(els.pollsterSelect).length} selecionados`,
    `Visualizacao: ${selectedLabels(els.candidateSelect).join(", ")}`,
    "",
    "Media bayesiana",
    ...bayesRows,
    "",
    "Probabilidades de vitoria",
    ...probabilityRows,
    "",
    "Comentario do agregado",
    ...commentary,
  ].filter((line, index, lines) => line || lines[index - 1]);
}

function jpegDataFromCanvas() {
  const dataUrl = els.chart.toDataURL("image/jpeg", 0.92);
  const [, base64] = dataUrl.split(",");
  return atob(base64);
}

function makePdf() {
  const pageW = 595;
  const pageH = 842;
  const margin = 42;
  const imageBinary = jpegDataFromCanvas();
  const imageW = 511;
  const imageH = Math.round(imageW * (els.chart.height / Math.max(1, els.chart.width)));
  let y = pageH - margin;
  const commands = ["q", "1 1 1 rg", `0 0 ${pageW} ${pageH} re f`, "Q"];

  reportTextLines()
    .flatMap((line) => (line ? wrapPdfText(line, 96) : [""]))
    .slice(0, 34)
    .forEach((line, index) => {
      if (!line) {
        y -= 10;
        return;
      }
      const size = index === 0 ? 16 : 9;
      commands.push(`BT /F1 ${size} Tf ${margin} ${y} Td (${pdfEscape(line)}) Tj ET`);
      y -= index === 0 ? 20 : 12;
    });

  const imageY = Math.max(45, y - imageH - 16);
  commands.push(`q ${imageW} 0 0 ${imageH} ${margin} ${imageY} cm /Im1 Do Q`);
  const content = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Type /XObject /Subtype /Image /Width ${els.chart.width} /Height ${els.chart.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBinary.length} >>\nstream\n${imageBinary}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(pdf, (char) => char.charCodeAt(0))], { type: "application/pdf" });
}

function exportPdf() {
  els.pdfButton.disabled = true;
  const previousStatus = els.status.textContent;
  try {
    downloadBlob(makePdf(), "relatorio-agregador-eleitoral.pdf");
    els.status.textContent = "PDF exportado";
  } finally {
    window.setTimeout(() => {
      els.status.textContent = previousStatus;
      els.pdfButton.disabled = false;
    }, 1800);
  }
}

els.scenarioSelect.addEventListener("change", () => {
  state.selectedScenario = els.scenarioSelect.value;
  updateDateAndPollsterFilters();
  updateCandidates();
  render();
});
els.monthSelect.addEventListener("change", () => {
  state.selectedMonths = new Set([...els.monthSelect.selectedOptions].map((option) => option.value));
  updateCandidates();
  render();
});
els.pollsterSelect.addEventListener("change", () => {
  state.selectedPollsters = new Set([...els.pollsterSelect.selectedOptions].map((option) => option.value));
  updateCandidates();
  render();
});
els.candidateSelect.addEventListener("change", () => {
  state.selectedCandidates = new Set([...els.candidateSelect.selectedOptions].map((option) => option.value));
  render();
});
els.loessSpan.addEventListener("input", render);
els.halfLife.addEventListener("input", render);
els.reloadButton.addEventListener("click", loadData);
els.copyChartButton.addEventListener("click", copyChart);
els.copyChartPanelButton.addEventListener("click", copyChart);
els.copyBayesButton.addEventListener("click", () => copyTable(".bayesPanel table", "Tabela bayesiana", els.copyBayesButton));
els.copyProbabilityButton.addEventListener("click", () =>
  copyTable(".probabilityPanel table", "Tabela de probabilidades", els.copyProbabilityButton),
);
els.copyPollsButton.addEventListener("click", () => copyTable(".pollsPanel table", "Tabela de pesquisas", els.copyPollsButton));
els.downloadButton.addEventListener("click", downloadCsv);
els.pdfButton.addEventListener("click", exportPdf);
window.addEventListener("resize", drawChart);

loadData().catch((error) => {
  els.status.textContent = "Erro";
  els.chartTitle.textContent = "Não foi possível carregar os dados";
  els.chartMeta.textContent = error.message;
});
