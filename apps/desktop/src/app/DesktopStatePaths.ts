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

/** The privacy app reads only its own variable, so an inherited T3CODE_HOME never reaches it. */
export const desktopHomeEnvName = (): "T3CODE_PRIVACY_HOME" | "T3CODE_HOME" =>
  isPrivacyIdentityBuild() ? "T3CODE_PRIVACY_HOME" : "T3CODE_HOME";

/**
 * Why the privacy app must not start with this home, or null. It refuses the stock default
 * `~/.t3`, which the stock app beside it owns.
 */
export function privacyHomeRefusal(input: {
  readonly homeDirectory: string;
  readonly baseDir: string;
  readonly resolvePath: (...segments: string[]) => string;
}): string | null {
  if (!isPrivacyIdentityBuild()) return null;
  const stockHome = input.resolvePath(input.homeDirectory, ".t3");
  if (input.resolvePath(input.baseDir) !== stockHome) return null;
  return `T3 Code (Privacy) will not use ${stockHome}, the stock T3 Code home. Set T3CODE_PRIVACY_HOME to another folder, or unset it to use ~/.t3-privacy.`;
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
