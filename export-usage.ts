// Runs T3 Code's own UsageService over this machine's provider transcripts and merges the
// result into this machine's file, site/data/hosts/<key>.json. merge-usage.mjs adds the machines
// up. Read-only toward ~/.claude, ~/.codex, ~/.grok and ~/.t3; the scanner's cache lives in ./state.
import * as NodeCryptoHash from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeOS from "node:os";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { FetchHttpClient } from "effect/http";
import { UsageDay } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as CursorAccountReader from "@t3tools/provider-cursor/server/CursorAccountReader";
import * as CursorUsageAccounts from "@t3tools/provider-cursor/server/CursorUsageAccounts";
import { MuseUsageHome } from "@t3tools/provider-muse/server";

const T3CODE_DIR = process.env.T3CODE_DIR ?? NodePath.join(NodeOS.homedir(), "au-linux-workspace/t3code");
const SRC = NodePath.join(T3CODE_DIR, "apps/server/src");
const ServerConfig = await import(`${SRC}/config.ts`);
const ServerSettings = await import(`${SRC}/serverSettings.ts`);
const Sqlite = await import(`${SRC}/persistence/Sqlite.ts`);
const CodexUsageHistory = await import(`${SRC}/usage/CodexUsageHistory.ts`);
const ServerSecretStore = await import(`${SRC}/auth/ServerSecretStore.ts`);
const BackgroundPolicy = await import(`${SRC}/background/BackgroundPolicy.ts`);
const AntigravityUsage = await import(`${SRC}/provider/Drivers/AntigravityUsage.ts`);
const ProviderHostLive = await import(`${SRC}/provider/ProviderHostLive.ts`);
const UsageService = await import(`${SRC}/usage/UsageService.ts`);

const here = import.meta.dirname;
// The scanner keeps 92 days of cache; older days come from the previous usage.json.
const days = Number(process.argv[2] ?? 90);
// Every machine buckets days in the same zone, so their days add up.
const timeZone = process.env.USAGE_TZ ?? "Australia/Sydney";
const userSettings = JSON.parse(
  NodeFS.readFileSync(NodePath.join(NodeOS.homedir(), ".t3/userdata/settings.json"), "utf8"),
);
const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
const until = new Date();
const since = new Date(until.getTime() - (days - 1) * 86_400_000);

const layer = Layer.fresh(CursorUsageAccounts.layer).pipe(
  Layer.provide(CursorAccountReader.layer),
  Layer.provideMerge(AntigravityUsage.layer),
  Layer.provideMerge(MuseUsageHome.layer),
  Layer.provideMerge(ProviderHostLive.layer),
  Layer.provideMerge(CodexUsageHistory.layer.pipe(Layer.provideMerge(Sqlite.layerMemory))),
  Layer.provideMerge(Layer.mock(BackgroundPolicy.BackgroundPolicy)({})),
  Layer.provideMerge(
    Layer.mock(ServerSecretStore.ServerSecretStore)({ get: () => Effect.succeedNone }),
  ),
  Layer.provideMerge(ServerConfig.layerTest(here, NodePath.join(here, "state"))),
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
  Layer.provideMerge(Layer.succeed(HostProcess.Platform, process.platform)),
  Layer.provideMerge(Layer.succeed(HostProcess.Hostname, NodeOS.hostname())),
  Layer.provideMerge(
    ServerSettings.layerTest({
      providerInstances: userSettings.providerInstances ?? {},
      usageLimitSources: userSettings.usageLimitSources,
    }),
  ),
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provideMerge(Layer.succeed(HostProcess.Environment, process.env)),
);

const program = Effect.gen(function* () {
  const service = yield* UsageService.make;
  const summary = yield* service.readSummary({
    timeZone,
    sinceDay: UsageDay.make(fmt(since)),
    untilDay: UsageDay.make(fmt(until)),
    awaitRefresh: true,
  });
  yield* service.awaitPersisted;
  return summary;
});

const summary = await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(layer)));

// The file is named after a hash of the scanner's random host id, so it says nothing about the machine.
const hostId = NodeFS.readFileSync(NodePath.join(here, "state/usage-host-id"), "utf8").trim();
const hostKey = NodeCryptoHash.createHash("sha256").update(hostId).digest("hex").slice(0, 8);
const outPath = NodePath.join(here, "site/data/hosts", `${hostKey}.json`);

// Public shape: no paths, hostnames or session ids.
const fresh = summary.buckets.map((b) => ({
  day: b.day,
  provider: b.provider,
  model: b.model,
  totals: b.totals,
  costUsd: b.costUsd,
  cacheSavingsUsd: b.cacheSavingsUsd,
  costSource: b.costSource,
  records: b.records,
  sessions: b.sessions,
}));
const previous = NodeFS.existsSync(outPath)
  ? JSON.parse(NodeFS.readFileSync(outPath, "utf8")).buckets
  : [];
const kept = previous.filter(
  (b: { day: string }) => b.day < summary.sinceDay || b.day > summary.untilDay,
);
const buckets = [...kept, ...fresh].sort(
  (a, b) => a.day.localeCompare(b.day) || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
);
NodeFS.mkdirSync(NodePath.dirname(outPath), { recursive: true });
NodeFS.writeFileSync(
  outPath,
  JSON.stringify(
    { updatedAt: summary.readAt, timeZone, pricingFetchedAt: summary.pricing.fetchedAt, buckets },
    null,
    0,
  ) + "\n",
);
console.log(`${fresh.length} fresh + ${kept.length} kept buckets -> ${outPath}`);
