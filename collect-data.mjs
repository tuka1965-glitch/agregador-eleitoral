import { mkdir, readFile, writeFile } from "node:fs/promises";

const pageTitle = "Pesquisas de opinião para a eleição presidencial no Brasil em 2026";
const sourceUrl = `https://pt.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
const response = await fetch(sourceUrl, { headers: { "User-Agent": "agregador-eleitoral/1.0" } });
if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
const payload = await response.json();
if (!payload.parse?.text?.["*"]) throw new Error("A API não retornou HTML da página.");

const collectedAt = new Date().toISOString();
const record = { collected_at: collectedAt, source_url: sourceUrl, page_title: pageTitle, payload };
await mkdir("data/history", { recursive: true });
await writeFile("data/wikipedia-latest.json", `${JSON.stringify(record)}\n`);
await writeFile(`data/history/${collectedAt.replaceAll(/[:.]/g, "-")}.json`, `${JSON.stringify(record)}\n`);

const manifestPath = "data/manifest.json";
let manifest = [];
try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch {}
manifest.unshift({ collected_at: collectedAt, file: "wikipedia-latest.json", source_url: sourceUrl });
manifest = manifest.slice(0, 120);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
