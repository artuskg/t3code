import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

const { providerProps, ClerkProvider } = vi.hoisted(() => {
  const providerProps: Array<Record<string, unknown>> = [];
  const ClerkProvider = (props: Record<string, unknown> & { readonly children?: ReactNode }) => {
    providerProps.push(props);
    return props.children;
  };
  return { providerProps, ClerkProvider };
});

vi.mock("@clerk/react", () => ({ ClerkProvider }));
vi.mock("@clerk/electron/react", () => ({ ClerkProvider }));
vi.mock("@clerk/electron/passkeys", () => ({ passkeys: {} }));
vi.mock("../../cloud/managedAuth", () => ({
  ManagedRelayAuthProvider: ({ children }: { readonly children: ReactNode }) => children,
}));

import BrowserManagedAuthShell from "./BrowserManagedAuthShell";
import ElectronManagedAuthShell from "./ElectronManagedAuthShell";

describe("managed auth shells", () => {
  it("turn off Clerk's own telemetry in the browser and in Electron", () => {
    for (const Shell of [BrowserManagedAuthShell, ElectronManagedAuthShell]) {
      providerProps.length = 0;
      expect(renderToStaticMarkup(<Shell publishableKey="pk_test_x">child</Shell>)).toBe("child");
      expect(providerProps).toHaveLength(1);
      expect(providerProps[0]?.telemetry).toBe(false);
    }
  });
});
