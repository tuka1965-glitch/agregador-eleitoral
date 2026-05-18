const PAGE_TITLE = "Pesquisas de opinião para a eleição presidencial no Brasil em 2022";
const API_URL = `https://pt.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE_TITLE)}&prop=text&format=json&origin=*`;

const FIRST_RESULTS = {
  Lula: 48.43,
  Bolsonaro: 43.2,
  Tebet: 4.16,
  "Ciro Gomes": 3.04,
};

const SECOND_RESULTS = {
  Lula: 50.9,
  Bolsonaro: 49.1,
};

const POLLSTER_RATINGS = [
  ["AtlasIntel", 2.6, 79, -0.58, "A"],
  ["Datafolha", 3.16, 190, -0.4, "B+"],
  ["Ipec", 3.34, 1089, -0.61, "A"],
  ["Ibope", 3.34, 1089, -0.61, "A"],
  ["Paraná Pesquisas", 3.33, 126, -0.42, "B+"],
  ["Quaest", 3.44, 31, 0.01, "B"],
  ["Genial/Quaest", 3.44, 31, 0.01, "B"],
  ["Real Time Big Data", 4.0, 158, 0.07, "B"],
  ["PoderData", 3.3, 9, 0.37, "B"],
  ["Ipespe", 4.22, 58, 0.17, "B"],
  ["MDA", 3.92, 29, -0.42, "B+"],
  ["CNT/MDA", 3.92, 29, -0.42, "B+"],
  ["FSB Pesquisa", 3.41, 10, 0.01, "B"],
  ["Futura", 3.29, 72, -0.75, "A"],
  ["Apex/Futura", 3.29, 72, -0.75, "A"],
  ["Futura/Apex", 3.29, 72, -0.75, "A"],
  ["Ideia Big Data", 2.89, 14, -0.16, "B+"],
  ["Meio/Ideia", 2.89, 14, -0.16, "B+"],
  ["Brasmarket", 5.82, 15, 2.0, "D"],
  ["Ranking Pesquisa", 4.88, 56, 0.09, "B"],
  ["Veritá", 4.85, 155, 0.44, "B"],
  ["Vox Populi", 4.29, 50, 0.07, "B"],
];

function cleanText(value) {
  return (value || "")
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#95;/g, "_")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
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

const ALIAS_INDEX = new Map(
  [
    ["Apex/Futura", "Apex/Futura"],
    ["Futura/Apex", "Apex/Futura"],
    ["Genial/Quaest", "Genial/Quaest"],
    ["Quaest/Genial", "Genial/Quaest"],
    ["CNT/MDA", "CNT/MDA"],
    ["MDA/CNT", "CNT/MDA"],
    ["Meio/Ideia", "Meio/Ideia"],
    ["Ideia/Meio", "Meio/Ideia"],
  ].map(([a, c]) => [normalizePollsterKey(a), c]),
);

function canonicalPollsterName(name) {
  const cleaned = cleanText(name)
    .replace(/\bBR[-\s]?\d{4,}\/?20?\d{2}\b/gi, "")
    .replace(/\b[A-Z]{2}[-\s]?\d{4,}\/?20?\d{2}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return ALIAS_INDEX.get(normalizePollsterKey(cleaned)) || cleaned;
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

function parseAttrs(value) {
  const attrs = {};
  for (const match of value.matchAll(/([a-z]+)="?([^"\s>]+)"?/gi)) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function rowCells(rowHtml) {
  const cells = [];
  for (const match of rowHtml.matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const attrs = parseAttrs(match[2]);
    cells.push({
      tag: match[1].toLowerCase(),
      text: cleanText(match[3]),
      colspan: Number(attrs.colspan || 1),
      rowspan: Number(attrs.rowspan || 1),
    });
  }
  return cells;
}

function buildGrid(rows) {
  const carry = [];
  return rows.map((cells) => {
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
        if (cell.rowspan > 1) carry[col + i] = { text: cell.text, remaining: cell.rowspan - 1 };
      }
      col += cell.colspan;
    });
    fillCarry();
    return values;
  });
}

function normalizeCandidate(value) {
  const text = cleanText(value).replace(/\(.+?\)/g, "").trim();
  if (/bolsonaro/i.test(text)) return "Bolsonaro";
  if (/lula/i.test(text)) return "Lula";
  if (/tebet|simone/i.test(text)) return "Tebet";
  if (/ciro|gomes/i.test(text)) return "Ciro Gomes";
  return text.replace(/\b(PT|PL|MDB|PDT|UNIÃO|UNIAO|NOVO|PSDB|PCB|UP|PSTU)\b/gi, "").trim();
}

function normalizeHeader(parts) {
  const cleaned = parts.map(cleanText).filter(Boolean);
  const candidates = cleaned.map(normalizeCandidate).filter((part) => /^(Lula|Bolsonaro|Tebet|Ciro Gomes)$/.test(part));
  if (candidates.length) return candidates[0];
  return cleaned.join(" ");
}

function parseNumber(value) {
  const match = cleanText(value).match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(".", "").replace(",", ".")) : null;
}

function parsePercent(value) {
  const number = parseNumber(value);
  if (number == null || number > 100) return null;
  return number;
}

function parseSample(value) {
  const match = cleanText(value).match(/\d[\d. ]+/);
  return match ? Number(match[0].replace(/[. ]/g, "")) : null;
}

function parseDate(value) {
  const text = cleanText(value);
  let match = text.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const monthMap = {
    jan: 0, janeiro: 0, fev: 1, fevereiro: 1, mar: 2, "março": 2, marco: 2, abr: 3, abril: 3,
    mai: 4, maio: 4, jun: 5, junho: 5, jul: 6, julho: 6, ago: 7, agosto: 7, set: 8, setembro: 8,
    out: 9, outubro: 9, nov: 10, novembro: 10, dez: 11, dezembro: 11,
  };
  const parts = [...text.toLowerCase().matchAll(/(\d{1,2})(?:\s*(?:a|e|-|–)\s*(\d{1,2}))?\s*(?:de\s*)?([a-zç]+)\s*(?:de\s*)?(20\d{2})?/gi)];
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const month = monthMap[last[3]];
  if (month == null) return null;
  const year = Number(last[4] || 2022);
  const day1 = Number(last[1]);
  const day2 = Number(last[2] || last[1]);
  return new Date((Date.UTC(year, month, day1) + Date.UTC(year, month, day2)) / 2);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function classifyColumns(headers) {
  const columns = { pollster: -1, date: -1, sample: -1, margin: -1, candidates: [] };
  headers.forEach((header, index) => {
    const lower = header.toLowerCase();
    if (columns.pollster < 0 && /(contratante|instituto|empresa|pesquisa|realizador|empresa realizadora)/.test(lower)) columns.pollster = index;
    if (columns.date < 0 && /(data|período|periodo|campo)/.test(lower)) columns.date = index;
    if (columns.sample < 0 && /(amostra|entrevistados)/.test(lower)) columns.sample = index;
    if (columns.margin < 0 && /(margem|erro)/.test(lower)) columns.margin = index;
    if (/^(Lula|Bolsonaro|Tebet|Ciro Gomes)$/.test(header)) columns.candidates.push({ index, name: header });
  });
  return columns;
}

function parseTables(sectionHtml, scenario) {
  const polls = [];
  const carry = {};
  let tableIndex = 0;
  for (const tableMatch of sectionHtml.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)) {
    tableIndex += 1;
    const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => rowCells(m[1]));
    const headerRows = [];
    const dataRows = [];
    let inBody = false;
    rowMatches.forEach((row) => {
      const hasData = row.some((cell) => cell.tag === "td");
      if (!inBody && !hasData) headerRows.push(row);
      else {
        inBody = true;
        dataRows.push(row);
      }
    });
    const headerGrid = buildGrid(headerRows);
    const width = Math.max(0, ...headerGrid.map((row) => row.length));
    const headers = Array.from({ length: width }, () => []);
    headerGrid.forEach((row) => row.forEach((text, col) => {
      if (text && !headers[col].includes(text)) headers[col].push(text);
    }));
    const normalizedHeaders = headers.map((parts) => normalizeHeader(parts));
    const columns = classifyColumns(normalizedHeaders);
    if (columns.date < 0 || columns.candidates.length < 2) continue;
    if (columns.pollster < 0) continue;
    const bodyGrid = buildGrid(dataRows);
    bodyGrid.forEach((cells) => {
      const rawPollster = cleanText(cells[columns.pollster]) || carry[tableIndex]?.pollster;
      const pollster = canonicalPollsterName(rawPollster);
      const date = parseDate(cells[columns.date] || "");
      if (!pollster || !date || !/[a-zA-ZÀ-ÿ]/.test(pollster) || /^\d/.test(pollster)) return;
      carry[tableIndex] = { pollster };
      const candidates = {};
      columns.candidates.forEach(({ index, name }) => {
        const pct = parsePercent(cells[index]);
        if (pct != null) candidates[name] = pct;
      });
      if (Object.keys(candidates).length < 2) return;
      polls.push({
        scenario,
        pollster,
        date: dateKey(date),
        t: date.getTime(),
        sample: parseSample(cells[columns.sample] || ""),
        margin: parseNumber(cells[columns.margin] || ""),
        candidates,
      });
    });
  }
  return polls.sort((a, b) => a.t - b.t);
}

function groupBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function bayesianMeanFromPolls(polls, candidate, targetTime, halfLifeDays, houseEffects = new Map(), options = {}) {
  const values = polls.map((poll) => poll.candidates[candidate]).filter((value) => value != null);
  if (!values.length) return null;
  const priorMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let weightSum = 2500;
  let valueSum = priorMean * weightSum;
  const dayMs = 86400000;
  polls.forEach((poll) => {
    let value = poll.candidates[candidate];
    if (value == null) return;
    const house = houseEffects.get(normalizePollsterKey(poll.pollster));
    if (options.houseCorrection && house && house.n > 2 && value >= 15) value -= options.houseCorrection * house.effect;
    const ageDays = Math.max(0, (targetTime - poll.t) / dayMs);
    const timeWeight = 0.5 ** (ageDays / halfLifeDays);
    const sampleWeight = Math.max(300, poll.sample || 1000);
    const marginWeight = poll.margin ? 1 / Math.max(0.0001, poll.margin * poll.margin) : 1;
    const ratingWeight = pollsterQualityWeight(poll.pollster);
    const houseWeight = house && house.n > 2 ? Math.min(1.1, Math.max(0.35, 1 / (1 + Math.abs(house.effect) / 4))) : 1;
    const recentBoost = options.latestTimes?.has(poll.t) ? (options.momentumWeight || 1) : 1;
    const weight = timeWeight * sampleWeight * marginWeight * ratingWeight * houseWeight * recentBoost;
    weightSum += weight;
    valueSum += value * weight;
  });
  return valueSum / weightSum;
}

function referenceLeaderFromLast10(previousPolls) {
  const window = previousPolls.slice(-10);
  const candidates = [...new Set(window.flatMap((poll) => Object.keys(poll.candidates)))];
  return candidates
    .map((candidate) => ({ candidate, estimate: bayesianMeanFromPolls(window, candidate, window.at(-1)?.t || 0, 999999) }))
    .filter((row) => row.estimate != null)
    .sort((a, b) => b.estimate - a.estimate)[0];
}

function computeHouseEffects(polls) {
  const effects = [];
  const byScenario = groupBy(polls, (poll) => poll.scenario);
  byScenario.forEach((scenarioPolls) => {
    scenarioPolls.forEach((poll, index) => {
      const ref = referenceLeaderFromLast10(scenarioPolls.slice(0, index));
      if (!ref) return;
      const value = poll.candidates[ref.candidate];
      if (value == null) return;
      effects.push({
        pollster: poll.pollster,
        effect: value - ref.estimate,
        abs: Math.abs(value - ref.estimate),
      });
    });
  });
  const grouped = groupBy(effects, (effect) => normalizePollsterKey(effect.pollster));
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

function regimeStrength(polls, candidates) {
  const recent = polls.slice(-5);
  const prior = polls.slice(-10, -5);
  if (recent.length < 5 || prior.length < 5) return 0;
  return Math.max(
    ...candidates.map((candidate) => {
      const r = recent.map((poll) => poll.candidates[candidate]).filter((value) => value != null);
      const p = prior.map((poll) => poll.candidates[candidate]).filter((value) => value != null);
      if (!r.length || !p.length) return 0;
      return Math.abs(r.reduce((sum, value) => sum + value, 0) / r.length - p.reduce((sum, value) => sum + value, 0) / p.length);
    }),
  );
}

function aggregate(polls, cutoffDate, candidates, halfLifeDays, houseEffects = null, options = {}) {
  const cutoff = new Date(`${cutoffDate}T23:59:59Z`).getTime();
  const usable = polls.filter((poll) => poll.t <= cutoff);
  const effects = houseEffects || computeHouseEffects(usable);
  const effectiveHalfLife = options.dynamicRegime && regimeStrength(usable, candidates) >= 3 ? 7 : halfLifeDays;
  const latestTimes = new Set(usable.slice(-5).map((poll) => poll.t));
  const estimates = Object.fromEntries(
    candidates.map((candidate) => [
      candidate,
      bayesianMeanFromPolls(usable, candidate, cutoff, effectiveHalfLife, effects, { ...options, latestTimes }),
    ]),
  );
  if (options.bolsonaroRawBias && estimates.Bolsonaro != null) estimates.Bolsonaro += options.bolsonaroRawBias;
  return { usable: usable.length, estimates, houseEffects: effects };
}

function validVoteShare(estimates, candidates) {
  const sum = candidates.reduce((total, candidate) => total + (estimates[candidate] || 0), 0);
  return Object.fromEntries(candidates.map((candidate) => [candidate, sum ? (estimates[candidate] / sum) * 100 : null]));
}

function errors(estimates, actual) {
  return Object.fromEntries(
    Object.keys(actual).map((candidate) => [candidate, estimates[candidate] == null ? null : estimates[candidate] - actual[candidate]]),
  );
}

function mae(errs) {
  const vals = Object.values(errs).filter((v) => v != null).map(Math.abs);
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

async function main() {
  const payload = await fetch(API_URL).then((r) => r.json());
  const html = payload.parse.text["*"];
  const firstSection = html.slice(html.indexOf('id="Primeiro_turno"'), html.indexOf('id="Segundo_turno"'));
  const secondStart = html.indexOf('id="Segundo_turno"');
  const secondEndCandidates = [
    html.indexOf('id="Ver_também"', secondStart),
    html.indexOf('id="Referências"', secondStart),
    html.length,
  ].filter((v) => v > secondStart);
  const secondSection = html.slice(secondStart, Math.min(...secondEndCandidates));
  const firstPolls = parseTables(firstSection, "Primeiro turno");
  const secondPolls = parseTables(secondSection, "Segundo turno");
  const baselineFirst = aggregate(firstPolls, "2022-10-01", ["Lula", "Bolsonaro", "Tebet", "Ciro Gomes"], 14);
  const baselineSecond = aggregate(secondPolls, "2022-10-29", ["Lula", "Bolsonaro"], 14);
  const options = { houseCorrection: 0.6, bolsonaroRawBias: 2.5, dynamicRegime: true, momentumWeight: 2 };
  const noBolsonaroBiasOptions = { houseCorrection: 0.6, bolsonaroRawBias: 0, dynamicRegime: true, momentumWeight: 2 };
  const first = aggregate(firstPolls, "2022-10-01", ["Lula", "Bolsonaro", "Tebet", "Ciro Gomes"], 14, null, options);
  const second = aggregate(secondPolls, "2022-10-29", ["Lula", "Bolsonaro"], 14, null, options);
  const noBiasFirst = aggregate(firstPolls, "2022-10-01", ["Lula", "Bolsonaro", "Tebet", "Ciro Gomes"], 14, null, noBolsonaroBiasOptions);
  const noBiasSecond = aggregate(secondPolls, "2022-10-29", ["Lula", "Bolsonaro"], 14, null, noBolsonaroBiasOptions);
  const baselineFirstValid = validVoteShare(baselineFirst.estimates, ["Lula", "Bolsonaro", "Tebet", "Ciro Gomes"]);
  const baselineSecondValid = validVoteShare(baselineSecond.estimates, ["Lula", "Bolsonaro"]);
  const firstValid = validVoteShare(first.estimates, ["Lula", "Bolsonaro", "Tebet", "Ciro Gomes"]);
  const secondValid = validVoteShare(second.estimates, ["Lula", "Bolsonaro"]);
  const firstErrors = errors(firstValid, FIRST_RESULTS);
  const secondErrors = errors(secondValid, SECOND_RESULTS);
  const houseRows = [...second.houseEffects.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .filter((row) => row.n > 2)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, 15);
  console.log(JSON.stringify({
    counts: { firstPolls: firstPolls.length, secondPolls: secondPolls.length, houseAdjustedInstitutes: houseRows.length },
    baseline: {
      first: { valid: baselineFirstValid, errors: errors(baselineFirstValid, FIRST_RESULTS), mae: mae(errors(baselineFirstValid, FIRST_RESULTS)) },
      second: { valid: baselineSecondValid, errors: errors(baselineSecondValid, SECOND_RESULTS), mae: mae(errors(baselineSecondValid, SECOND_RESULTS)) },
    },
    improvedOptions: options,
    noBolsonaroBias: {
      first: { valid: validVoteShare(noBiasFirst.estimates, ["Lula", "Bolsonaro", "Tebet", "Ciro Gomes"]) },
      second: { valid: validVoteShare(noBiasSecond.estimates, ["Lula", "Bolsonaro"]) },
    },
    first: { pollsUsed: first.usable, estimates: first.estimates, valid: firstValid, errors: firstErrors, mae: mae(firstErrors) },
    second: { pollsUsed: second.usable, estimates: second.estimates, valid: secondValid, errors: secondErrors, mae: mae(secondErrors) },
    houseRows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
