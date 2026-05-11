const PAGE_TITLE = "Pesquisas de opinião para a eleição presidencial no Brasil em 2026";
const API_URL = `https://pt.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE_TITLE)}&prop=text&format=json&origin=*`;

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

function normalizeName(value) {
  return cleanText(value)
    .replace(/\(.+?\)/g, "")
    .replace(/^[0-9]+[.,]?\s*/, "")
    .trim();
}

function normalizeHeader(parts) {
  const cleaned = parts.map(normalizeName).filter(Boolean);
  const partyOrMeta = /^(pt|pl|psb|psdb|pdt|psol|mdb|novo|psd|uni[aã]o|republicanos|sem partido|cidadania|podemos|avante|solidariedade|dc|prtb|pcb|pcdo?b|pv|rede|up|miss[aã]o|mobiliza|pstu|pco)$/i;
  const generic = /(instituto|empresa|contratante|pesquisa|data|per[ií]odo|campo|amostra|entrevistados|margem|erro|imagem|foto|outros|indecisos|absentos|nenhum|branco|nulo)/i;
  const candidate = cleaned.find((part) => !partyOrMeta.test(part) && !generic.test(part) && part.length <= 28);
  return candidate || cleaned.join(" ");
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

function parseDateRange(value, fallbackYear = 2026) {
  const text = cleanText(value).toLowerCase();
  const monthMap = {
    jan: 0, janeiro: 0, fev: 1, fevereiro: 1, mar: 2, "março": 2, marco: 2, abr: 3, abril: 3,
    mai: 4, maio: 4, jun: 5, junho: 5, jul: 6, julho: 6, ago: 7, agosto: 7, set: 8, setembro: 8,
    out: 9, outubro: 9, nov: 10, novembro: 10, dez: 11, dezembro: 11,
  };
  const parts = [...text.matchAll(/(\d{1,2})(?:\s*(?:a|e|-|–)\s*(\d{1,2}))?\s*(?:de\s*)?([a-zç]+)\s*(?:de\s*)?(20\d{2})?/gi)];
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const month = monthMap[last[3]];
  if (month == null) return null;
  let year = Number(last[4] || fallbackYear);
  const hasExplicitYear = Boolean(last[4]);
  const day1 = Number(last[1]);
  const day2 = Number(last[2] || last[1]);
  let start = new Date(Date.UTC(year, month, day1));
  let end = new Date(Date.UTC(year, month, day2));
  let mid = new Date((start.getTime() + end.getTime()) / 2);
  if (!hasExplicitYear && mid.getTime() > Date.now() + 7 * 86400000) {
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

function looksLikeDateText(value) {
  const text = cleanText(value).toLowerCase();
  return /^\d{1,2}(\s*(a|e|-|–)\s*\d{1,2})?\s*(de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i.test(text);
}

function isValidPollsterName(value) {
  const text = cleanText(value);
  return text.length >= 2 && text.length <= 70 && /[a-zA-ZÀ-ÿ]/.test(text) && !looksLikeDateText(text);
}

function classifyColumns(headers) {
  const columns = { pollster: -1, date: -1, sample: -1, margin: -1, candidates: [] };
  headers.forEach((header, index) => {
    const lower = header.toLowerCase();
    if (columns.pollster < 0 && /(contratante|instituto|empresa|pesquisa|realizador)/.test(lower)) columns.pollster = index;
    if (columns.date < 0 && /(data|período|periodo|campo)/.test(lower)) columns.date = index;
    if (columns.sample < 0 && /(amostra|entrevistados)/.test(lower)) columns.sample = index;
    if (columns.margin < 0 && /(margem|erro)/.test(lower)) columns.margin = index;
  });
  const blocked = new Set([columns.pollster, columns.date, columns.sample, columns.margin]);
  const blockedWords = /(instituto|empresa|contratante|data|período|periodo|campo|amostra|margem|erro|outros|indecisos|absentos|nenhum|branco|nulo|não sabe|nao sabe|vantagem)/i;
  headers.forEach((header, index) => {
    if (blocked.has(index) || !header || blockedWords.test(header)) return;
    if (header.length > 32) return;
    columns.candidates.push({ index, name: header });
  });
  return columns;
}

function parseFirstTurnPollRows(html) {
  const start = html.indexOf('id="Primeiro_turno"');
  const end = html.indexOf('id="Segundo_turno"');
  const section = html.slice(start, end > start ? end : undefined);
  const polls = [];
  const carry = {};
  let tableIndex = 0;
  for (const tableMatch of section.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)) {
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
    const bodyGrid = buildGrid(dataRows);
    bodyGrid.forEach((cells) => {
      const pollster = cleanText(cells[columns.pollster]) || carry[tableIndex]?.pollster;
      const dateInfo = parseDateRange(cells[columns.date] || "", 2026);
      if (!pollster || !isValidPollsterName(pollster) || !dateInfo) return;
      carry[tableIndex] = { pollster };
      const candidates = {};
      columns.candidates.forEach(({ index, name }) => {
        const pct = parsePercent(cells[index]);
        if (pct != null) candidates[name] = pct;
      });
      if (Object.keys(candidates).length < 2) return;
      polls.push({
        pollster,
        dateMid: dateKey(dateInfo.mid),
        t: dateInfo.mid.getTime(),
        sample: parseSample(cells[columns.sample] || ""),
        margin: parseNumber(cells[columns.margin] || ""),
        candidates,
      });
    });
  }
  return polls.sort((a, b) => a.t - b.t);
}

function bayesianMeanForCandidate(polls, candidate) {
  let weightSum = 2500;
  let valueSum = 0;
  const vals = polls.map((poll) => poll.candidates[candidate]).filter((v) => v != null);
  if (!vals.length) return null;
  const priorMean = vals.reduce((a, b) => a + b, 0) / vals.length;
  valueSum = priorMean * weightSum;
  polls.forEach((poll) => {
    const value = poll.candidates[candidate];
    if (value == null) return;
    const sampleWeight = Math.max(300, poll.sample || 1000);
    const marginWeight = poll.margin ? 1 / Math.max(0.0001, poll.margin * poll.margin) : 1;
    const w = sampleWeight * marginWeight;
    weightSum += w;
    valueSum += value * w;
  });
  return valueSum / weightSum;
}

function referenceFromLast10(previousPolls) {
  const window = previousPolls.slice(-10);
  const candidateNames = [...new Set(window.flatMap((poll) => Object.keys(poll.candidates)))];
  const estimates = candidateNames
    .map((candidate) => ({ candidate, estimate: bayesianMeanForCandidate(window, candidate) }))
    .filter((row) => row.estimate != null)
    .sort((a, b) => b.estimate - a.estimate);
  return estimates[0] || null;
}

async function main() {
  const payload = await fetch(API_URL).then((r) => r.json());
  const polls = parseFirstTurnPollRows(payload.parse.text["*"]);
  const effects = [];
  polls.forEach((poll, index) => {
    const ref = referenceFromLast10(polls.slice(0, index));
    if (!ref) return;
    const instituteValue = poll.candidates[ref.candidate];
    if (instituteValue == null) return;
    effects.push({
      pollster: poll.pollster,
      candidate: ref.candidate,
      date: poll.dateMid,
      effect: instituteValue - ref.estimate,
      abs: Math.abs(instituteValue - ref.estimate),
    });
  });
  const byPollster = new Map();
  effects.forEach((effect) => {
    if (!byPollster.has(effect.pollster)) byPollster.set(effect.pollster, []);
    byPollster.get(effect.pollster).push(effect);
  });
  const rows = [...byPollster.entries()]
    .map(([pollster, items]) => ({
      pollster,
      n: items.length,
      avg: items.reduce((sum, item) => sum + item.effect, 0) / items.length,
      avgAbs: items.reduce((sum, item) => sum + item.abs, 0) / items.length,
      lastCandidate: items[items.length - 1].candidate,
      lastDate: items[items.length - 1].date,
    }))
    .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));
  console.log(JSON.stringify({ totalPollRows: polls.length, comparisons: effects.length, rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
