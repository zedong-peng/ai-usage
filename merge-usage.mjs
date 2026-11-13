// Adds the machines' files, site/data/hosts/*.json, into site/data/usage.json, which the page reads.
// Each machine writes only its own file, so machines never conflict; the Pages workflow runs this.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "site/data/hosts");
const hosts = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
const zones = new Set(hosts.map((h) => h.timeZone));
if (zones.size > 1) throw new Error(`machines bucket days in different zones: ${[...zones].join(", ")}`);

const merged = new Map();
for (const host of hosts) {
  for (const b of host.buckets) {
    const key = `${b.day}\0${b.provider}\0${b.model}`;
    const m = merged.get(key);
    if (!m) { merged.set(key, { ...b, totals: { ...b.totals } }); continue; }
    for (const k of Object.keys(b.totals)) m.totals[k] = (m.totals[k] ?? 0) + b.totals[k];
    m.costUsd += b.costUsd;
    m.cacheSavingsUsd += b.cacheSavingsUsd;
    m.records += b.records;
    m.sessions += b.sessions;
  }
}
const latest = (k) => hosts.map((h) => h[k]).filter(Boolean).sort().at(-1);
const buckets = [...merged.values()].sort(
  (a, b) => a.day.localeCompare(b.day) || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
);
writeFileSync(
  join(import.meta.dirname, "site/data/usage.json"),
  JSON.stringify({ updatedAt: latest("updatedAt"), timeZone: [...zones][0], pricingFetchedAt: latest("pricingFetchedAt"), machines: hosts.length, buckets }) + "\n",
);
console.log(`${hosts.length} machine(s), ${buckets.length} buckets`);
