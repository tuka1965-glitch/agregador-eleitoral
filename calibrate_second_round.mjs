import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const elections = [2014, 2018, 2022];
const rows = [];
for (const year of elections) {
  const raw = execFileSync(process.execPath, [`backtest_${year}.js`], { encoding: "utf8" });
  const parsed = JSON.parse(raw);
  for (const row of parsed.temporalSecondRoundBacktest || []) rows.push({ election: year, ...row });
}
const horizons = [30,21,14,7,3,1].map(daysBefore => {
  const x = rows.filter(r => r.daysBefore === daysBefore && Number.isFinite(r.marginError));
  const errors = x.map(r => r.marginError);
  const mae = errors.length ? errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length : null;
  const rmse = errors.length ? Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length) : null;
  const bias = errors.length ? errors.reduce((s,e)=>s+e,0)/errors.length : null;
  return { daysBefore, n: errors.length, mae, rmse, bias, sigmaHistorical: rmse };
});
const report = { generatedAt: new Date().toISOString(), methodology: "Erro da margem agregada de 2º turno versus margem oficial; sem viés fixo por candidato.", rows, horizons };
mkdirSync("data/backtest", { recursive: true });
writeFileSync("data/backtest/calibration_2t.json", JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
