// @effect-diagnostics nodeBuiltinImport:off -- Starts the real CLI as a subprocess under a preload that observes Node's fs, sockets, DNS and fetch.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "@effect/vitest";

// Privacy fork guard: no product analytics, relay/crash trace export, or cross-tool identity reads.

const REPO_ROOT = NodePath.resolve(NodeURL.fileURLToPath(import.meta.url), "../../../..");
const SERVER_ROOT = NodePath.join(REPO_ROOT, "apps/server");

const FORBIDDEN_REFERENCE = /ingest\.t3\.codes|posthog|\bphc_[A-Za-z0-9]|axiom/i;
const FORBIDDEN_HOST = /(^|\.)(t3\.codes|posthog\.com|axiom\.co)$/i;
const ALLOWED_T3_HOSTS = new Set(["relay.t3.codes", "app.t3.codes"]);
const TRACE_OR_ANALYTICS_PATH =
  /\/v1\/(traces|logs|metrics)\b|\/(batch|capture|decide|flags)\/?$|\/i\/v0\/e\/?$|\/e\/?$/i;

const SCAN_ROOTS = [
  "apps/server/src",
  "apps/server/scripts",
  "apps/server/vite.config.ts",
  "apps/web/src",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "apps/desktop/src",
  "apps/desktop/vite.config.ts",
  "apps/mobile/src",
  "apps/mobile/app.config.ts",
  "apps/mobile/package.json",
  "packages",
  "scripts",
  "package.json",
];
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".expo",
  "coverage",
]);
const SCANNED_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs|json|html)$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

function* sourceFiles(entry: string): Generator<string> {
  const stat = NodeFS.statSync(entry, { throwIfNoEntry: false });
  if (stat === undefined) return;
  if (stat.isFile()) {
    if (SCANNED_FILE.test(entry) && !TEST_FILE.test(entry)) yield entry;
    return;
  }
  for (const child of NodeFS.readdirSync(entry, { withFileTypes: true })) {
    if (child.isDirectory() && SKIPPED_DIRECTORIES.has(child.name)) continue;
    yield* sourceFiles(NodePath.join(entry, child.name));
  }
}

// Written into the sandbox and loaded with NODE_OPTIONS, so worker threads and child Node
// processes inherit it. It records watched-path access and refuses every non-loopback request.
const SPY_SOURCE = String.raw`
import cp from "node:child_process";
import dns from "node:dns";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import path from "node:path";

const logPath = process.env.T3_EGRESS_SPY_LOG;
const watched = JSON.parse(process.env.T3_EGRESS_SPY_WATCH);
const append = fs.appendFileSync;
const record = (event) => append(logPath, JSON.stringify({ pid: process.pid, ...event }) + "\n");
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

const asPath = (value) => {
  if (typeof value === "string") return path.resolve(value);
  if (value instanceof URL && value.protocol === "file:") return value.pathname;
  if (Buffer.isBuffer(value)) return path.resolve(value.toString());
  return undefined;
};
const wrapPath = (owner, name, kind) => {
  const original = owner[name];
  if (typeof original !== "function") return;
  owner[name] = function (target, ...rest) {
    const resolved = asPath(target);
    if (resolved !== undefined && watched.includes(resolved)) record({ kind, fn: name, path: resolved });
    return original.call(this, target, ...rest);
  };
};
for (const name of ["open", "openSync", "readFile", "readFileSync", "createReadStream", "openAsBlob", "watch", "watchFile"])
  wrapPath(fs, name, "open");
for (const name of ["open", "readFile", "watch"]) wrapPath(fs.promises, name, "open");
for (const name of ["stat", "statSync", "lstat", "lstatSync", "access", "accessSync", "exists", "existsSync"])
  wrapPath(fs, name, "probe");
for (const name of ["stat", "lstat", "access"]) wrapPath(fs.promises, name, "probe");
const binding = process.binding("fs");
for (const name of ["open", "openFileHandle", "readFileUtf8"]) wrapPath(binding, name, "open");

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options =
    typeof first === "object" && first !== null
      ? first
      : typeof first === "number" || /^\d+$/.test(String(first))
        ? { port: first, host: typeof args[1] === "string" ? args[1] : undefined }
        : { path: first };
  if (options.path === undefined) {
    const host = typeof options.host === "string" ? options.host : "localhost";
    if (!LOOPBACK.has(host)) {
      record({ kind: "connect", host, port: options.port });
      process.nextTick(() => this.destroy(Object.assign(new Error("egress blocked: " + host), { code: "ECONNREFUSED" })));
      return this;
    }
  }
  return connect.apply(this, args);
};

const fetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!LOOPBACK.has(url.hostname.replace(/^\[|\]$/g, ""))) {
    record({ kind: "fetch", host: url.hostname, path: url.pathname });
    return Promise.reject(new TypeError("fetch failed: egress blocked"));
  }
  return fetch.call(this, input, init);
};

const failLookup = (owner, name) => {
  const original = owner[name];
  if (typeof original !== "function") return;
  owner[name] = function (host, ...rest) {
    if (typeof host === "string" && !LOOPBACK.has(host)) {
      record({ kind: "dns", fn: name, host });
      const error = Object.assign(new Error("getaddrinfo ENOTFOUND " + host), { code: "ENOTFOUND", hostname: host });
      if (owner === dns.promises) return Promise.reject(error);
      const callback = rest.findLast((value) => typeof value === "function");
      if (callback) process.nextTick(callback, error);
      return undefined;
    }
    return original.call(this, host, ...rest);
  };
};
for (const owner of [dns, dns.promises])
  for (const name of Object.keys(owner)) if (/^(lookup|resolve)/.test(name)) failLookup(owner, name);

for (const name of ["spawn", "spawnSync", "execFile", "execFileSync", "exec", "execSync", "fork"]) {
  const original = cp[name];
  cp[name] = function (file, ...rest) {
    record({ kind: "spawn", fn: name, file: String(file) });
    return original.call(this, file, ...rest);
  };
}
syncBuiltinESMExports();
`;

interface SpyEvent {
  readonly pid: number;
  readonly kind: "open" | "probe" | "connect" | "fetch" | "dns" | "spawn";
  readonly path?: string;
  readonly host?: string;
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = NodeNet.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address !== null
          ? resolve(address.port)
          : reject(new Error("no port")),
      );
    });
  });

const exited = (child: NodeChildProcess.ChildProcess) =>
  new Promise<number | null>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve(child.exitCode);
    else child.once("exit", (code) => resolve(code));
  });

function makeSandbox() {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-egress-"));
  const home = NodePath.join(root, "home");
  const t3Home = NodePath.join(root, "t3home");
  NodeFS.mkdirSync(NodePath.join(home, ".codex"), { recursive: true });
  NodeFS.mkdirSync(t3Home);
  const codexAuth = NodePath.join(home, ".codex", "auth.json");
  const claudeConfig = NodePath.join(home, ".claude.json");
  NodeFS.writeFileSync(codexAuth, JSON.stringify({ tokens: { account_id: "dummy-account" } }));
  NodeFS.writeFileSync(
    claudeConfig,
    JSON.stringify({ oauthAccount: { emailAddress: "dummy@example.invalid" } }),
  );
  const spyPath = NodePath.join(root, "egress-spy.mjs");
  NodeFS.writeFileSync(spyPath, SPY_SOURCE);
  const logPath = NodePath.join(root, "egress.ndjson");
  NodeFS.writeFileSync(logPath, "");
  const env = {
    HOME: home,
    T3CODE_HOME: t3Home,
    TMPDIR: root,
    // No provider CLIs on PATH, so startup cannot hand the dummy credentials to one.
    PATH: [NodePath.dirname(process.execPath), "/usr/bin", "/bin"].join(NodePath.delimiter),
    NODE_OPTIONS: `--import=${NodeURL.pathToFileURL(spyPath).href}`,
    T3_EGRESS_SPY_LOG: logPath,
    T3_EGRESS_SPY_WATCH: JSON.stringify([codexAuth, claudeConfig]),
  };
  const events = (): ReadonlyArray<SpyEvent> =>
    NodeFS.readFileSync(logPath, "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as SpyEvent);
  return { t3Home, codexAuth, claudeConfig, env, events };
}

describe("privacy egress", () => {
  it("ships no analytics, trace or crash-upload endpoint", () => {
    const offenders: Array<string> = [];
    for (const root of SCAN_ROOTS) {
      for (const file of sourceFiles(NodePath.join(REPO_ROOT, root))) {
        const lines = NodeFS.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, index) => {
          if (FORBIDDEN_REFERENCE.test(line)) {
            offenders.push(`${NodePath.relative(REPO_ROOT, file)}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("starts without reading other tools' identity files or sending analytics or traces", async () => {
    const sandbox = makeSandbox();

    // The spy must see the reads and requests it guards against, or a clean run proves nothing.
    const control = NodeChildProcess.spawn(
      process.execPath,
      [
        "-e",
        "require('node:fs').promises.readFile(process.argv[1]).then(() => fetch('https://ingest.t3.codes/batch')).catch(() => {})",
        sandbox.codexAuth,
      ],
      { env: sandbox.env, stdio: "ignore" },
    );
    expect(await exited(control)).toBe(0);
    const controlEvents = sandbox.events().filter((event) => event.pid === control.pid);
    expect(controlEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "open", path: sandbox.codexAuth }),
        expect.objectContaining({ kind: "fetch", host: "ingest.t3.codes" }),
      ]),
    );

    const port = await freePort();
    const server = NodeChildProcess.spawn(
      process.execPath,
      [
        "src/bin.ts",
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--base-dir",
        sandbox.t3Home,
      ],
      { cwd: SERVER_ROOT, env: sandbox.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      let output = "";
      await new Promise<void>((resolve, reject) => {
        server.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes("T3 Code server is ready.")) resolve();
        });
        server.stderr.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        server.once("exit", (code) =>
          reject(new Error(`server exited (${code}) before ready:\n${output}`)),
        );
      });
    } finally {
      server.kill("SIGTERM");
      await exited(server);
    }

    const serverEvents = sandbox.events().filter((event) => event.pid !== control.pid);
    const identityAccess = serverEvents.filter(
      (event) => event.path === sandbox.codexAuth || event.path === sandbox.claudeConfig,
    );
    expect(identityAccess).toEqual([]);

    const telemetryRequests = serverEvents.filter(
      (event) =>
        (event.kind === "fetch" || event.kind === "connect" || event.kind === "dns") &&
        event.host !== undefined &&
        ((FORBIDDEN_HOST.test(event.host) && !ALLOWED_T3_HOSTS.has(event.host)) ||
          (event.kind === "fetch" &&
            "path" in event &&
            TRACE_OR_ANALYTICS_PATH.test(String(event.path)))),
    );
    expect(telemetryRequests).toEqual([]);
  });
});
