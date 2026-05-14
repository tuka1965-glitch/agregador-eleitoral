const state = {
  rows: [],
  headers: [],
  filteredGroups: new Set(),
  filteredUfs: new Set(),
  filteredIndicators: new Set(),
  populationRows: [],
  populationByUfYear: new Map(),
  ufGeojson: null,
  ufGeojsonPromise: null,
};

const likelyFields = {
  date: ["data_referencia", "data referencia", "mes de data referencia", "mes data referencia", "date", "data"],
  value: ["total_vitima", "total vitima", "total vitima", "total", "valor"],
  uf: ["uf", "estado", "sigla uf", "unidade federativa"],
  indicator: ["evento", "indicador", "tipo indicador", "crime", "natureza"],
  group: ["evento", "uf", "municipio"],
};

const els = {
  fileInput: document.getElementById("fileInput"),
  dateField: document.getElementById("dateField"),
  valueField: document.getElementById("valueField"),
  dateFormat: document.getElementById("dateFormat"),
  ufField: document.getElementById("ufField"),
  indicatorField: document.getElementById("indicatorField"),
  groupField: document.getElementById("groupField"),
  periodField: document.getElementById("periodField"),
  movingAverage: document.getElementById("movingAverage"),
  analyzeButton: document.getElementById("analyzeButton"),
  rowCount: document.getElementById("rowCount"),
  totalValue: document.getElementById("totalValue"),
  trendValue: document.getElementById("trendValue"),
  anomalyCount: document.getElementById("anomalyCount"),
  skippedRows: document.getElementById("skippedRows"),
  warningBox: document.getElementById("warningBox"),
  dataStatus: document.getElementById("dataStatus"),
  analysisText: document.getElementById("analysisText"),
  copyAnalysis: document.getElementById("copyAnalysis"),
  exportPdf: document.getElementById("exportPdf"),
  forecastText: document.getElementById("forecastText"),
  forecastBody: document.getElementById("forecastBody"),
  copyForecast: document.getElementById("copyForecast"),
  highlightThreshold: document.getElementById("highlightThreshold"),
  highlightTopN: document.getElementById("highlightTopN"),
  highlightCount: document.getElementById("highlightCount"),
  highlightPeriod: document.getElementById("highlightPeriod"),
  highlightLocationLevel: document.getElementById("highlightLocationLevel"),
  highlightMax: document.getElementById("highlightMax"),
  highlightText: document.getElementById("highlightText"),
  highlightBody: document.getElementById("highlightBody"),
  copyHighlights: document.getElementById("copyHighlights"),
  preStart: document.getElementById("preStart"),
  preEnd: document.getElementById("preEnd"),
  postStart: document.getElementById("postStart"),
  postEnd: document.getElementById("postEnd"),
  territorialThreshold: document.getElementById("territorialThreshold"),
  fallingUfCount: document.getElementById("fallingUfCount"),
  medianUfChange: document.getElementById("medianUfChange"),
  nationalChange: document.getElementById("nationalChange"),
  generalizationLabel: document.getElementById("generalizationLabel"),
  territorialText: document.getElementById("territorialText"),
  territorialBody: document.getElementById("territorialBody"),
  copyTerritorial: document.getElementById("copyTerritorial"),
  shareStart: document.getElementById("shareStart"),
  shareEnd: document.getElementById("shareEnd"),
  shareTopN: document.getElementById("shareTopN"),
  topShareUf: document.getElementById("topShareUf"),
  topShareTotal: document.getElementById("topShareTotal"),
  medianShare: document.getElementById("medianShare"),
  shareConcentration: document.getElementById("shareConcentration"),
  shareText: document.getElementById("shareText"),
  shareBody: document.getElementById("shareBody"),
  copyShare: document.getElementById("copyShare"),
  populationInput: document.getElementById("populationInput"),
  populationStart: document.getElementById("populationStart"),
  populationEnd: document.getElementById("populationEnd"),
  populationStatus: document.getElementById("populationStatus"),
  topRateUf: document.getElementById("topRateUf"),
  medianRate: document.getElementById("medianRate"),
  populationYearsUsed: document.getElementById("populationYearsUsed"),
  populationCoverage: document.getElementById("populationCoverage"),
  populationText: document.getElementById("populationText"),
  populationBody: document.getElementById("populationBody"),
  copyPopulation: document.getElementById("copyPopulation"),
  mapYearUsed: document.getElementById("mapYearUsed"),
  mapMaxUf: document.getElementById("mapMaxUf"),
  mapMedianRate: document.getElementById("mapMedianRate"),
  mapCoverage: document.getElementById("mapCoverage"),
  mapText: document.getElementById("mapText"),
  mapSvg: document.getElementById("mapSvg"),
  mapLegend: document.getElementById("mapLegend"),
  mapBody: document.getElementById("mapBody"),
  copyMap: document.getElementById("copyMap"),
  stateAnomalyStart: document.getElementById("stateAnomalyStart"),
  stateAnomalyEnd: document.getElementById("stateAnomalyEnd"),
  stateAnomalyZ: document.getElementById("stateAnomalyZ"),
  stateAnomalyMinPeriods: document.getElementById("stateAnomalyMinPeriods"),
  stateAnomalyEvent: document.getElementById("stateAnomalyEvent"),
  stateAnomalyUfCount: document.getElementById("stateAnomalyUfCount"),
  stateAnomalyPointCount: document.getElementById("stateAnomalyPointCount"),
  stateAnomalyMax: document.getElementById("stateAnomalyMax"),
  stateAnomalyText: document.getElementById("stateAnomalyText"),
  stateAnomalyBody: document.getElementById("stateAnomalyBody"),
  copyStateAnomalies: document.getElementById("copyStateAnomalies"),
  chart: document.getElementById("chart"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  ufFilters: document.getElementById("ufFilters"),
  indicatorFilters: document.getElementById("indicatorFilters"),
  filters: document.getElementById("filters"),
  selectAllUfs: document.getElementById("selectAllUfs"),
  selectAllIndicators: document.getElementById("selectAllIndicators"),
  selectAllGroups: document.getElementById("selectAllGroups"),
  selectNoUfs: document.getElementById("selectNoUfs"),
  selectNoIndicators: document.getElementById("selectNoIndicators"),
  selectNoGroups: document.getElementById("selectNoGroups"),
  summaryBody: document.getElementById("summaryBody"),
};

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.name.toLowerCase().endsWith(".twbx")) {
    showTwbxNotice(file.name);
    return;
  }
  const text = await file.text();
  loadDataset(parseCsv(text), file.name);
  setDataStatus(`Base carregada do arquivo local ${file.name}: ${formatInteger(state.rows.length)} linhas.`, "ok");
});

for (const element of [els.dateField, els.valueField, els.dateFormat, els.periodField, els.movingAverage]) {
  element.addEventListener("change", analyze);
}
for (const element of [els.preStart, els.preEnd, els.postStart, els.postEnd, els.territorialThreshold]) {
  element.addEventListener("change", analyze);
}
for (const element of [els.shareStart, els.shareEnd, els.shareTopN]) {
  element.addEventListener("change", analyze);
}
for (const element of [els.highlightThreshold, els.highlightTopN]) {
  element.addEventListener("change", analyze);
}
for (const element of [els.populationStart, els.populationEnd]) {
  element.addEventListener("change", analyze);
}
for (const element of [els.stateAnomalyStart, els.stateAnomalyEnd, els.stateAnomalyZ, els.stateAnomalyMinPeriods]) {
  element.addEventListener("change", analyze);
}
els.populationInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  loadPopulationCsv(text, file.name);
  analyze();
});
els.ufField.addEventListener("change", () => resetDimensionFilter(state.filteredUfs, els.ufFilters, buildUfFilters));
els.indicatorField.addEventListener("change", () =>
  resetDimensionFilter(state.filteredIndicators, els.indicatorFilters, buildIndicatorFilters),
);
els.groupField.addEventListener("change", () => resetDimensionFilter(state.filteredGroups, els.filters, buildGroupFilters));
els.analyzeButton.addEventListener("click", analyze);
els.selectAllUfs.addEventListener("click", () => clearFilterSet(state.filteredUfs, buildUfFilters));
els.selectAllIndicators.addEventListener("click", () => clearFilterSet(state.filteredIndicators, buildIndicatorFilters));
els.selectAllGroups.addEventListener("click", () => clearFilterSet(state.filteredGroups, buildGroupFilters));
els.selectNoUfs.addEventListener("click", () => selectNoValues(els.ufField.value, state.filteredUfs, buildUfFilters));
els.selectNoIndicators.addEventListener("click", () =>
  selectNoValues(els.indicatorField.value, state.filteredIndicators, buildIndicatorFilters),
);
els.selectNoGroups.addEventListener("click", () => selectNoValues(els.groupField.value, state.filteredGroups, buildGroupFilters));
els.copyAnalysis.addEventListener("click", async () => {
  const text = els.analysisText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyAnalysis.textContent = "Copiado";
  setTimeout(() => {
    els.copyAnalysis.textContent = "Copiar";
  }, 1200);
});
els.copyForecast.addEventListener("click", async () => {
  const text = els.forecastText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyForecast.textContent = "Copiado";
  setTimeout(() => {
    els.copyForecast.textContent = "Copiar";
  }, 1200);
});
els.copyHighlights.addEventListener("click", async () => {
  const text = els.highlightText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyHighlights.textContent = "Copiado";
  setTimeout(() => {
    els.copyHighlights.textContent = "Copiar";
  }, 1200);
});
els.exportPdf.addEventListener("click", () => {
  window.print();
});
els.copyTerritorial.addEventListener("click", async () => {
  const text = els.territorialText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyTerritorial.textContent = "Copiado";
  setTimeout(() => {
    els.copyTerritorial.textContent = "Copiar";
  }, 1200);
});
els.copyShare.addEventListener("click", async () => {
  const text = els.shareText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyShare.textContent = "Copiado";
  setTimeout(() => {
    els.copyShare.textContent = "Copiar";
  }, 1200);
});
els.copyPopulation.addEventListener("click", async () => {
  const text = els.populationText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyPopulation.textContent = "Copiado";
  setTimeout(() => {
    els.copyPopulation.textContent = "Copiar";
  }, 1200);
});
els.copyMap.addEventListener("click", async () => {
  const text = els.mapText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyMap.textContent = "Copiado";
  setTimeout(() => {
    els.copyMap.textContent = "Copiar";
  }, 1200);
});
els.copyStateAnomalies.addEventListener("click", async () => {
  const text = els.stateAnomalyText.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  els.copyStateAnomalies.textContent = "Copiado";
  setTimeout(() => {
    els.copyStateAnomalies.textContent = "Copiar";
  }, 1200);
});

loadDefaultPopulation();
loadDefaultSinespData();

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      current.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(field.trim());
      if (current.some(Boolean)) rows.push(current);
      current = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || current.length) {
    current.push(field.trim());
    rows.push(current);
  }

  const headers = rows.shift().map(cleanHeader);
  return {
    headers,
    rows: rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))),
  };
}

function loadDataset(parsed, sourceName) {
  state.headers = parsed.headers;
  state.rows = parsed.rows;
  state.filteredGroups.clear();
  state.filteredUfs.clear();
  state.filteredIndicators.clear();
  populateControls();
  buildAllFilters();
  els.analyzeButton.disabled = false;
  els.warningBox.hidden = true;
  els.chartSubtitle.textContent = sourceName;
  analyze();
}

function mergeParsedCsvs(parsedFiles) {
  const headers = [];
  const seen = new Set();
  const rows = [];
  for (const parsed of parsedFiles) {
    for (const header of parsed.headers) {
      if (!seen.has(header)) {
        seen.add(header);
        headers.push(header);
      }
    }
    for (const row of parsed.rows) {
      rows.push(row);
    }
  }
  return { headers, rows };
}

function setDataStatus(message, tone = "") {
  if (!els.dataStatus) return;
  els.dataStatus.textContent = message;
  els.dataStatus.className = tone ? `status ${tone}` : "status";
}

async function loadDefaultSinespData() {
  try {
    setDataStatus("Carregando base oficial do repositorio...");
    const manifestResponse = await fetch("data/sinesp_manifest.json", { cache: "no-store" });
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      const entries = Array.isArray(manifest.files) ? manifest.files : [];
      const filePaths = entries.map((entry) => (typeof entry === "string" ? entry : entry.path)).filter(Boolean);
      if (filePaths.length) {
        const parsedFiles = await Promise.all(
          filePaths.map(async (path) => {
            const response = await fetch(resolveDataPath(path), { cache: "no-store" });
            if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
            return parseCsv(await response.text());
          }),
        );
        const parsed = mergeParsedCsvs(parsedFiles);
        loadDataset(parsed, `base oficial SINESP VDE (${filePaths.length} arquivos)`);
        setDataStatus(
          `Base oficial carregada do repositorio: ${formatInteger(parsed.rows.length)} linhas em ${filePaths.length} arquivo(s).`,
          "ok",
        );
        return;
      }
    }

    const csvResponse = await fetch("data/sinesp_vde.csv", { cache: "no-store" });
    if (!csvResponse.ok) throw new Error("data/sinesp_vde.csv nao encontrado");
    const parsed = parseCsv(await csvResponse.text());
    loadDataset(parsed, "data/sinesp_vde.csv");
    setDataStatus(`Base oficial carregada do repositorio: ${formatInteger(parsed.rows.length)} linhas.`, "ok");
  } catch (error) {
    setDataStatus(
      `Nao foi possivel carregar a base oficial em data/. Detalhe: ${error.message || error}.`,
      "error",
    );
  }
}

function resolveDataPath(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("data/") ? path : `data/${path}`;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function cleanHeader(value) {
  return value.replace(/^\uFEFF/, "").trim();
}

function populateControls() {
  fillSelect(els.dateField, state.headers);
  fillSelect(els.valueField, state.headers);
  fillSelect(els.ufField, ["(nenhum)", ...state.headers]);
  fillSelect(els.indicatorField, ["(nenhum)", ...state.headers]);
  fillSelect(els.groupField, ["(sem comparacao)", ...state.headers]);
  selectLikely(els.dateField, likelyFields.date, (value) => Boolean(parseDate(value, "auto")));
  selectLikely(els.valueField, likelyFields.value, (value) => Number.isFinite(parseNumber(value)));
  selectLikely(els.ufField, likelyFields.uf);
  selectLikely(els.indicatorField, likelyFields.indicator);
  selectLikely(els.groupField, likelyFields.group);
  if (els.groupField.value === els.indicatorField.value || els.groupField.value === els.ufField.value) {
    els.groupField.value = "(sem comparacao)";
  }
}

function fillSelect(select, options) {
  select.innerHTML = "";
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option;
    node.textContent = option;
    select.appendChild(node);
  }
}

function selectLikely(select, candidates, validator) {
  const options = Array.from(select.options);
  const match = options.find((option) => candidates.includes(normalizeHeaderForMatch(option.value)));
  if (match) select.value = match.value;
  else if (validator) select.value = inferField(validator) || select.value;
}

function inferField(validator) {
  let best = "";
  let bestScore = -1;
  for (const header of state.headers) {
    let score = 0;
    for (const row of state.rows.slice(0, 50)) {
      if (validator(row[header])) score += 1;
    }
    if (score > bestScore) {
      best = header;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : "";
}

function normalizeHeaderForMatch(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function showTwbxNotice(fileName) {
  state.rows = [];
  state.headers = [];
  els.analyzeButton.disabled = true;
  els.warningBox.hidden = false;
  els.warningBox.textContent = `${fileName} e um pacote Tableau com extrato .hyper. Este app de navegador nao consegue ler as linhas do Hyper diretamente; exporte a fonte de dados ou uma crosstab completa para CSV com as colunas uf, evento, data_referencia e total/total_vitima.`;
  els.analysisText.textContent = "Carregue um CSV exportado do Tableau para gerar a leitura por UF e indicador.";
  els.copyAnalysis.disabled = true;
}

function resetDimensionFilter(filterSet, container, builder) {
  filterSet.clear();
  container.innerHTML = "";
  builder();
  analyze();
}

function clearFilterSet(filterSet, builder) {
  filterSet.clear();
  builder();
  analyze();
}

function selectNoValues(field, filterSet, builder) {
  filterSet.clear();
  for (const value of uniqueValues(field)) {
    filterSet.add(value);
  }
  builder();
  analyze();
}

function buildAllFilters() {
  buildUfFilters();
  buildIndicatorFilters();
  buildGroupFilters();
}

function buildUfFilters() {
  buildDimensionFilter({
    field: els.ufField.value,
    container: els.ufFilters,
    filtered: state.filteredUfs,
    selectAllButton: els.selectAllUfs,
    selectNoneButton: els.selectNoUfs,
    maxValues: 40,
  });
}

function buildIndicatorFilters() {
  buildDimensionFilter({
    field: els.indicatorField.value,
    container: els.indicatorFilters,
    filtered: state.filteredIndicators,
    selectAllButton: els.selectAllIndicators,
    selectNoneButton: els.selectNoIndicators,
    maxValues: 80,
  });
}

function buildGroupFilters() {
  buildDimensionFilter({
    field: els.groupField.value,
    container: els.filters,
    filtered: state.filteredGroups,
    selectAllButton: els.selectAllGroups,
    selectNoneButton: els.selectNoGroups,
    maxValues: 80,
    emptyValue: "(sem comparacao)",
  });
}

function buildDimensionFilter({
  field,
  container,
  filtered,
  selectAllButton,
  selectNoneButton,
  maxValues,
  emptyValue = "(nenhum)",
}) {
  container.innerHTML = "";
  selectAllButton.disabled = true;
  selectNoneButton.disabled = true;
  if (!field || field === emptyValue || field === "(nenhum)") return;

  const counts = new Map();
  for (const row of state.rows) {
    const key = row[field] || "(vazio)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const values = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxValues);

  for (const [value, count] of values) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !filtered.has(value);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) filtered.delete(value);
      else filtered.add(value);
      analyze();
    });
    label.append(checkbox, `${value} (${count})`);
    container.appendChild(label);
  }
  selectAllButton.disabled = values.length === 0;
  selectNoneButton.disabled = values.length === 0;
}

function analyze() {
  if (!state.rows.length) return;
  if (!els.ufFilters.children.length && els.ufField.value !== "(nenhum)") buildUfFilters();
  if (!els.indicatorFilters.children.length && els.indicatorField.value !== "(nenhum)") buildIndicatorFilters();
  if (!els.filters.children.length && els.groupField.value !== "(sem comparacao)") buildGroupFilters();

  const dateField = els.dateField.value;
  const valueField = els.valueField.value;
  const ufField = els.ufField.value;
  const indicatorField = els.indicatorField.value;
  const groupField = els.groupField.value;
  const period = els.periodField.value;
  const windowSize = Math.max(1, Number(els.movingAverage.value) || 1);

  const buckets = new Map();
  let usedRows = 0;
  let skippedRows = 0;
  const badDateSamples = new Set();
  const badValueSamples = new Set();

  for (const row of state.rows) {
    const uf = ufField === "(nenhum)" ? "" : row[ufField] || "(vazio)";
    const indicator = indicatorField === "(nenhum)" ? "" : row[indicatorField] || "(vazio)";
    const group = groupField === "(sem comparacao)" ? "" : row[groupField] || "(vazio)";
    if (uf && state.filteredUfs.has(uf)) continue;
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (group && state.filteredGroups.has(group)) continue;

    const date = parseDate(row[dateField], els.dateFormat.value);
    const value = parseNumber(row[valueField]);
    if (!date || !Number.isFinite(value)) {
      skippedRows += 1;
      if (!date && badDateSamples.size < 3) badDateSamples.add(row[dateField]);
      if (!Number.isFinite(value) && badValueSamples.size < 3) badValueSamples.add(row[valueField]);
      continue;
    }

    const key = periodKey(date, period);
    buckets.set(key, (buckets.get(key) || 0) + value);
    usedRows += 1;
  }

  const series = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));

  addMovingAverage(series, windowSize);
  addChangeAndAnomalies(series);
  addYearOverYearChange(series, period);
  updateMetrics(series, usedRows, skippedRows);
  updateWarnings(series, skippedRows, badDateSamples, badValueSamples);
  drawChart(series);
  renderTable(series);
  renderNarrative(series, { dateField, valueField, ufField, indicatorField, groupField, period });
  renderForecast(series, { valueField, period });
  renderHighlights({ dateField, valueField, ufField, indicatorField, groupField });
  renderTerritorialGeneralization({ dateField, valueField, ufField, indicatorField, groupField });
  renderStateShare({ dateField, valueField, ufField, indicatorField, groupField });
  renderPopulationRates({ dateField, valueField, ufField, indicatorField, groupField });
  renderRateMap({ dateField, valueField, ufField, indicatorField, groupField });
  renderStateAnomalies({ dateField, valueField, ufField, indicatorField, groupField });
}

function parseDate(value, format = "auto") {
  if (!value) return null;
  const trimmed = String(value).trim();
  const normalized = normalizeDateText(trimmed);

  if (format === "excel" || (/^\d{5,6}(\.0+)?$/.test(normalized) && format === "auto")) {
    return excelSerialDate(Number(normalized));
  }

  let match = normalized.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3] || 1));

  match = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = normalizeYear(Number(match[3]));
    if (format === "mdy") return validDate(year, first, second);
    if (format === "dmy") return validDate(year, second, first);
    if (first > 12) return validDate(year, second, first);
    if (second > 12) return validDate(year, first, second);
    return validDate(year, second, first);
  }

  match = normalized.match(/^(\d{1,2})[-/](\d{4})$/);
  if (match) return validDate(Number(match[2]), Number(match[1]), 1);

  match = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
  if (match) return validDate(Number(match[1]), Number(match[2]), 1);

  match = normalized.match(/^([a-z]+)[\s/-]+(\d{4})$/);
  if (match && monthNames[match[1]] != null) return validDate(Number(match[2]), monthNames[match[1]] + 1, 1);

  match = normalized.match(/^(\d{4})[\s/-]+([a-z]+)$/);
  if (match && monthNames[match[2]] != null) return validDate(Number(match[1]), monthNames[match[2]] + 1, 1);

  return null;
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  let cleaned = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d,.\-]/g, "");

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  if (comma > -1 && dot > -1) {
    cleaned = comma > dot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (comma > -1) {
    cleaned = cleaned.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  } else if (dot > -1) {
    const decimals = cleaned.length - dot - 1;
    if (decimals === 3 && cleaned.split(".").length === 2) cleaned = cleaned.replace(".", "");
  }
  return Number(cleaned);
}

const monthNames = {
  janeiro: 0,
  jan: 0,
  fevereiro: 1,
  fev: 1,
  marco: 2,
  mar: 2,
  abril: 3,
  abr: 3,
  maio: 4,
  mai: 4,
  junho: 5,
  jun: 5,
  julho: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  setembro: 8,
  set: 8,
  outubro: 9,
  out: 9,
  novembro: 10,
  nov: 10,
  dezembro: 11,
  dez: 11,
};

function normalizeDateText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+de\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year;
}

function excelSerialDate(serial) {
  if (!Number.isFinite(serial)) return null;
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + Math.floor(serial));
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function periodKey(date, period) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (period === "year") return String(year);
  if (period === "quarter") return `${year}-T${Math.ceil(month / 3)}`;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMovingAverage(series, size) {
  for (let index = 0; index < series.length; index += 1) {
    const start = Math.max(0, index - size + 1);
    const slice = series.slice(start, index + 1);
    series[index].movingAverage = slice.reduce((sum, point) => sum + point.value, 0) / slice.length;
  }
}

function addChangeAndAnomalies(series) {
  const values = series.map((point) => point.value);
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
  const sd = Math.sqrt(variance);

  for (let index = 0; index < series.length; index += 1) {
    const prev = series[index - 1]?.value;
    series[index].change = prev ? (series[index].value - prev) / prev : 0;
    series[index].anomaly = sd > 0 && Math.abs(series[index].value - mean) / sd >= 2;
  }
}

function addYearOverYearChange(series, period) {
  const offset = period === "month" ? 12 : period === "quarter" ? 4 : 1;
  for (let index = 0; index < series.length; index += 1) {
    const previous = series[index - offset];
    const expectedKey = previous ? comparablePriorKey(series[index].key, period) : "";
    if (previous && previous.key === expectedKey && previous.value) {
      series[index].yearOverYearChange = (series[index].value - previous.value) / previous.value;
    } else {
      series[index].yearOverYearChange = null;
    }
  }
}

function comparablePriorKey(key, period) {
  if (period === "year") return String(Number(key) - 1);
  if (period === "quarter") {
    const [year, quarter] = key.split("-T");
    return `${Number(year) - 1}-T${quarter}`;
  }
  const [year, month] = key.split("-");
  return `${Number(year) - 1}-${month}`;
}

function updateMetrics(series, usedRows, skippedRows) {
  const total = series.reduce((sum, point) => sum + point.value, 0);
  const slope = linearSlope(series.map((point, index) => [index, point.value]));
  const anomalies = series.filter((point) => point.anomaly).length;

  els.rowCount.textContent = usedRows.toLocaleString("pt-BR");
  els.totalValue.textContent = formatNumber(total);
  els.trendValue.textContent = slope > 0 ? `Alta (${formatNumber(slope)}/periodo)` : slope < 0 ? `Queda (${formatNumber(slope)}/periodo)` : "Estavel";
  els.trendValue.className = slope > 0 ? "up" : slope < 0 ? "down" : "flat";
  els.anomalyCount.textContent = anomalies.toLocaleString("pt-BR");
  els.skippedRows.textContent = skippedRows.toLocaleString("pt-BR");
  els.chartSubtitle.textContent = `${series.length} periodos analisados`;
}

function updateWarnings(series, skippedRows, badDateSamples, badValueSamples) {
  const messages = [];
  if (skippedRows > 0) {
    messages.push(`${skippedRows.toLocaleString("pt-BR")} linhas foram ignoradas por data ou valor invalido.`);
  }
  if (badDateSamples.size) {
    messages.push(`Amostras de data nao lidas: ${Array.from(badDateSamples).join(", ")}.`);
  }
  if (badValueSamples.size) {
    messages.push(`Amostras de valor nao lidas: ${Array.from(badValueSamples).join(", ")}.`);
  }
  if (series.length && hasGaps(series)) {
    messages.push("Ha meses sem registros na serie. Se esses meses deveriam aparecer, verifique o formato da data ou exporte a tabela de dados completa, nao apenas a crosstab agregada.");
  }
  els.warningBox.hidden = messages.length === 0;
  els.warningBox.textContent = messages.join(" ");
}

function hasGaps(series) {
  if (els.periodField.value !== "month" || series.length < 2) return false;
  for (let index = 1; index < series.length; index += 1) {
    const [previousYear, previousMonth] = series[index - 1].key.split("-").map(Number);
    const [year, month] = series[index].key.split("-").map(Number);
    const distance = (year - previousYear) * 12 + (month - previousMonth);
    if (distance > 1) return true;
  }
  return false;
}

function linearSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((sum, point) => sum + point[0], 0);
  const sumY = points.reduce((sum, point) => sum + point[1], 0);
  const sumXY = points.reduce((sum, point) => sum + point[0] * point[1], 0);
  const sumXX = points.reduce((sum, point) => sum + point[0] ** 2, 0);
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2);
}

function drawChart(series) {
  const svg = els.chart;
  const width = svg.clientWidth || 900;
  const height = svg.clientHeight || 410;
  const pad = { top: 20, right: 24, bottom: 46, left: 70 };
  const values = series.flatMap((point) => [point.value, point.movingAverage]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const xStep = series.length > 1 ? (width - pad.left - pad.right) / (series.length - 1) : 0;
  const y = (value) => height - pad.bottom - ((value - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const x = (index) => pad.left + index * xStep;
  const path = (field) => series.map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point[field])}`).join(" ");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#cfd8d5" />
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#cfd8d5" />
    <text x="${pad.left - 8}" y="${y(max) + 4}" text-anchor="end" font-size="12" fill="#647075">${formatNumber(max)}</text>
    <text x="${pad.left - 8}" y="${y(min) + 4}" text-anchor="end" font-size="12" fill="#647075">${formatNumber(min)}</text>
    <path d="${path("value")}" fill="none" stroke="#2563eb" stroke-width="3" />
    <path d="${path("movingAverage")}" fill="none" stroke="#0f766e" stroke-width="3" stroke-dasharray="7 5" />
    ${series
      .map((point, index) => `<circle cx="${x(index)}" cy="${y(point.value)}" r="${point.anomaly ? 5 : 3}" fill="${point.anomaly ? "#b42318" : "#2563eb"}"><title>${point.key}: ${formatNumber(point.value)}</title></circle>`)
      .join("")}
    <text x="${pad.left}" y="${height - 14}" font-size="12" fill="#647075">${series[0]?.key || ""}</text>
    <text x="${width - pad.right}" y="${height - 14}" text-anchor="end" font-size="12" fill="#647075">${series.at(-1)?.key || ""}</text>
  `;
}

function renderTable(series) {
  els.summaryBody.innerHTML = "";
  for (const point of series) {
    const tr = document.createElement("tr");
    const direction = point.change > 0 ? "up" : point.change < 0 ? "down" : "flat";
    const yoyDirection = point.yearOverYearChange > 0 ? "up" : point.yearOverYearChange < 0 ? "down" : "flat";
    tr.innerHTML = `
      <td>${point.key}</td>
      <td>${formatNumber(point.value)}</td>
      <td>${formatNumber(point.movingAverage)}</td>
      <td class="${direction}">${formatPercent(point.change)}</td>
      <td class="${yoyDirection}">${formatOptionalPercent(point.yearOverYearChange)}</td>
      <td>${point.anomaly ? "Anomalia" : "Normal"}</td>
    `;
    els.summaryBody.appendChild(tr);
  }
}

function renderNarrative(series, context) {
  if (!series.length) {
    els.analysisText.textContent = "Nao ha pontos validos suficientes para analisar a serie.";
    els.copyAnalysis.disabled = true;
    return;
  }

  const total = series.reduce((sum, point) => sum + point.value, 0);
  const first = series[0];
  const last = series.at(-1);
  const peak = maxBy(series, (point) => point.value);
  const trough = minBy(series, (point) => point.value);
  const slope = linearSlope(series.map((point, index) => [index, point.value]));
  const overallChange = first.value ? (last.value - first.value) / first.value : 0;
  const average = total / series.length;
  const volatility = coefficientOfVariation(series.map((point) => point.value));
  const abrupt = abruptChanges(series).slice(0, 4);
  const seasonal = seasonalitySummary(series, context.period);
  const yoy = yearOverYearSummary(series);
  const anomalies = series.filter((point) => point.anomaly);
  const direction = slope > average * 0.01 ? "alta" : slope < -average * 0.01 ? "queda" : "estabilidade";
  const intensity =
    Math.abs(overallChange) >= 0.5 ? "forte" : Math.abs(overallChange) >= 0.15 ? "moderada" : "suave";
  const anomalyText = anomalies.length
    ? `Pelo criterio estatistico simples de dois desvios-padrao, ${anomalies.length} ponto(s) tambem foram marcados como anomalia: ${anomalies
        .map((point) => point.key)
        .slice(0, 6)
        .join(", ")}.`
    : "Nenhum ponto ultrapassou o criterio simples de anomalia por dois desvios-padrao, mas as variacoes percentuais ainda ajudam a localizar rupturas operacionais ou mudancas de cobertura da base.";
  const abruptText = abrupt.length
    ? `As quebras mais abruptas aparecem em ${abrupt.map((item) => `${item.key} (${formatPercent(item.change)} frente ao periodo anterior)`).join(", ")}. ${anomalyText}`
    : `A serie nao apresenta quebras abruptas expressivas entre periodos consecutivos. ${anomalyText}`;

  const paragraphs = [
    `A serie historica de ${context.valueField}${activeFilterSummary(context)} cobre ${series.length} periodos, de ${first.key} a ${last.key}, somando ${formatNumber(total)} no intervalo. O primeiro periodo registra ${formatNumber(first.value)} e o ultimo ${formatNumber(last.value)}, o que representa uma variacao acumulada de ${formatPercent(overallChange)}. Pela inclinacao estimada da reta de tendencia, a leitura geral e de ${direction} ${intensity}, com mudanca media aproximada de ${formatNumber(slope)} por periodo.`,
    `O maior valor observado ocorre em ${peak.key}, com ${formatNumber(peak.value)}, enquanto o menor aparece em ${trough.key}, com ${formatNumber(trough.value)}. A media da serie e ${formatNumber(average)} por periodo. A volatilidade relativa e ${formatPercent(volatility)}, ${volatility >= 0.25 ? "indicando oscilacao relevante em torno da media" : volatility >= 0.12 ? "sugerindo variacao moderada" : "sugerindo uma serie relativamente regular"}.`,
    seasonal,
    yoy,
    abruptText,
    `Como leitura substantiva, vale tratar picos e quedas abruptas como pistas, nao como conclusoes finais. Em dados criminais, mudancas desse tipo podem refletir alteracao real da violencia, sazonalidade, revisao metodologica, atraso de registro, mudanca de cobertura territorial ou diferencas na forma de consolidacao do indicador. O proximo passo analitico recomendado e cruzar esses pontos com filtros por UF, municipio e tipo de evento, quando a base completa estiver disponivel.`,
  ];

  els.analysisText.innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyAnalysis.disabled = false;
}

function renderForecast(series, context) {
  if (series.length < 3) {
    els.forecastText.textContent = "Sao necessarios pelo menos 3 periodos validos para calcular uma projecao linear.";
    els.forecastBody.innerHTML = '<tr><td colspan="3">Sem projeção ainda.</td></tr>';
    els.copyForecast.disabled = true;
    return;
  }

  const points = series.map((point, index) => [index, point.value]);
  const slope = linearSlope(points);
  const intercept = linearIntercept(points, slope);
  const forecast = [];
  for (let step = 1; step <= 3; step += 1) {
    const index = series.length - 1 + step;
    forecast.push({
      key: nextPeriodKey(series.at(-1).key, context.period, step),
      value: Math.max(0, intercept + slope * index),
    });
  }

  renderForecastTable(forecast);
  const direction = slope > 0 ? "alta" : slope < 0 ? "queda" : "estabilidade";
  const text = [
    `A projecao linear para os proximos 3 periodos usa todos os pontos atualmente filtrados da serie ${context.valueField}. A inclinacao estimada e de ${formatNumber(slope)} por periodo, indicando continuidade de ${direction} caso o padrao medio recente da serie se mantenha.`,
    `Os valores projetados sao ${forecast.map((point) => `${point.key}: ${formatNumber(point.value)}`).join(", ")}. Esta e uma extrapolacao simples de tendencia; ela nao incorpora sazonalidade, mudancas metodologicas, choques locais ou revisoes futuras da base.`,
  ];
  els.forecastText.innerHTML = text.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyForecast.disabled = false;
}

function renderForecastTable(forecast) {
  els.forecastBody.innerHTML = "";
  for (const point of forecast) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${point.key}</td>
      <td>${formatNumber(point.value)}</td>
      <td>regressao linear</td>
    `;
    els.forecastBody.appendChild(tr);
  }
}

function renderHighlights(context) {
  if (!state.rows.length || !context.indicatorField || context.indicatorField === "(nenhum)") {
    resetHighlightsPanel("Carregue uma base com campo de evento para gerar os destaques.");
    return;
  }

  const locationField = preferredHighlightLocationField(context);
  if (!locationField) {
    resetHighlightsPanel("Carregue uma base com coluna de municipio ou UF para localizar os destaques.");
    return;
  }

  const latestMonths = latestAvailableMonths(context.dateField, context);
  if (latestMonths.length < 3) {
    resetHighlightsPanel("Sao necessarios pelo menos 3 meses recentes validos para calcular os destaques.");
    return;
  }

  const priorMonths = latestMonths.map((month) => priorYearMonthKey(month));
  const threshold = Math.max(0, Number(els.highlightThreshold.value) || 10) / 100;
  const topN = Math.max(5, Number(els.highlightTopN.value) || 30);
  const totals = new Map();

  for (const row of state.rows) {
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    const value = parseNumber(row[context.valueField]);
    if (!date || !Number.isFinite(value)) continue;

    const month = periodKey(date, "month");
    const periodType = latestMonths.includes(month) ? "current" : priorMonths.includes(month) ? "prior" : "";
    if (!periodType) continue;

    const event = row[context.indicatorField] || "(vazio)";
    const location = row[locationField] || "(vazio)";
    const uf = context.ufField && context.ufField !== "(nenhum)" ? row[context.ufField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (state.filteredIndicators.has(event)) continue;
    if (uf && state.filteredUfs.has(uf)) continue;
    if (group && state.filteredGroups.has(group)) continue;

    const key = `${event}\u0001${location}`;
    const item = totals.get(key) || { event, location, current: 0, prior: 0 };
    item[periodType] += value;
    totals.set(key, item);
  }

  const highlights = Array.from(totals.values())
    .filter((item) => item.prior > 0 && (item.current - item.prior) / item.prior > threshold)
    .map((item) => ({
      ...item,
      change: (item.current - item.prior) / item.prior,
      delta: item.current - item.prior,
    }))
    .sort((a, b) => b.change - a.change || b.delta - a.delta);

  renderHighlightsTable(highlights.slice(0, topN), `${latestMonths[0]} a ${latestMonths.at(-1)}`);
  renderHighlightsText({
    highlights,
    locationField,
    latestMonths,
    priorMonths,
    threshold,
    topN,
  });
}

function preferredHighlightLocationField(context) {
  const municipality = findHeader(state.headers, ["municipio", "município", "cidade", "nome municipio"]);
  if (municipality) return municipality;
  if (context.ufField && context.ufField !== "(nenhum)") return context.ufField;
  return findHeader(state.headers, ["uf", "estado", "sigla uf", "unidade federativa"]);
}

function latestAvailableMonths(dateField, context) {
  const months = new Set();
  for (const row of state.rows) {
    const event = context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const uf = context.ufField && context.ufField !== "(nenhum)" ? row[context.ufField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (event && state.filteredIndicators.has(event)) continue;
    if (uf && state.filteredUfs.has(uf)) continue;
    if (group && state.filteredGroups.has(group)) continue;
    const date = parseDate(row[dateField], els.dateFormat.value);
    if (date) months.add(periodKey(date, "month"));
  }
  return Array.from(months).sort().slice(-3);
}

function priorYearMonthKey(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${Number(year) - 1}-${month}`;
}

function renderHighlightsTable(highlights, periodLabel) {
  els.highlightBody.innerHTML = "";
  if (!highlights.length) {
    els.highlightBody.innerHTML = '<tr><td colspan="6">Nenhum evento/local ultrapassou o limiar configurado.</td></tr>';
    return;
  }
  for (const item of highlights) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.event}</td>
      <td>${item.location}</td>
      <td>${formatNumber(item.current)}</td>
      <td>${formatNumber(item.prior)}</td>
      <td class="up">${formatPercent(item.change)}</td>
      <td>${periodLabel}</td>
    `;
    els.highlightBody.appendChild(tr);
  }
}

function renderHighlightsText(details) {
  const { highlights, locationField, latestMonths, priorMonths, threshold, topN } = details;
  const periodLabel = `${latestMonths[0]} a ${latestMonths.at(-1)}`;
  const priorLabel = `${priorMonths[0]} a ${priorMonths.at(-1)}`;
  const top = highlights.slice(0, Math.min(topN, 6));
  const locationLevel = normalizeHeaderForMatch(locationField).includes("municipio") ? "municipio" : "UF";

  els.highlightCount.textContent = highlights.length.toLocaleString("pt-BR");
  els.highlightPeriod.textContent = periodLabel;
  els.highlightLocationLevel.textContent = locationLevel.toUpperCase();
  els.highlightMax.textContent = highlights.length ? formatPercent(highlights[0].change) : "-";

  if (!highlights.length) {
    els.highlightText.innerHTML = `<p>No periodo ${periodLabel}, nenhum evento/local selecionado apresentou aumento superior a ${formatPercent(threshold)} em relacao ao mesmo periodo do ano anterior (${priorLabel}).</p>`;
    els.copyHighlights.disabled = false;
    return;
  }

  const topText = top
    .map((item) => `${item.event} em ${item.location} (${formatPercent(item.change)}, de ${formatNumber(item.prior)} para ${formatNumber(item.current)})`)
    .join("; ");
  const paragraphs = [
    `No periodo ${periodLabel}, comparado ao mesmo periodo do ano anterior (${priorLabel}), foram encontrados ${highlights.length.toLocaleString("pt-BR")} destaques com aumento superior a ${formatPercent(threshold)} no nivel de ${locationLevel}.`,
    `Os principais pontos de atencao sao ${topText}. Esses casos combinam crescimento recente e localizacao territorial, ajudando a priorizar onde o poder publico deve olhar primeiro.`,
    `A lista usa apenas os eventos atualmente selecionados no filtro Indicador e respeita os filtros de UF e filtro extra. Locais sem ocorrencias no periodo anterior nao entram no ranking percentual, para evitar aumentos infinitos causados por base zero.`,
  ];
  els.highlightText.innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyHighlights.disabled = false;
}

function resetHighlightsPanel(message) {
  els.highlightCount.textContent = "0";
  els.highlightPeriod.textContent = "-";
  els.highlightLocationLevel.textContent = "-";
  els.highlightMax.textContent = "-";
  els.highlightText.textContent = message;
  els.highlightBody.innerHTML = '<tr><td colspan="6">Sem destaques ainda.</td></tr>';
  els.copyHighlights.disabled = true;
}

function linearIntercept(points, slope) {
  if (!points.length) return 0;
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return meanY - slope * meanX;
}

function nextPeriodKey(key, period, step) {
  if (period === "year") return String(Number(key) + step);
  if (period === "quarter") {
    const [yearText, quarterText] = key.split("-T");
    const current = Number(yearText) * 4 + Number(quarterText) - 1 + step;
    const year = Math.floor(current / 4);
    const quarter = (current % 4) + 1;
    return `${year}-T${quarter}`;
  }
  const [yearText, monthText] = key.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1 + step, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearOverYearSummary(series) {
  const valid = series.filter((point) => Number.isFinite(point.yearOverYearChange));
  if (!valid.length) {
    return "Ainda nao ha pares suficientes para comparar cada periodo com o mesmo periodo do ano anterior.";
  }
  const latest = valid.at(-1);
  const average = valid.reduce((sum, point) => sum + point.yearOverYearChange, 0) / valid.length;
  const falls = valid.filter((point) => point.yearOverYearChange < 0).length;
  const rises = valid.filter((point) => point.yearOverYearChange > 0).length;
  return `Na comparacao com o mesmo periodo do ano anterior, a ultima variacao disponivel e ${formatPercent(latest.yearOverYearChange)} em ${latest.key}. Ao longo da serie, ${falls} periodos ficaram abaixo do mesmo periodo do ano anterior e ${rises} ficaram acima; a variacao media interanual e ${formatPercent(average)}. Essa medida ajuda a reduzir leituras enviesadas por sazonalidade.`;
}

function renderTerritorialGeneralization(context) {
  if (!state.rows.length || !context.ufField || context.ufField === "(nenhum)") {
    resetTerritorialPanel("Carregue um CSV com coluna de UF para avaliar se a tendencia e generalizada ou concentrada.");
    return;
  }

  const preStart = Number(els.preStart.value);
  const preEnd = Number(els.preEnd.value);
  const postStart = Number(els.postStart.value);
  const postEnd = Number(els.postEnd.value);
  const threshold = Math.max(0, Number(els.territorialThreshold.value) || 0) / 100;

  if (!preStart || !preEnd || !postStart || !postEnd || preStart > preEnd || postStart > postEnd) {
    resetTerritorialPanel("Defina janelas pre e pos validas para comparar a mudanca por UF.");
    return;
  }

  const byUf = new Map();
  let nationalPre = 0;
  let nationalPost = 0;
  let preRows = 0;
  let postRows = 0;

  for (const row of state.rows) {
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    const value = parseNumber(row[context.valueField]);
    if (!date || !Number.isFinite(value)) continue;

    const uf = row[context.ufField] || "(vazio)";
    const indicator =
      context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (state.filteredUfs.has(uf)) continue;
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (group && state.filteredGroups.has(group)) continue;

    const year = date.getFullYear();
    const bucket = byUf.get(uf) || { uf, pre: 0, post: 0, prePeriods: new Set(), postPeriods: new Set() };
    if (year >= preStart && year <= preEnd) {
      bucket.pre += value;
      bucket.prePeriods.add(periodKey(date, "month"));
      nationalPre += value;
      preRows += 1;
    } else if (year >= postStart && year <= postEnd) {
      bucket.post += value;
      bucket.postPeriods.add(periodKey(date, "month"));
      nationalPost += value;
      postRows += 1;
    }
    byUf.set(uf, bucket);
  }

  const ufResults = Array.from(byUf.values())
    .map((item) => {
      const preAverage = item.prePeriods.size ? item.pre / item.prePeriods.size : 0;
      const postAverage = item.postPeriods.size ? item.post / item.postPeriods.size : 0;
      const change = preAverage ? (postAverage - preAverage) / preAverage : null;
      return {
        uf: item.uf,
        preAverage,
        postAverage,
        change,
        className: classifyChange(change, threshold),
      };
    })
    .filter((item) => item.change !== null && item.preAverage > 0 && item.postAverage > 0)
    .sort((a, b) => a.change - b.change);

  if (!ufResults.length || !preRows || !postRows) {
    resetTerritorialPanel("Nao ha dados suficientes nas janelas pre e pos para comparar as UFs selecionadas.");
    return;
  }

  const falling = ufResults.filter((item) => item.change < -threshold);
  const rising = ufResults.filter((item) => item.change > threshold);
  const stable = ufResults.length - falling.length - rising.length;
  const medianChange = median(ufResults.map((item) => item.change));
  const nationalChangeValue = nationalPre ? (nationalPost / postWindowMonths(postStart, postEnd) - nationalPre / postWindowMonths(preStart, preEnd)) / (nationalPre / postWindowMonths(preStart, preEnd)) : 0;
  const diagnosis = generalizationDiagnosis(falling.length, rising.length, stable, ufResults.length, medianChange, nationalChangeValue, threshold);

  els.fallingUfCount.textContent = `${falling.length}/${ufResults.length}`;
  els.medianUfChange.textContent = formatPercent(medianChange);
  els.medianUfChange.className = medianChange < -threshold ? "down" : medianChange > threshold ? "up" : "flat";
  els.nationalChange.textContent = formatPercent(nationalChangeValue);
  els.nationalChange.className = nationalChangeValue < -threshold ? "down" : nationalChangeValue > threshold ? "up" : "flat";
  els.generalizationLabel.textContent = diagnosis.label;
  els.generalizationLabel.className = diagnosis.className;

  renderTerritorialTable(ufResults);
  renderTerritorialText({
    ufResults,
    falling,
    rising,
    stable,
    medianChange,
    nationalChangeValue,
    diagnosis,
    threshold,
    preStart,
    preEnd,
    postStart,
    postEnd,
    context,
  });
}

function resetTerritorialPanel(message) {
  els.fallingUfCount.textContent = "0";
  els.medianUfChange.textContent = "-";
  els.nationalChange.textContent = "-";
  els.generalizationLabel.textContent = "-";
  els.territorialText.textContent = message;
  els.territorialBody.innerHTML = '<tr><td colspan="5">Sem dados territoriais ainda.</td></tr>';
  els.copyTerritorial.disabled = true;
}

function classifyChange(change, threshold) {
  if (change === null || !Number.isFinite(change)) return "sem dado";
  if (change <= -threshold * 2) return "queda forte";
  if (change < -threshold) return "queda moderada";
  if (change >= threshold * 2) return "aumento forte";
  if (change > threshold) return "aumento moderado";
  return "estavel";
}

function generalizationDiagnosis(falling, rising, stable, total, medianChange, nationalChangeValue, threshold) {
  const shareFalling = falling / total;
  const shareRising = rising / total;
  if (nationalChangeValue < -threshold && medianChange < -threshold && shareFalling >= 0.7) {
    return { label: "queda generalizada", className: "down" };
  }
  if (nationalChangeValue < -threshold && shareFalling >= 0.5) {
    return { label: "queda ampla, mas desigual", className: "down" };
  }
  if (nationalChangeValue < -threshold && medianChange >= -threshold) {
    return { label: "queda concentrada", className: "flat" };
  }
  if (nationalChangeValue > threshold && medianChange > threshold && shareRising >= 0.7) {
    return { label: "aumento generalizado", className: "up" };
  }
  if (Math.abs(nationalChangeValue) <= threshold && stable / total >= 0.5) {
    return { label: "estabilidade ampla", className: "flat" };
  }
  if (shareFalling >= 0.4 && shareRising >= 0.4) {
    return { label: "padrao divergente", className: "flat" };
  }
  return { label: "mudanca heterogenea", className: "flat" };
}

function renderTerritorialTable(results) {
  els.territorialBody.innerHTML = "";
  for (const item of results) {
    const direction = item.change < 0 ? "down" : item.change > 0 ? "up" : "flat";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.uf}</td>
      <td>${formatNumber(item.preAverage)}</td>
      <td>${formatNumber(item.postAverage)}</td>
      <td class="${direction}">${formatPercent(item.change)}</td>
      <td>${item.className}</td>
    `;
    els.territorialBody.appendChild(tr);
  }
}

function renderTerritorialText(details) {
  const {
    ufResults,
    falling,
    rising,
    stable,
    medianChange,
    nationalChangeValue,
    diagnosis,
    threshold,
    preStart,
    preEnd,
    postStart,
    postEnd,
    context,
  } = details;
  const strongestFalls = falling.slice(0, 5).map((item) => `${item.uf} (${formatPercent(item.change)})`);
  const strongestRises = rising
    .slice()
    .sort((a, b) => b.change - a.change)
    .slice(0, 5)
    .map((item) => `${item.uf} (${formatPercent(item.change)})`);
  const selectedIndicators = selectedFilterLabel(context.indicatorField, state.filteredIndicators);
  const scopeText = selectedIndicators ? ` para o indicador ${selectedIndicators}` : "";
  const paragraphs = [
    `A comparacao territorial${scopeText} usa ${preStart}-${preEnd} como periodo pre e ${postStart}-${postEnd} como periodo pos. Considerando um limiar de relevancia de ${formatPercent(threshold)}, ${falling.length} de ${ufResults.length} UFs apresentam queda, ${rising.length} apresentam aumento e ${stable} ficam em faixa de estabilidade. A variacao mediana das UFs e ${formatPercent(medianChange)}, enquanto o Brasil agregado varia ${formatPercent(nationalChangeValue)}.`,
    `O diagnostico automatico e: ${diagnosis.label}. Essa classificacao compara tres sinais: a direcao do agregado nacional, a mediana estadual e a proporcao de UFs que se movem na mesma direcao. Quando o agregado cai mas a mediana estadual nao acompanha, a queda tende a estar concentrada em poucas UFs de maior peso. Quando ambos caem e a maioria das UFs tambem cai, a evidencia favorece uma queda territorialmente generalizada.`,
    `${strongestFalls.length ? `As quedas mais fortes aparecem em ${strongestFalls.join(", ")}.` : "Nenhuma UF supera o limiar de queda relevante."} ${strongestRises.length ? `Na direcao oposta, os maiores aumentos aparecem em ${strongestRises.join(", ")}.` : "Nenhuma UF supera o limiar de aumento relevante."}`,
  ];
  els.territorialText.innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyTerritorial.disabled = false;
}

function renderStateShare(context) {
  if (!state.rows.length || !context.ufField || context.ufField === "(nenhum)") {
    resetSharePanel("Carregue um CSV com coluna de UF para calcular a participacao estadual por indicador.");
    return;
  }

  const startYear = Number(els.shareStart.value);
  const endYear = Number(els.shareEnd.value);
  const topN = Math.max(1, Number(els.shareTopN.value) || 5);
  if (!startYear || !endYear || startYear > endYear) {
    resetSharePanel("Defina um intervalo de anos valido para calcular a participacao dos estados.");
    return;
  }

  const totals = new Map();
  let grandTotal = 0;

  for (const row of state.rows) {
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    const value = parseNumber(row[context.valueField]);
    if (!date || !Number.isFinite(value)) continue;
    const year = date.getFullYear();
    if (year < startYear || year > endYear) continue;

    const uf = row[context.ufField] || "(vazio)";
    const indicator =
      context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (state.filteredUfs.has(uf)) continue;
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (group && state.filteredGroups.has(group)) continue;

    totals.set(uf, (totals.get(uf) || 0) + value);
    grandTotal += value;
  }

  const shares = Array.from(totals.entries())
    .map(([uf, total]) => ({
      uf,
      total,
      share: grandTotal ? total / grandTotal : 0,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.share - a.share);

  if (!shares.length || !grandTotal) {
    resetSharePanel("Nao ha dados suficientes no intervalo escolhido para calcular a participacao estadual.");
    return;
  }

  const top = shares.slice(0, Math.min(topN, shares.length));
  const topShare = top.reduce((sum, item) => sum + item.share, 0);
  const medianShareValue = median(shares.map((item) => item.share));
  const concentration = shareConcentrationLabel(topShare, top.length);

  els.topShareUf.textContent = `${shares[0].uf} (${formatPercent(shares[0].share)})`;
  els.topShareTotal.textContent = formatPercent(topShare);
  els.medianShare.textContent = formatPercent(medianShareValue);
  els.shareConcentration.textContent = concentration.label;
  els.shareConcentration.className = concentration.className;

  renderShareTable(shares);
  renderShareText({
    shares,
    top,
    topShare,
    medianShareValue,
    concentration,
    startYear,
    endYear,
    grandTotal,
    context,
  });
}

function resetSharePanel(message) {
  els.topShareUf.textContent = "-";
  els.topShareTotal.textContent = "-";
  els.medianShare.textContent = "-";
  els.shareConcentration.textContent = "-";
  els.shareText.textContent = message;
  els.shareBody.innerHTML = '<tr><td colspan="4">Sem dados de participacao ainda.</td></tr>';
  els.copyShare.disabled = true;
}

function shareConcentrationLabel(topShare, topN) {
  if (topShare >= 0.65) return { label: `alta no top ${topN}`, className: "up" };
  if (topShare >= 0.45) return { label: `moderada no top ${topN}`, className: "flat" };
  return { label: `dispersa no top ${topN}`, className: "down" };
}

function renderShareTable(shares) {
  els.shareBody.innerHTML = "";
  shares.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.uf}</td>
      <td>${formatNumber(item.total)}</td>
      <td>${formatPercent(item.share)}</td>
      <td>${index + 1}</td>
    `;
    els.shareBody.appendChild(tr);
  });
}

function renderShareText(details) {
  const { shares, top, topShare, medianShareValue, concentration, startYear, endYear, grandTotal, context } = details;
  const selectedIndicators = selectedFilterLabel(context.indicatorField, state.filteredIndicators);
  const scopeText = selectedIndicators ? ` para o indicador ${selectedIndicators}` : "";
  const topText = top.map((item) => `${item.uf} (${formatPercent(item.share)})`).join(", ");
  const bottom = shares
    .slice()
    .sort((a, b) => a.share - b.share)
    .slice(0, Math.min(5, shares.length))
    .map((item) => `${item.uf} (${formatPercent(item.share)})`)
    .join(", ");

  const paragraphs = [
    `Entre ${startYear} e ${endYear}, a base soma ${formatNumber(grandTotal)} em ${context.valueField}${scopeText}. O estado com maior participacao e ${shares[0].uf}, com ${formatPercent(shares[0].share)} do total analisado. A participacao mediana das UFs e ${formatPercent(medianShareValue)}, o que ajuda a separar o peso tipico estadual dos estados que puxam o agregado nacional.`,
    `As ${top.length} UFs de maior peso concentram ${formatPercent(topShare)} do total: ${topText}. A classificacao automatica e de concentracao ${concentration.label}. Quando poucos estados concentram grande parte dos casos, mudancas nesses estados podem alterar fortemente a tendencia nacional mesmo sem movimento semelhante na maioria das UFs.`,
    `Na outra ponta, as menores participacoes no periodo sao ${bottom}. Para interpretar tendencias nacionais, compare esta tabela com o modulo de generalizacao territorial: se os estados com maior participacao tambem sao os que mais caem ou sobem, o agregado nacional pode estar refletindo sobretudo esses territorios.`,
  ];

  els.shareText.innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyShare.disabled = false;
}

async function loadDefaultPopulation() {
  try {
    const response = await fetch("data/populacao_uf_ano.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    loadPopulationCsv(text, "data/populacao_uf_ano.csv");
    if (state.rows.length) analyze();
  } catch (error) {
    els.populationStatus.textContent =
      "Base padrao nao carregada neste ambiente. No GitHub Pages ela carrega automaticamente; em arquivo local, use o seletor acima.";
  }
}

function loadPopulationCsv(text, sourceName) {
  const parsed = parseCsv(text);
  const ufField = findHeader(parsed.headers, ["uf", "sigla", "sigla uf", "estado"]);
  const yearField = findHeader(parsed.headers, ["ano", "year"]);
  const populationField = findHeader(parsed.headers, ["populacao", "população", "population", "valor"]);
  const sourceField = findHeader(parsed.headers, ["fonte", "source"]);

  state.populationRows = [];
  state.populationByUfYear.clear();

  if (!ufField || !yearField || !populationField) {
    els.populationStatus.textContent = "A base populacional precisa ter colunas UF, ano e populacao.";
    resetPopulationRatePanel("Nao foi possivel ler a base populacional.");
    return;
  }

  for (const row of parsed.rows) {
    const uf = normalizeUf(row[ufField]);
    const year = Number(row[yearField]);
    const population = parseNumber(row[populationField]);
    if (!uf || !Number.isInteger(year) || !Number.isFinite(population) || population <= 0) continue;
    const item = {
      uf,
      year,
      population,
      source: sourceField ? row[sourceField] : sourceName,
    };
    state.populationRows.push(item);
    state.populationByUfYear.set(`${uf}|${year}`, item);
  }

  const years = Array.from(new Set(state.populationRows.map((row) => row.year))).sort((a, b) => a - b);
  els.populationStatus.textContent = state.populationRows.length
    ? `Base populacional carregada: ${state.populationRows.length.toLocaleString("pt-BR")} UF-anos, ${years[0]}-${years[years.length - 1]}.`
    : "Nenhuma linha valida encontrada na base populacional.";
}

function findHeader(headers, candidates) {
  const normalized = new Map(headers.map((header) => [normalizeFieldName(header), header]));
  for (const candidate of candidates) {
    const match = normalized.get(normalizeFieldName(candidate));
    if (match) return match;
  }
  return "";
}

function normalizeFieldName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ufNameToCode = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const ufToIbgeCode = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

const ibgeCodeToUf = Object.fromEntries(Object.entries(ufToIbgeCode).map(([uf, code]) => [code, uf]));
const mapColors = ["#f7fbff", "#d8eef4", "#9bd0df", "#56a6c0", "#1d6f8a", "#083f5a"];

function normalizeUf(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ufNameToCode[normalized] || upper;
}

function renderPopulationRates(context) {
  if (!state.rows.length || !context.ufField || context.ufField === "(nenhum)") {
    resetPopulationRatePanel("Carregue um CSV com coluna de UF para calcular taxas por 100 mil habitantes.");
    return;
  }

  if (!state.populationByUfYear.size) {
    resetPopulationRatePanel("Carregue a base de populacao para calcular taxas estaduais por 100 mil habitantes.");
    return;
  }

  const startYear = Number(els.populationStart.value);
  const endYear = Number(els.populationEnd.value);
  if (!startYear || !endYear || startYear > endYear) {
    resetPopulationRatePanel("Defina um intervalo de anos valido para calcular taxas por 100 mil habitantes.");
    return;
  }

  const byUfYear = new Map();
  for (const row of state.rows) {
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    const value = parseNumber(row[context.valueField]);
    if (!date || !Number.isFinite(value)) continue;

    const year = date.getFullYear();
    if (year < startYear || year > endYear) continue;

    const uf = row[context.ufField] || "(vazio)";
    const normalizedUf = normalizeUf(uf);
    const indicator =
      context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (state.filteredUfs.has(uf)) continue;
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (group && state.filteredGroups.has(group)) continue;

    const key = `${normalizedUf}|${year}`;
    const current = byUfYear.get(key) || { uf: normalizedUf, year, cases: 0 };
    current.cases += value;
    byUfYear.set(key, current);
  }

  const byUf = new Map();
  let matchedUfYears = 0;
  let missingUfYears = 0;

  for (const item of byUfYear.values()) {
    const population = state.populationByUfYear.get(`${item.uf}|${item.year}`);
    if (!population) {
      missingUfYears += 1;
      continue;
    }
    const current = byUf.get(item.uf) || { uf: item.uf, cases: 0, population: 0, years: new Set(), sources: new Set() };
    current.cases += item.cases;
    current.population += population.population;
    current.years.add(item.year);
    current.sources.add(population.source);
    byUf.set(item.uf, current);
    matchedUfYears += 1;
  }

  const rates = Array.from(byUf.values())
    .map((item) => ({
      ...item,
      rate: item.population ? (item.cases / item.population) * 100000 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  if (!rates.length) {
    resetPopulationRatePanel("Nao houve cruzamento entre os dados criminais filtrados e a base populacional carregada.");
    return;
  }

  renderPopulationRateTable(rates);
  renderPopulationRateText({
    rates,
    matchedUfYears,
    missingUfYears,
    startYear,
    endYear,
    context,
  });
}

function resetPopulationRatePanel(message) {
  els.topRateUf.textContent = "-";
  els.medianRate.textContent = "-";
  els.populationYearsUsed.textContent = "0";
  els.populationCoverage.textContent = "-";
  els.populationText.textContent = message;
  els.populationBody.innerHTML = '<tr><td colspan="5">Sem taxas ainda.</td></tr>';
  els.copyPopulation.disabled = true;
}

function renderPopulationRateTable(rates) {
  els.populationBody.innerHTML = "";
  for (const item of rates.slice(0, 80)) {
    const tr = document.createElement("tr");
    const years = Array.from(item.years).sort((a, b) => a - b);
    tr.innerHTML = `
      <td>${item.uf}</td>
      <td>${formatNumber(item.cases)}</td>
      <td>${formatNumber(item.population)}</td>
      <td>${formatNumber(item.rate)}</td>
      <td>${years[0]}-${years[years.length - 1]}</td>
    `;
    els.populationBody.appendChild(tr);
  }
}

function renderPopulationRateText(details) {
  const { rates, matchedUfYears, missingUfYears, startYear, endYear, context } = details;
  const top = rates[0];
  const rateValues = rates.map((item) => item.rate);
  const medianRateValue = median(rateValues);
  const totalCases = rates.reduce((sum, item) => sum + item.cases, 0);
  const totalPopulation = rates.reduce((sum, item) => sum + item.population, 0);
  const aggregateRate = totalPopulation ? (totalCases / totalPopulation) * 100000 : 0;
  const coverage = matchedUfYears / Math.max(matchedUfYears + missingUfYears, 1);
  const eventName = eventLabel(context);
  const topByCount = rates.slice().sort((a, b) => b.cases - a.cases)[0];
  const topRates = rates.slice(0, Math.min(5, rates.length)).map((item) => `${item.uf} (${formatNumber(item.rate)})`);

  els.topRateUf.textContent = `${top.uf} (${formatNumber(top.rate)})`;
  els.medianRate.textContent = formatNumber(medianRateValue);
  els.populationYearsUsed.textContent = matchedUfYears.toLocaleString("pt-BR");
  els.populationCoverage.textContent = formatPercent(coverage);

  const missingText = missingUfYears
    ? ` Houve ${missingUfYears.toLocaleString("pt-BR")} combinações UF-ano sem população correspondente e elas foram ignoradas.`
    : "";
  const comparisonText =
    topByCount && topByCount.uf !== top.uf
      ? `Em numeros absolutos, a UF com mais casos e ${topByCount.uf}; pela taxa populacional, a maior intensidade relativa aparece em ${top.uf}. Essa diferenca e importante porque estados populosos tendem a dominar totais nacionais mesmo quando o risco relativo nao e o maior.`
      : `A UF com maior volume absoluto tambem aparece entre as maiores taxas, indicando que o peso populacional nao elimina sua relevancia relativa no indicador.`;

  const paragraphs = [
    `Entre ${startYear} e ${endYear}, para ${eventName}, a taxa agregada das UFs com populacao disponivel e ${formatNumber(aggregateRate)} casos por 100 mil habitantes. A taxa mediana estadual e ${formatNumber(medianRateValue)}, enquanto a maior taxa e ${top.uf}, com ${formatNumber(top.rate)} por 100 mil.${missingText}`,
    `As maiores taxas estaduais no recorte sao ${topRates.join(", ")}. Essa leitura complementa a participacao percentual: a participacao mostra peso no total de casos, enquanto a taxa por 100 mil ajusta o indicador pelo tamanho da populacao exposta.`,
    comparisonText,
    "A base populacional incluida no pacote usa a Projecao da Populacao do IBGE/SIDRA, tabela 7358, edicao 2018, sexo total e idade total. Como sao projecoes oficiais, elas servem bem para padronizar taxas, mas podem diferir das estimativas populacionais anuais revisadas mais recentes.",
  ];

  els.populationText.innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyPopulation.disabled = false;
}

function renderRateMap(context) {
  if (!state.rows.length || !context.ufField || context.ufField === "(nenhum)") {
    resetMapPanel("Carregue dados com coluna de UF para gerar o mapa coropletico.");
    return;
  }

  if (!state.populationByUfYear.size) {
    resetMapPanel("Carregue a base populacional para calcular taxas por 100 mil habitantes no mapa.");
    return;
  }

  const latestYear = latestAvailableYearForMap(context);
  if (!latestYear) {
    resetMapPanel("Nao foi possivel identificar o ultimo ano disponivel para o mapa.");
    return;
  }

  const byUf = new Map();
  const monthsInLatestYear = new Set();
  for (const row of state.rows) {
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    const value = parseNumber(row[context.valueField]);
    if (!date || date.getFullYear() !== latestYear || !Number.isFinite(value)) continue;

    const uf = row[context.ufField] || "(vazio)";
    const normalizedUf = normalizeUf(uf);
    const indicator =
      context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (state.filteredUfs.has(uf)) continue;
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (group && state.filteredGroups.has(group)) continue;
    monthsInLatestYear.add(periodKey(date, "month"));
    byUf.set(normalizedUf, (byUf.get(normalizedUf) || 0) + value);
  }

  const observedMonths = Math.max(1, monthsInLatestYear.size);
  const annualizationFactor = 12 / observedMonths;
  const rates = Array.from(byUf.entries())
    .map(([uf, cases]) => {
      const population = state.populationByUfYear.get(`${uf}|${latestYear}`);
      const annualizedCases = cases * annualizationFactor;
      return {
        uf,
        cases,
        annualizedCases,
        population: population?.population || 0,
        rate: population?.population ? (annualizedCases / population.population) * 100000 : null,
      };
    })
    .filter((item) => Number.isFinite(item.rate))
    .sort((a, b) => b.rate - a.rate);

  if (!rates.length) {
    resetMapPanel(`Nao houve cruzamento entre casos e populacao estadual em ${latestYear}.`);
    return;
  }

  renderMapSummary(rates, latestYear, context, observedMonths);
  renderMapTable(rates);
  loadUfGeojson()
    .then((geojson) => drawUfChoropleth(geojson, rates))
    .catch(() => {
      els.mapSvg.innerHTML = "";
      els.mapLegend.textContent = "Nao foi possivel carregar a malha de UFs do IBGE para desenhar o mapa.";
    });
}

function latestAvailableYearForMap(context) {
  let latest = 0;
  for (const row of state.rows) {
    const indicator =
      context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const uf = context.ufField && context.ufField !== "(nenhum)" ? row[context.ufField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (uf && state.filteredUfs.has(uf)) continue;
    if (group && state.filteredGroups.has(group)) continue;
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    if (date) latest = Math.max(latest, date.getFullYear());
  }
  return latest;
}

function renderMapSummary(rates, year, context, observedMonths) {
  const top = rates[0];
  const medianRateValue = median(rates.map((item) => item.rate));
  const coverage = rates.length / 27;
  const eventName = eventLabel(context);
  const topStates = rates.slice(0, Math.min(5, rates.length)).map((item) => `${item.uf} (${formatNumber(item.rate)})`);
  const periodText = observedMonths === 12 ? "ano completo" : `${observedMonths} mes(es) anualizados`;

  els.mapYearUsed.textContent = `${year} (${periodText})`;
  els.mapMaxUf.textContent = `${top.uf} (${formatNumber(top.rate)})`;
  els.mapMedianRate.textContent = formatNumber(medianRateValue);
  els.mapCoverage.textContent = formatPercent(coverage);
  els.mapText.innerHTML = [
    `O mapa apresenta as taxas por 100 mil habitantes para ${eventName} no ultimo ano disponivel da base filtrada: ${year}. Como ha ${observedMonths} mes(es) com dados nesse ano, a taxa foi anualizada: casos observados multiplicados por ${formatNumber(12 / observedMonths)} antes da divisao pela populacao estadual.`,
    `As maiores taxas anualizadas aparecem em ${topStates.join(", ")}. A mediana estadual e ${formatNumber(medianRateValue)} por 100 mil habitantes, o que serve como referencia para distinguir estados acima do padrao nacional do conjunto de UFs.`,
    "Neste momento o mapa municipal depende de uma base populacional municipal anual. Sem esse denominador, o app evita mapear municipios para nao misturar volume absoluto com taxa populacional.",
  ]
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
  els.copyMap.disabled = false;
}

function renderMapTable(rates) {
  els.mapBody.innerHTML = "";
  for (const item of rates) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.uf}</td>
      <td>${formatNumber(item.cases)}</td>
      <td>${formatNumber(item.population)}</td>
      <td>${formatNumber(item.rate)}</td>
    `;
    els.mapBody.appendChild(tr);
  }
}

function resetMapPanel(message) {
  els.mapYearUsed.textContent = "-";
  els.mapMaxUf.textContent = "-";
  els.mapMedianRate.textContent = "-";
  els.mapCoverage.textContent = "-";
  els.mapText.textContent = message;
  els.mapSvg.innerHTML = "";
  els.mapLegend.textContent = "";
  els.mapBody.innerHTML = '<tr><td colspan="4">Sem mapa ainda.</td></tr>';
  els.copyMap.disabled = true;
}

async function loadUfGeojson() {
  if (state.ufGeojson) return state.ufGeojson;
  if (!state.ufGeojsonPromise) {
    const url =
      "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF";
    state.ufGeojsonPromise = fetch(url, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }
  state.ufGeojson = await state.ufGeojsonPromise;
  return state.ufGeojson;
}

function drawUfChoropleth(geojson, rates) {
  const width = 720;
  const height = 520;
  const pad = 16;
  const rateByUf = new Map(rates.map((item) => [item.uf, item]));
  const bounds = geoBounds(geojson);
  const maxRate = Math.max(...rates.map((item) => item.rate));
  const project = ([lon, lat]) => {
    const x = pad + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - pad * 2);
    const y = pad + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * (height - pad * 2);
    return [x, y];
  };

  const paths = geojson.features
    .map((feature) => {
      const uf = featureUf(feature);
      const item = rateByUf.get(uf);
      const color = item ? colorForRate(item.rate, maxRate) : "#d6dcda";
      const title = item
        ? `${uf}: ${formatNumber(item.rate)} por 100 mil (${formatNumber(item.cases)} casos)`
        : `${uf}: sem dados no recorte`;
      return `<path class="map-state" d="${geometryPath(feature.geometry, project)}" fill="${color}"><title>${title}</title></path>`;
    })
    .join("");

  els.mapSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  els.mapSvg.innerHTML = paths;
  renderMapLegend(maxRate);
}

function featureUf(feature) {
  const properties = feature.properties || {};
  const code = String(properties.codarea || properties.CD_UF || properties.id || "").slice(0, 2);
  if (ibgeCodeToUf[code]) return ibgeCodeToUf[code];
  return normalizeUf(properties.sigla || properties.uf || properties.nome || "");
}

function geoBounds(geojson) {
  const bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  forEachCoordinate(geojson, ([lon, lat]) => {
    bounds.minLon = Math.min(bounds.minLon, lon);
    bounds.maxLon = Math.max(bounds.maxLon, lon);
    bounds.minLat = Math.min(bounds.minLat, lat);
    bounds.maxLat = Math.max(bounds.maxLat, lat);
  });
  return bounds;
}

function forEachCoordinate(geojson, callback) {
  for (const feature of geojson.features || []) {
    walkCoordinates(feature.geometry?.coordinates || [], callback);
  }
}

function walkCoordinates(value, callback) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    callback(value);
    return;
  }
  for (const item of value) walkCoordinates(item, callback);
}

function geometryPath(geometry, project) {
  if (!geometry) return "";
  if (geometry.type === "Polygon") return polygonPath(geometry.coordinates, project);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => polygonPath(polygon, project)).join(" ");
  }
  return "";
}

function polygonPath(rings, project) {
  return rings
    .map((ring) =>
      ring
        .map((point, index) => {
          const [x, y] = project(point);
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ") + " Z",
    )
    .join(" ");
}

function colorForRate(rate, maxRate) {
  if (!Number.isFinite(rate) || !maxRate) return "#d6dcda";
  const index = Math.min(mapColors.length - 1, Math.max(0, Math.ceil((rate / maxRate) * (mapColors.length - 1))));
  return mapColors[index];
}

function renderMapLegend(maxRate) {
  if (!Number.isFinite(maxRate) || maxRate <= 0) {
    els.mapLegend.textContent = "";
    return;
  }
  const steps = mapColors.map((color, index) => {
    if (index === 0) return { color, label: "0" };
    const from = (maxRate * (index - 1)) / (mapColors.length - 1);
    const to = (maxRate * index) / (mapColors.length - 1);
    return { color, label: `${formatNumber(from)}-${formatNumber(to)}` };
  });
  els.mapLegend.innerHTML = steps
    .map((step) => `<span><i class="map-swatch" style="background:${step.color}"></i>${step.label}</span>`)
    .join("");
}

function renderStateAnomalies(context) {
  const eventName = eventLabel(context);
  els.stateAnomalyEvent.textContent = eventName;

  if (!state.rows.length || !context.ufField || context.ufField === "(nenhum)") {
    resetStateAnomalyPanel("Carregue um CSV com coluna de UF para identificar atipicidades por estado.", eventName);
    return;
  }

  const startYear = Number(els.stateAnomalyStart.value);
  const endYear = Number(els.stateAnomalyEnd.value);
  const zThreshold = Math.max(0.5, Number(els.stateAnomalyZ.value) || 2);
  const minPeriods = Math.max(3, Number(els.stateAnomalyMinPeriods.value) || 12);
  if (!startYear || !endYear || startYear > endYear) {
    resetStateAnomalyPanel("Defina um intervalo de anos valido para analisar atipicidades por estado.", eventName);
    return;
  }

  const byUf = new Map();
  for (const row of state.rows) {
    const date = parseDate(row[context.dateField], els.dateFormat.value);
    const value = parseNumber(row[context.valueField]);
    if (!date || !Number.isFinite(value)) continue;

    const year = date.getFullYear();
    if (year < startYear || year > endYear) continue;

    const uf = row[context.ufField] || "(vazio)";
    const indicator =
      context.indicatorField && context.indicatorField !== "(nenhum)" ? row[context.indicatorField] || "(vazio)" : "";
    const group = context.groupField && context.groupField !== "(sem comparacao)" ? row[context.groupField] || "(vazio)" : "";
    if (state.filteredUfs.has(uf)) continue;
    if (indicator && state.filteredIndicators.has(indicator)) continue;
    if (group && state.filteredGroups.has(group)) continue;

    const key = periodKey(date, "month");
    const ufSeries = byUf.get(uf) || new Map();
    ufSeries.set(key, (ufSeries.get(key) || 0) + value);
    byUf.set(uf, ufSeries);
  }

  const anomalies = [];
  const ufSummaries = [];
  for (const [uf, seriesMap] of byUf.entries()) {
    const points = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }));
    if (points.length < minPeriods) continue;

    const values = points.map((point) => point.value);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    if (!sd) continue;

    let ufAnomalyCount = 0;
    for (const point of points) {
      const z = (point.value - average) / sd;
      if (Math.abs(z) >= zThreshold) {
        ufAnomalyCount += 1;
        anomalies.push({
          uf,
          key: point.key,
          value: point.value,
          average,
          z,
          type: z > 0 ? "pico atipico" : "queda atipica",
        });
      }
    }
    ufSummaries.push({ uf, periods: points.length, average, sd, anomalyCount: ufAnomalyCount });
  }

  anomalies.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const ufsWithAnomalies = new Set(anomalies.map((item) => item.uf));
  els.stateAnomalyUfCount.textContent = `${ufsWithAnomalies.size}/${ufSummaries.length}`;
  els.stateAnomalyPointCount.textContent = anomalies.length.toLocaleString("pt-BR");
  els.stateAnomalyMax.textContent = anomalies.length ? `${anomalies[0].uf} ${anomalies[0].key}` : "-";

  if (!ufSummaries.length) {
    resetStateAnomalyPanel("Nao ha UFs com periodos suficientes para avaliar atipicidade no intervalo selecionado.", eventName);
    return;
  }

  renderStateAnomalyTable(anomalies.slice(0, 80));
  renderStateAnomalyText({
    anomalies,
    ufSummaries,
    ufsWithAnomalies,
    eventName,
    startYear,
    endYear,
    zThreshold,
    minPeriods,
  });
}

function resetStateAnomalyPanel(message, eventName = "-") {
  els.stateAnomalyEvent.textContent = eventName;
  els.stateAnomalyUfCount.textContent = "0";
  els.stateAnomalyPointCount.textContent = "0";
  els.stateAnomalyMax.textContent = "-";
  els.stateAnomalyText.textContent = message;
  els.stateAnomalyBody.innerHTML = '<tr><td colspan="6">Sem atipicidades estaduais ainda.</td></tr>';
  els.copyStateAnomalies.disabled = true;
}

function renderStateAnomalyTable(anomalies) {
  els.stateAnomalyBody.innerHTML = "";
  if (!anomalies.length) {
    els.stateAnomalyBody.innerHTML = '<tr><td colspan="6">Nenhum ponto ultrapassou o limiar configurado.</td></tr>';
    return;
  }
  for (const item of anomalies) {
    const direction = item.z > 0 ? "up" : "down";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.uf}</td>
      <td>${item.key}</td>
      <td>${formatNumber(item.value)}</td>
      <td>${formatNumber(item.average)}</td>
      <td class="${direction}">${formatNumber(item.z)}</td>
      <td>${item.type}</td>
    `;
    els.stateAnomalyBody.appendChild(tr);
  }
}

function renderStateAnomalyText(details) {
  const { anomalies, ufSummaries, ufsWithAnomalies, eventName, startYear, endYear, zThreshold, minPeriods } = details;
  const share = ufSummaries.length ? ufsWithAnomalies.size / ufSummaries.length : 0;
  const top = anomalies.slice(0, 8).map((item) => `${item.uf} em ${item.key} (${item.type}, desvio ${formatNumber(item.z)})`);
  const byUfCounts = Array.from(
    anomalies.reduce((map, item) => map.set(item.uf, (map.get(item.uf) || 0) + 1), new Map()).entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([uf, count]) => `${uf} (${count})`);

  const paragraphs = [
    `A analise por estado considera o evento ${eventName}, entre ${startYear} e ${endYear}, com limiar de ${formatNumber(zThreshold)} desvios-padrao e minimo de ${minPeriods} periodos por UF. Entre as ${ufSummaries.length} UFs com dados suficientes, ${ufsWithAnomalies.size} apresentam pelo menos um ponto atipico, o equivalente a ${formatPercent(share)} das UFs analisadas.`,
    anomalies.length
      ? `Os pontos mais extremos sao ${top.join(", ")}. Esses pontos indicam meses em que a UF ficou muito acima ou abaixo do seu proprio padrao historico, nao necessariamente acima ou abaixo do Brasil.`
      : "Nenhum estado apresentou ponto acima do limiar definido. Isso sugere ausencia de choques estaduais muito extremos segundo este criterio, embora ainda possam existir mudancas graduais de tendencia.",
    byUfCounts.length
      ? `As UFs com maior numero de pontos atipicos sao ${byUfCounts.join(", ")}. Quando uma mesma UF acumula muitos pontos atipicos, vale verificar mudancas de registro, revisoes de base, eventos locais ou rupturas reais no indicador.`
      : "Nao ha concentracao de atipicidades em UFs especificas no intervalo selecionado.",
  ];

  els.stateAnomalyText.innerHTML = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  els.copyStateAnomalies.disabled = false;
}

function eventLabel(context) {
  if (!context.indicatorField || context.indicatorField === "(nenhum)") return "todos os eventos";
  return selectedFilterLabel(context.indicatorField, state.filteredIndicators);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function postWindowMonths(startYear, endYear) {
  return Math.max(1, (endYear - startYear + 1) * 12);
}

function activeFilterSummary(context) {
  const parts = [];
  const ufLabel = selectedFilterLabel(context.ufField, state.filteredUfs);
  const indicatorLabel = selectedFilterLabel(context.indicatorField, state.filteredIndicators);
  if (ufLabel) parts.push(`UF: ${ufLabel}`);
  if (indicatorLabel) parts.push(`indicador: ${indicatorLabel}`);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

function selectedFilterLabel(field, filtered) {
  if (!field || field === "(nenhum)") return "";
  const values = uniqueValues(field);
  const selected = values.filter((value) => !filtered.has(value));
  if (!selected.length || selected.length === values.length) return "todos";
  if (selected.length <= 4) return selected.join(", ");
  return `${selected.length} selecionados`;
}

function uniqueValues(field) {
  return Array.from(new Set(state.rows.map((row) => row[field] || "(vazio)"))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function abruptChanges(series) {
  return series
    .filter((point, index) => index > 0 && Number.isFinite(point.change))
    .map((point) => ({ key: point.key, change: point.change, magnitude: Math.abs(point.change) }))
    .sort((a, b) => b.magnitude - a.magnitude);
}

function seasonalitySummary(series, period) {
  if (period !== "month") {
    return "A avaliacao de sazonalidade fica limitada porque a serie nao esta em frequencia mensal. Para identificar meses sistematicamente mais altos ou baixos, use o periodo mensal.";
  }

  const byMonth = Array.from({ length: 12 }, () => []);
  for (const point of series) {
    const month = Number(point.key.slice(5, 7));
    if (month >= 1 && month <= 12) byMonth[month - 1].push(point.value);
  }

  const monthStats = byMonth
    .map((values, index) => ({
      index,
      name: monthLabels[index],
      count: values.length,
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    }))
    .filter((item) => item.count >= 2);

  if (monthStats.length < 6) {
    return "Ainda ha poucos meses repetidos para uma leitura sazonal confiavel. Com mais anos na serie, o app consegue comparar o comportamento medio de cada mes.";
  }

  const highest = monthStats.slice().sort((a, b) => b.average - a.average).slice(0, 3);
  const lowest = monthStats.slice().sort((a, b) => a.average - b.average).slice(0, 3);
  const spread = highest[0].average && lowest[0].average ? (highest[0].average - lowest[0].average) / lowest[0].average : 0;

  return `Na sazonalidade mensal, os meses com media historica mais alta sao ${highest.map((item) => `${item.name} (${formatNumber(item.average)})`).join(", ")}. As menores medias aparecem em ${lowest.map((item) => `${item.name} (${formatNumber(item.average)})`).join(", ")}. A distancia entre o mes medio mais alto e o mais baixo e de ${formatPercent(spread)}, ${spread >= 0.2 ? "um sinal de sazonalidade expressiva" : spread >= 0.1 ? "um sinal de sazonalidade moderada" : "um sinal de sazonalidade fraca"}.`;
}

function coefficientOfVariation(values) {
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  if (!average) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(values.length, 1);
  return Math.sqrt(variance) / average;
}

function maxBy(values, iteratee) {
  return values.reduce((best, item) => (iteratee(item) > iteratee(best) ? item : best), values[0]);
}

function minBy(values, iteratee) {
  return values.reduce((best, item) => (iteratee(item) < iteratee(best) ? item : best), values[0]);
}

const monthLabels = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatNumber(value) {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatInteger(value) {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatPercent(value) {
  return Number(value).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 });
}

function formatOptionalPercent(value) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : formatPercent(value);
}
