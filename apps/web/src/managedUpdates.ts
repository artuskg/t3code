import { managedUpdatesDenial as policyUpdatesDenial } from "@t3tools/client-runtime/contract-labels";
import type { ManagedPolicySummary } from "@t3tools/contracts";
import { msg } from "gt-react";

import { m, type MessageResolver } from "./i18n/messages";

/**
 * Privacy desktop build: neither this app nor the servers it connects to update from here; they
 * update only through the owner's release pipeline. Everywhere else the managed policy decides.
 */
export function managedUpdatesDenial(
  summary: ManagedPolicySummary | undefined,
  resolve: MessageResolver = m,
): string | undefined {
  if (typeof window !== "undefined" && window.desktopBridge !== undefined) {
    return resolve(
      msg("This app doesn't install updates. Update through your own release pipeline."),
    );
  }
  return policyUpdatesDenial(summary, resolve);
}
