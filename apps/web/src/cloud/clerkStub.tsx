/**
 * Privacy desktop build: T3 Connect is left out, so no Clerk SDK, key or frontend API host is
 * bundled. vite.config.ts points the Clerk packages here for builds. With no Connect config
 * stamped, `hasCloudPublicConfig()` is false and nothing renders or calls these.
 */
import type { ReactNode } from "react";

const signedOut = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  getToken: async () => null,
  signOut: async () => undefined,
} as const;

// oxlint-disable-next-line t3code/no-hookless-use-function -- stands in for Clerk's hook of this name
export const useAuth = () => signedOut;
// oxlint-disable-next-line t3code/no-hookless-use-function -- stands in for Clerk's hook of this name
export const useClerk = () => signedOut;
export const ClerkProvider = ({ children }: { readonly children?: ReactNode }) => children;
export const UserButton = Object.assign(() => null, { UserProfilePage: () => null });
export const passkeys = undefined;
export const createPasskeys = () => undefined;
