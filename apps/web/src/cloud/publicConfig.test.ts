import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  canOptInToDesktopConnect,
  DESKTOP_CONNECT_OPT_IN_KEY,
  hasCloudPublicConfig,
} from "./publicConfig.ts";

function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hasCloudPublicConfig", () => {
  it("rejects an insecure relay URL", () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "t3-relay");
    vi.stubEnv("VITE_T3CODE_RELAY_URL", "http://relay.example.test");

    expect(hasCloudPublicConfig()).toBe(false);
  });

  describe("browser origins", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", `pk_live_${btoa("clerk.example.com$")}`);
      vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "t3-relay");
      vi.stubEnv("VITE_T3CODE_RELAY_URL", "https://relay.example.test");
    });

    it.each(["https://example.com", "https://nightly.app.example.com:443"])(
      "enables production auth on the configured root and subdomains: %s",
      (origin) => {
        vi.stubGlobal("window", { location: new URL(origin) });

        expect(hasCloudPublicConfig()).toBe(true);
      },
    );

    it.each(["http://localhost:3773", "https://machine.example.ts.net"])(
      "disables production auth on private browser origins: %s",
      (origin) => {
        vi.stubGlobal("window", { location: new URL(origin) });

        expect(hasCloudPublicConfig()).toBe(false);
      },
    );

    it.each(["http://app.example.com:443", "https://app.example.com:3773"])(
      "rejects unsupported schemes and ports even on the configured domain: %s",
      (origin) => {
        vi.stubGlobal("window", { location: new URL(origin) });

        expect(hasCloudPublicConfig()).toBe(false);
      },
    );

    it.each(["https://notexample.com", "https://example.com.evil.test"])(
      "rejects domain lookalikes: %s",
      (origin) => {
        vi.stubGlobal("window", { location: new URL(origin) });

        expect(hasCloudPublicConfig()).toBe(false);
      },
    );

    it.each([
      ["https://tenant.clerk.accounts.dev", true],
      ["https://other.clerk.accounts.dev", false],
    ])("keeps a provider hostname scoped to its own instance: %s", (origin, expected) => {
      vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", `pk_live_${btoa("tenant.clerk.accounts.dev$")}`);
      vi.stubGlobal("window", { location: new URL(origin) });

      expect(hasCloudPublicConfig()).toBe(expected);
    });

    it("keeps Clerk unmounted in Electron until the user opts in to Connect", () => {
      vi.stubGlobal("window", {
        location: new URL("t3code://app/"),
        desktopBridge: {},
        localStorage: memoryStorage(),
      });

      expect(hasCloudPublicConfig()).toBe(false);
      expect(canOptInToDesktopConnect()).toBe(true);
    });

    it("treats unreadable storage in Electron as not opted in", () => {
      vi.stubGlobal("window", { location: new URL("t3code://app/"), desktopBridge: {} });

      expect(hasCloudPublicConfig()).toBe(false);
    });

    it("keeps production keys available in the Electron auth shell after the opt-in", () => {
      vi.stubGlobal("window", {
        location: new URL("t3code://app/"),
        desktopBridge: {},
        localStorage: memoryStorage({ [DESKTOP_CONNECT_OPT_IN_KEY]: "1" }),
      });

      expect(hasCloudPublicConfig()).toBe(true);
      expect(canOptInToDesktopConnect()).toBe(false);
    });

    it("offers no desktop opt-in in a browser or without Connect stamps", () => {
      vi.stubGlobal("window", { location: new URL("https://example.com") });
      expect(canOptInToDesktopConnect()).toBe(false);

      vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
      vi.stubGlobal("window", {
        location: new URL("t3code://app/"),
        desktopBridge: {},
        localStorage: memoryStorage(),
      });
      expect(canOptInToDesktopConnect()).toBe(false);
    });
  });
});
