// @effect-diagnostics nodeBuiltinImport:off - Reads the installed electron-updater source synchronously.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { electronUpdaterPrivacyPlugin, stripStagingUserId } from "./electron-updater-privacy.ts";

const desktopRequire = NodeModule.createRequire(
  NodePath.resolve(import.meta.dirname, "../../apps/desktop/package.json"),
);
const appUpdaterPath = NodePath.join(
  NodePath.dirname(desktopRequire.resolve("electron-updater/package.json")),
  "out/AppUpdater.js",
);
const original = NodeFS.readFileSync(appUpdaterPath, "utf8");

describe("electron-updater privacy transform", () => {
  it("the locked electron-updater stores and sends a staging user ID", () => {
    expect(original).toContain('"x-user-staging-id"');
    expect(original).toContain('".updaterId"');
  });

  it("drops the staging ID file and header and ignores rollout percentages", async () => {
    const stripped = stripStagingUserId(original);
    expect(stripped).not.toMatch(/x-user-staging-id|\.updaterId|stagingUserId/u);
    expect(stripped).toContain("client.setRequestHeaders(this.computeFinalHeaders({}));");

    const module = { exports: {} as Record<string, unknown> };
    // The transformed module must still load, and every staged rollout counts as reached.
    new Function("exports", "require", "module", "__filename", "__dirname", stripped)(
      module.exports,
      NodeModule.createRequire(appUpdaterPath),
      module,
      appUpdaterPath,
      NodePath.dirname(appUpdaterPath),
    );
    const AppUpdater = module.exports.AppUpdater as {
      prototype: { isStagingMatch: (info: unknown) => Promise<boolean> };
    };
    await expect(
      AppUpdater.prototype.isStagingMatch.call({}, { stagingPercentage: 1 }),
    ).resolves.toBe(true);
  });

  it("touches only electron-updater's AppUpdater module", () => {
    const plugin = electronUpdaterPrivacyPlugin();
    expect(plugin.transform("x", "/m/node_modules/other/out/AppUpdater.js")).toBeNull();
    expect(plugin.transform(original, appUpdaterPath)?.code).not.toContain("x-user-staging-id");
  });

  it("fails loudly when electron-updater's code changes shape", () => {
    expect(() => stripStagingUserId("module.exports = {};")).toThrow(/electron-updater changed/u);
  });
});
