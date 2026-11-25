import { withLocalTracing, withRelayClientTracing } from "@t3tools/shared/relayTracing";
import type * as Effect from "effect/Effect";

// Privacy fork: relay requests are not exported to a relay trace backend. These keep the
// upstream call sites and leave every request on the local tracer.

export const traceRelayRequest = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => effect.pipe(withRelayClientTracing);

export const traceAuthenticatedRelayRequest = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  _authentication: { readonly startTime: bigint; readonly endTime: bigint },
): Effect.Effect<A, E, R> => effect.pipe(withRelayClientTracing);

export const traceLocalHandlerWork = withLocalTracing;
