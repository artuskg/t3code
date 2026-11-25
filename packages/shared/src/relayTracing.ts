import type * as Effect from "effect/Effect";

// Privacy fork: T3 Connect relay spans are never exported. Upstream wraps relay work in these
// helpers to switch it onto an OTLP tracer; here they leave the effect on the ambient tracer.

/** Runs `effect` unchanged; relay operations stay on the local tracer. */
export const withRelayClientTracing = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => effect;

/** Runs `effect` unchanged; there is no relay tracer to step out of. */
export const withLocalTracing = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  effect;
