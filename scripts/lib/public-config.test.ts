// @effect-diagnostics nodeBuiltinImport:off - Tests exercise root env file precedence directly.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { loadRepoEnv, withoutConnectStamps } from "./public-config.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});

describe("loadRepoEnv", () => {
  it("applies process, root local, and root precedence in that order", () => {
    const repoRoot = makeTemporaryDirectory();
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env"),
      "T3CODE_CLERK_PUBLISHABLE_KEY=pk_root\nT3CODE_CLERK_JWT_TEMPLATE=template_root\nT3CODE_CLERK_CLI_OAUTH_CLIENT_ID=oauth_root\nT3CODE_RELAY_URL=https://root.example.test\n",
    );
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env.local"),
      "T3CODE_CLERK_PUBLISHABLE_KEY=pk_local\nT3CODE_CLERK_JWT_TEMPLATE=template_local\nT3CODE_CLERK_CLI_OAUTH_CLIENT_ID=oauth_local\nT3CODE_RELAY_URL=https://local.example.test\n",
    );

    expect(loadRepoEnv({ baseEnv: {}, repoRoot }).T3CODE_RELAY_URL).toBe(
      "https://local.example.test",
    );
    expect(
      loadRepoEnv({
        baseEnv: {
          T3CODE_CLERK_PUBLISHABLE_KEY: "pk_ci",
          T3CODE_CLERK_JWT_TEMPLATE: "template_ci",
          T3CODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_ci",
          T3CODE_RELAY_URL: "https://ci.example.test",
        },
        repoRoot,
      }),
    ).toMatchObject({
      T3CODE_CLERK_PUBLISHABLE_KEY: "pk_ci",
      T3CODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_ci",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_ci",
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_ci",
      T3CODE_CLERK_JWT_TEMPLATE: "template_ci",
      VITE_CLERK_JWT_TEMPLATE: "template_ci",
      EXPO_PUBLIC_CLERK_JWT_TEMPLATE: "template_ci",
      T3CODE_RELAY_URL: "https://ci.example.test",
      VITE_T3CODE_RELAY_URL: "https://ci.example.test",
    });
  });

  it("forwards no trace endpoint, dataset or token from any source", () => {
    const repoRoot = makeTemporaryDirectory();
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env"),
      "T3CODE_RELAY_CLIENT_OTLP_TRACES_URL=https://root.example.test/v1/traces\nVITE_RELAY_OTLP_TRACES_TOKEN=root-token\n",
    );
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env.local"),
      "EXPO_PUBLIC_OTLP_TRACES_DATASET=local-dataset\nT3CODE_MOBILE_OTLP_TRACES_TOKEN=local-token\n",
    );
    const env = loadRepoEnv({
      baseEnv: {
        T3CODE_RELAY_CLIENT_OTLP_TRACES_URL: "https://ci.example.test/v1/traces",
        T3CODE_RELAY_CLIENT_OTLP_TRACES_DATASET: "ci-dataset",
        T3CODE_RELAY_CLIENT_OTLP_TRACES_TOKEN: "ci-token",
        VITE_RELAY_OTLP_TRACES_URL: "https://ci.example.test/v1/traces",
        EXPO_PUBLIC_OTLP_TRACES_TOKEN: "ci-token",
        T3CODE_RELAY_URL: "https://ci.example.test",
      },
      repoRoot,
    });

    expect(Object.keys(env).filter((name) => name.includes("OTLP_TRACES"))).toEqual([]);
    expect(env.T3CODE_RELAY_URL).toBe("https://ci.example.test");
  });
});

describe("withoutConnectStamps (privacy desktop)", () => {
  it("drops every Clerk and relay value from any source and keeps the rest", () => {
    const repoRoot = makeTemporaryDirectory();
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env"),
      "T3CODE_CLERK_PUBLISHABLE_KEY=pk_root\nT3CODE_RELAY_URL=https://root.example.test\n",
    );
    NodeFS.writeFileSync(
      NodePath.join(repoRoot, ".env.local"),
      "VITE_CLERK_JWT_TEMPLATE=template_local\nVITE_T3CODE_RELAY_URL=https://local.example.test\n",
    );
    const env = withoutConnectStamps(
      loadRepoEnv({
        baseEnv: {
          T3CODE_CLERK_PUBLISHABLE_KEY: "pk_ci",
          VITE_CLERK_PUBLISHABLE_KEY: "pk_ci",
          T3CODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_ci",
          VITE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_ci",
          T3CODE_RELAY_URL: "https://ci.example.test",
          T3CODE_DESKTOP_UPDATE_REPOSITORY: "owner/repo",
        },
        repoRoot,
      }),
    );

    expect(Object.keys(env).filter((name) => /CLERK|RELAY_URL/u.test(name))).toEqual([]);
    expect(env.T3CODE_DESKTOP_UPDATE_REPOSITORY).toBe("owner/repo");
  });
});

function makeTemporaryDirectory() {
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3code-public-config-"));
  temporaryDirectories.push(directory);
  return directory;
}
