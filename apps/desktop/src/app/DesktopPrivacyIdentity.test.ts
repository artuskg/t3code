import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import * as DesktopConfig from "./DesktopConfig.ts";
import { resolveEarlyLinuxPasswordStorePreference } from "./DesktopEarlyElectronStartup.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import { resolveDesktopAppBranding } from "./DesktopEnvironment.ts";
import {
  isPrivacyIdentityBuild,
  privacyHomeRefusal,
  resolveDesktopBaseDir,
} from "./DesktopStatePaths.ts";
import { resolveUserDataPath } from "./DesktopUserData.ts";

const flag = globalThis as { __T3CODE_DESKTOP_PRIVACY_IDENTITY__?: boolean };
const privacyBuild = Effect.acquireRelease(
  Effect.sync(() => {
    flag.__T3CODE_DESKTOP_PRIVACY_IDENTITY__ = true;
  }),
  () =>
    Effect.sync(() => {
      delete flag.__T3CODE_DESKTOP_PRIVACY_IDENTITY__;
    }),
);

const identity = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const appData = yield* fs.makeTempDirectoryScoped({ prefix: "t3-privacy-identity-" });
  // A stock install's Electron profile already sits beside it.
  yield* fs.makeDirectory(path.join(appData, "t3code-v2"), { recursive: true });
  const userData = yield* resolveUserDataPath({
    appDataDirectory: appData,
    isDevelopment: false,
    platform: "darwin",
  });
  return {
    userData: path.basename(userData),
    baseDir: resolveDesktopBaseDir({
      homeDirectory: "/Users/u",
      joinPath: path.join,
      t3Home: Option.none(),
    }),
    branding: resolveDesktopAppBranding({ isDevelopment: false, appVersion: "0.1.12" }),
  };
});

describe("desktop privacy identity", () => {
  it.effect("the stock build keeps T3 Code's home, profile and name", () =>
    Effect.gen(function* () {
      assert.isFalse(isPrivacyIdentityBuild());
      const stock = yield* identity;
      assert.equal(stock.userData, "t3code-v2");
      assert.equal(stock.baseDir, "/Users/u/.t3");
      assert.equal(stock.branding.displayName, "T3 Code (Beta)");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("the privacy build shares no home, profile or name with a stock install", () =>
    Effect.gen(function* () {
      yield* privacyBuild;
      assert.isTrue(isPrivacyIdentityBuild());
      const privacy = yield* identity;
      assert.equal(privacy.userData, "t3code-privacy");
      assert.equal(privacy.baseDir, "/Users/u/.t3-privacy");
      assert.equal(privacy.branding.displayName, "T3 Code (Privacy)");
      assert.equal(privacy.branding.stageLabel, "Privacy");
      // Development keeps its own profile.
      assert.equal(
        resolveDesktopAppBranding({ isDevelopment: true, appVersion: "0.1.12" }).stageLabel,
        "Dev",
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("the privacy build ignores T3CODE_HOME and refuses the stock home", () =>
    Effect.gen(function* () {
      yield* privacyBuild;
      const environmentBaseDir = (env: Record<string, string>) =>
        DesktopEnvironment.DesktopEnvironment.pipe(
          Effect.map((environment) => environment.baseDir),
          Effect.provide(
            DesktopEnvironment.layer({
              dirname: "/app/dist-electron",
              homeDirectory: "/Users/u",
              platform: "darwin",
              processArch: "arm64",
              appVersion: "0.1.12-privacy.1",
              appPath: "/app",
              isPackaged: true,
              resourcesPath: "/app",
              runningUnderArm64Translation: false,
            }).pipe(
              Layer.provide(
                Layer.mergeAll(
                  NodeServices.layer,
                  NodePath.layerPosix,
                  DesktopConfig.layerTest(env),
                ),
              ),
            ),
          ),
        );
      assert.equal(
        yield* environmentBaseDir({ T3CODE_HOME: "/Users/u/.t3" }),
        "/Users/u/.t3-privacy",
      );
      assert.equal(
        yield* environmentBaseDir({ T3CODE_HOME: "/Users/u/.t3", T3CODE_PRIVACY_HOME: "/srv/p" }),
        "/srv/p",
      );
      const path = yield* Path.Path;
      // Pre-ready startup reads its settings from the same home.
      let settingsPath = "";
      resolveEarlyLinuxPasswordStorePreference({
        env: { T3CODE_HOME: "/Users/u/.t3" },
        homeDirectory: "/Users/u",
        joinPath: path.join,
        readFileString: (path) => {
          settingsPath = path;
          return "{}";
        },
      });
      assert.equal(settingsPath, "/Users/u/.t3-privacy/userdata/desktop-settings.json");

      const refusal = (baseDir: string) =>
        privacyHomeRefusal({ homeDirectory: "/Users/u", baseDir, resolvePath: path.resolve });
      for (const stock of ["/Users/u/.t3", "/Users/u/.t3/", "/Users/u/x/../.t3"]) {
        assert.include(refusal(stock), "T3CODE_PRIVACY_HOME");
      }
      assert.isNull(refusal("/Users/u/.t3-privacy"));
      assert.isNull(refusal("/srv/p"));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("the stock build never refuses its own home", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      assert.isNull(
        privacyHomeRefusal({
          homeDirectory: "/Users/u",
          baseDir: "/Users/u/.t3",
          resolvePath: path.resolve,
        }),
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
