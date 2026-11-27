import * as Option from "effect/Option";

export type JoinPath = (first: string, ...segments: string[]) => string;

declare const __T3CODE_DESKTOP_PRIVACY_IDENTITY__: boolean | undefined;

/**
 * Privacy build (set by vite.config.ts): its own name, home and Electron profile, so it never
 * shares app data with a stock T3 Code installed beside it. Tests run unbundled, with it off.
 */
export function isPrivacyIdentityBuild(): boolean {
  return (
    typeof __T3CODE_DESKTOP_PRIVACY_IDENTITY__ !== "undefined" &&
    __T3CODE_DESKTOP_PRIVACY_IDENTITY__ === true
  );
}

function normalizeConfiguredBaseDir(t3Home: Option.Option<string>): Option.Option<string> {
  if (Option.isNone(t3Home)) {
    return Option.none();
  }
  const trimmed = t3Home.value.trim();
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
}

export function resolveDesktopBaseDir(input: {
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
}): string {
  return Option.getOrElse(normalizeConfiguredBaseDir(input.t3Home), () =>
    input.joinPath(input.homeDirectory, isPrivacyIdentityBuild() ? ".t3-privacy" : ".t3"),
  );
}

export function resolveDesktopStateDir(input: {
  readonly baseDir: string;
  readonly isDevelopment: boolean;
  readonly joinPath: JoinPath;
  readonly t3Home: Option.Option<string>;
}): string {
  const useDevSubdir =
    input.isDevelopment && Option.isNone(normalizeConfiguredBaseDir(input.t3Home));
  return input.joinPath(input.baseDir, useDevSubdir ? "dev" : "userdata");
}
