import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { managedUpdatesDenial } from "./managedUpdates";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("managedUpdatesDenial", () => {
  it("refuses server updates from the desktop app whatever the policy says", () => {
    vi.stubGlobal("window", { desktopBridge: {} });
    expect(managedUpdatesDenial(undefined)).toBe(
      "This app doesn't install updates. Update through your own release pipeline.",
    );
  });

  it("leaves the decision to the managed policy in a browser", () => {
    vi.stubGlobal("window", {});
    expect(managedUpdatesDenial(undefined)).toBeUndefined();
    expect(
      managedUpdatesDenial({
        organization: "Acme",
        lockedSettings: [],
        limits: { updates: { mode: "off" } },
      }),
    ).toContain("Acme");
  });
});
