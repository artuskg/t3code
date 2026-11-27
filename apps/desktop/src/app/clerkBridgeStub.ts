/**
 * Privacy desktop build: T3 Connect is left out, so main and preload bundle no Clerk bridge.
 * vite.config.ts points the Clerk Electron packages here. No OAuth or token IPC, no passkey
 * addon, and no `setAsDefaultProtocolClient`; the app registers its own renderer scheme.
 */
export const createClerkBridge = (_options: unknown) => ({
  isPrimaryInstance: true,
  cleanup: () => undefined,
});
export const storage = (_options: unknown) => ({});
export const exposeClerkBridge = (_options: unknown) => undefined;
