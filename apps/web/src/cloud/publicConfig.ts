import {
  clerkFrontendApiHostnameFromPublishableKey,
  relayClerkTokenOptions,
} from "@t3tools/shared/relayAuth";
import { normalizeSecureRelayUrl } from "@t3tools/shared/relayUrl";
import * as Schema from "effect/Schema";

import { isHostedStaticApp } from "../hostedPairing";

export class CloudPublicConfigMissingError extends Schema.TaggedError<CloudPublicConfigMissingError>()(
  "CloudPublicConfigMissingError",
  {
    key: Schema.Literal("T3CODE_CLERK_JWT_TEMPLATE"),
  },
) {
  override get message(): string {
    return `${this.key} is not configured.`;
  }
}

export interface CloudPublicConfig {
  readonly clerkPublishableKey: string | null;
  readonly clerkJwtTemplate: string | null;
  readonly relayUrl: string | null;
  readonly relayTracing: {
    readonly tracesUrl: string | null;
    readonly tracesDataset: string | null;
    readonly tracesToken: string | null;
  };
}

export function trimNonEmpty(value: string | undefined): string | null {
  return value?.trim() || null;
}

function normalizeSecureUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveCloudPublicConfig(): CloudPublicConfig {
  return {
    clerkPublishableKey: trimNonEmpty(
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined,
    ),
    clerkJwtTemplate: trimNonEmpty(import.meta.env.VITE_CLERK_JWT_TEMPLATE as string | undefined),
    relayUrl: normalizeSecureRelayUrl(
      (import.meta.env.VITE_T3CODE_RELAY_URL as string | undefined) ?? "",
    ),
    relayTracing: {
      tracesUrl: normalizeSecureUrl(
        (import.meta.env.VITE_RELAY_OTLP_TRACES_URL as string | undefined) ?? "",
      ),
      tracesDataset: trimNonEmpty(
        import.meta.env.VITE_RELAY_OTLP_TRACES_DATASET as string | undefined,
      ),
      tracesToken: trimNonEmpty(import.meta.env.VITE_RELAY_OTLP_TRACES_TOKEN as string | undefined),
    },
  };
}

let desktopRelayTelemetry: boolean | null = null;
let serverRelayTelemetry: boolean | null = null;

export function setServerRelayTelemetry(allowed: boolean | null): void {
  serverRelayTelemetry = allowed;
}

export function relayTelemetryEnabled(): boolean | null {
  if (typeof window === "undefined") return true;
  if (window.desktopBridge) {
    desktopRelayTelemetry ??= window.desktopBridge.getRelayTelemetryEnabled();
    return desktopRelayTelemetry;
  }
  return serverRelayTelemetry ?? (isHostedStaticApp() ? true : null);
}

export function resolveRelayTracingConfig() {
  // The relay exporter is created during module initialization, so this must be synchronous.
  if (relayTelemetryEnabled() === false) {
    return null;
  }
  const { relayTracing } = resolveCloudPublicConfig();
  return relayTracing.tracesUrl && relayTracing.tracesDataset && relayTracing.tracesToken
    ? {
        tracesUrl: relayTracing.tracesUrl,
        tracesDataset: relayTracing.tracesDataset,
        tracesToken: relayTracing.tracesToken,
      }
    : null;
}

/** Privacy build: the desktop mounts Clerk only after the user chooses T3 Connect on this device. */
export const DESKTOP_CONNECT_OPT_IN_KEY = "t3code:privacy:desktop-connect";

function isDesktopRenderer(): boolean {
  return typeof window !== "undefined" && window.desktopBridge !== undefined;
}

export function isDesktopConnectOptedIn(): boolean {
  try {
    return window.localStorage.getItem(DESKTOP_CONNECT_OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

function hasCloudBuildConfig(): boolean {
  const config = resolveCloudPublicConfig();
  return Boolean(config.clerkPublishableKey && config.clerkJwtTemplate && config.relayUrl);
}

/** True in a desktop build with Connect stamps where the user has not chosen Connect yet. */
export function canOptInToDesktopConnect(): boolean {
  return isDesktopRenderer() && hasCloudBuildConfig() && !isDesktopConnectOptedIn();
}

/** Records the choice and reloads, so Clerk mounts from a clean start (as `retryClerkLoad` does). */
export function setDesktopConnectOptIn(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(DESKTOP_CONNECT_OPT_IN_KEY, "1");
    else window.localStorage.removeItem(DESKTOP_CONNECT_OPT_IN_KEY);
  } catch {
    return;
  }
  window.location.reload();
}

export function hasCloudPublicConfig(): boolean {
  const config = resolveCloudPublicConfig();
  if (!config.clerkPublishableKey || !config.clerkJwtTemplate || !config.relayUrl) {
    return false;
  }

  // Electron has its own auth runtime, mounted only after the user opts in to Connect.
  if (isDesktopRenderer()) return isDesktopConnectOptedIn();

  // Development keys also support private browser origins.
  if (typeof window === "undefined" || !config.clerkPublishableKey.startsWith("pk_live_")) {
    return true;
  }

  try {
    // Custom Frontend API hosts use clerk.<production domain>.
    const domain = clerkFrontendApiHostnameFromPublishableKey(config.clerkPublishableKey).replace(
      /^clerk\./u,
      "",
    );
    const { hostname, protocol, port } = window.location;
    return (
      protocol === "https:" &&
      port === "" &&
      (hostname === domain || hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}

export function resolveRelayClerkTokenOptions() {
  const { clerkJwtTemplate } = resolveCloudPublicConfig();
  if (!clerkJwtTemplate) {
    throw new CloudPublicConfigMissingError({ key: "T3CODE_CLERK_JWT_TEMPLATE" });
  }
  return relayClerkTokenOptions(clerkJwtTemplate);
}
