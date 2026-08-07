import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SNAPSHOT_DIR = "data/backtest/snapshots";
const RESULTS_PATH = "data/backtest/results.json";

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const files = (await readdir(SNAPSHOT_DIR).catch(() => []))
  .filter((file) => file.endsWith(".json"))
  .sort();

const report = {
  generated_at: new Date().toISOString(),
  status: "insufficient_data",
  message: "São necessários snapshots de previsões e resultados observados compatíveis.",
  snapshots: files.length,
  evaluated: 0,
  metrics: null,
  details: [],
};

for (const file of files) {
  const snapshot = await readJson(join(SNAPSHOT_DIR, file));
  const forecast = snapshot.forecast || {};
  const observed = snapshot.observed || {};
  const candidates = [...new Set([...Object.keys(forecast), ...Object.keys(observed)])];
  const errors = candidates
    .map((candidate) => {
      const predicted = numeric(forecast[candidate]);
      const actual = numeric(observed[candidate]);
      if (predicted == null || actual == null) return null;
      return { candidate, predicted, actual, error: predicted - actual, absolute_error: Math.abs(predicted - actual) };
    })
    .filter(Boolean);

  if (!errors.length) continue;
  report.details.push({ file, election_date: snapshot.election_date || null, errors });
}

if (report.details.length) {
  const all = report.details.flatMap((item) => item.errors);
  report.evaluated = report.details.length;
  report.status = "evaluated";
  report.message = "Backtest calculado a partir dos snapshots disponíveis.";
  report.metrics = {
    mean_absolute_error: all.reduce((sum, item) => sum + item.absolute_error, 0) / all.length,
    mean_error_bias: all.reduce((sum, item) => sum + item.error, 0) / all.length,
    observations: all.length,
  };
}

await import("node:fs/promises").then(({ mkdir, writeFile }) =>
  mkdir("data/backtest", { recursive: true }).then(() =>
    writeFile(RESULTS_PATH, JSON.stringify(report, null, 2) + "\n")
  )
);
console.log(JSON.stringify(report, null, 2));
