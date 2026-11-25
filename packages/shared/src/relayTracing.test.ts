import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Tracer from "effect/Tracer";

import { withLocalTracing, withRelayClientTracing } from "./relayTracing.ts";

function collectingTracer(spans: Array<string>): Tracer.Tracer {
  return Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      const end = span.end.bind(span);
      span.end = (endTime, exit) => {
        end(endTime, exit);
        spans.push(span.name);
      };
      return span;
    },
  });
}

describe("relay tracing", () => {
  it.effect("keeps relay and local work on the ambient tracer", () =>
    Effect.gen(function* () {
      const spans: Array<string> = [];

      yield* Effect.void.pipe(
        Effect.withSpan("relay.connection.nested"),
        Effect.andThen(Effect.void.pipe(Effect.withSpan("sql.execute"), withLocalTracing)),
        Effect.withSpan("environment.orchestration.threadSnapshot"),
        withRelayClientTracing,
        Effect.withTracer(collectingTracer(spans)),
      );

      expect(spans).toEqual([
        "relay.connection.nested",
        "sql.execute",
        "environment.orchestration.threadSnapshot",
      ]);
    }),
  );
});
