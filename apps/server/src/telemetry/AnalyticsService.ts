// Privacy fork: product analytics is compiled out. There is no ingest endpoint, key,
// HTTP client, buffer or timer; every record is dropped where it is made.
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export class AnalyticsService extends Context.Service<
  AnalyticsService,
  {
    readonly record: (
      event: string,
      properties?: Readonly<Record<string, unknown>>,
    ) => Effect.Effect<void>;
  }
>()("t3/telemetry/AnalyticsService") {}

export const layer = Layer.succeed(
  AnalyticsService,
  // Untraced: a span per dropped event would be pure overhead.
  AnalyticsService.of({ record: Effect.fnUntraced(function* () {}) }),
);
