import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const capture = vi.hoisted(() => ({ shellImport: vi.fn(), render: vi.fn() }));
vi.mock("react-dom/client", () => ({
  default: { createRoot: () => ({ render: capture.render }) },
}));
vi.mock("./keyboardLayout", () => ({ trackKeyboardLayout: () => () => {} }));
vi.mock("./env", () => ({ isElectron: true }));
vi.mock("./appInit", () => ({ startAppServices: () => ({ load: async () => {} }) }));
vi.mock("./AppRoot", () => ({ AppRoot: () => null }));
vi.mock("./i18n/runtime", () => ({ whenLocaleReady: async () => {} }));
vi.mock("./lib/chunkReloadGuard", () => ({ chunkLoadState: { reloadScheduled: false } }));
vi.doMock("./components/clerk/ElectronManagedAuthShell", () => {
  capture.shellImport();
  return { default: () => null };
});
vi.doMock("./components/clerk/BrowserManagedAuthShell", () => {
  capture.shellImport();
  return { default: () => null };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Privacy desktop build: Connect stamps never reach the bundle (vite.config.ts), so even a build
// run with Clerk and relay values in its environment starts with no Clerk shell.
describe("privacy desktop renderer startup", () => {
  it.each([
    ["a fresh profile", null],
    ["an old persisted Connect opt-in", "1"],
  ])("imports no Clerk shell with %s", async (_label, optIn) => {
    vi.resetModules();
    capture.shellImport.mockClear();
    capture.render.mockClear();
    vi.stubGlobal("window", {
      desktopBridge: {},
      location: new URL("t3code://app/"),
      localStorage: {
        getItem: (key: string) => (key === "t3code:privacy:desktop-connect" ? optIn : null),
      },
    });
    vi.stubGlobal("document", { getElementById: () => ({}) });

    // Booleans, so a failure never prints a stamped value.
    expect(Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)).toBe(false);
    expect(Boolean(import.meta.env.VITE_T3CODE_RELAY_URL)).toBe(false);
    const { hasCloudPublicConfig } = await import("./cloud/publicConfig");
    expect(hasCloudPublicConfig()).toBe(false);

    const entry = await import("./main");
    await entry.startup;
    expect(capture.render).toHaveBeenCalledOnce();
    expect(capture.shellImport).not.toHaveBeenCalled();
  });
});
