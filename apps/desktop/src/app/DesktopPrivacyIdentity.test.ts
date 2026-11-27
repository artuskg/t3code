import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { resolveDesktopAppBranding } from "./DesktopEnvironment.ts";
import { isPrivacyIdentityBuild, resolveDesktopBaseDir } from "./DesktopStatePaths.ts";
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
      // T3CODE_HOME still wins, and development keeps its own profile.
      assert.equal(
        resolveDesktopBaseDir({
          homeDirectory: "/Users/u",
          joinPath: (...parts) => parts.join("/"),
          t3Home: Option.some("/srv/t3"),
        }),
        "/srv/t3",
      );
      assert.equal(
        resolveDesktopAppBranding({ isDevelopment: true, appVersion: "0.1.12" }).stageLabel,
        "Dev",
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
