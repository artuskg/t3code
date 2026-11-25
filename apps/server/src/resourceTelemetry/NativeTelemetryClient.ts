// Privacy fork: the native resource-monitor sidecar is not built, shipped or spawned.
// The server binds `layer`, which reports the monitor as unavailable; diagnostics, process
// metrics and terminal subprocess detection already handle that state.
import type {
  ResourceMonitorHelloEvent,
  ResourceMonitorSnapshotEvent,
  ResourceTelemetrySourceStatus,
} from "@t3tools/contracts";
import type {
  HostPowerSnapshot,
  ResourceMonitorCapabilities,
  ResourceMonitorExternalProcess,
  ResourceMonitorProcessTableEntry,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

// The sidecar treated 0 as "sample only on request".
const IDLE_SAMPLE_INTERVAL_MS = 0;

export class NativeTelemetryUnavailable extends Schema.TaggedError<NativeTelemetryUnavailable>()(
  "NativeTelemetryUnavailable",
  {
    reason: Schema.String,
  },
) {
  override get message(): string {
    return `Resource monitor is unavailable: ${this.reason}`;
  }
}

export type NativeTelemetryClientError = NativeTelemetryUnavailable;

export interface NativeTelemetryClientHealth {
  readonly status: ResourceTelemetrySourceStatus;
  readonly hello: Option.Option<ResourceMonitorHelloEvent>;
  readonly lastSampleAt: Option.Option<DateTime.Utc>;
  readonly lastError: Option.Option<string>;
  readonly restartCount: number;
  readonly sampleIntervalMs: number;
}

export interface NativeTelemetrySnapshot {
  readonly generation: number;
  readonly snapshot: ResourceMonitorSnapshotEvent;
}

export class NativeTelemetryClient extends Context.Service<
  NativeTelemetryClient,
  {
    readonly capabilities: Effect.Effect<ResourceMonitorCapabilities, NativeTelemetryClientError>;
    readonly snapshots: Stream.Stream<NativeTelemetrySnapshot, NativeTelemetryClientError>;
    readonly readHistory: (
      windowMs: number,
    ) => Effect.Effect<ReadonlyArray<ResourceMonitorSnapshotEvent>, NativeTelemetryClientError>;
    readonly setExternalProcesses: (
      processes: ReadonlyArray<ResourceMonitorExternalProcess>,
    ) => Effect.Effect<void, NativeTelemetryClientError>;
    readonly setHostPowerState: (
      snapshot: HostPowerSnapshot,
    ) => Effect.Effect<void, NativeTelemetryClientError>;
    readonly sampleNow: Effect.Effect<NativeTelemetrySnapshot, NativeTelemetryClientError>;
    readonly processTable: Effect.Effect<
      ReadonlyArray<ResourceMonitorProcessTableEntry>,
      NativeTelemetryClientError
    >;
    readonly retry: Effect.Effect<boolean>;
    readonly health: Effect.Effect<NativeTelemetryClientHealth>;
    readonly subscribeHealth: Effect.Effect<
      {
        readonly latest: NativeTelemetryClientHealth;
        readonly changes: Stream.Stream<NativeTelemetryClientHealth>;
      },
      never,
      Scope.Scope
    >;
  }
>()("t3/resourceTelemetry/NativeTelemetryClient") {}

const NOT_INCLUDED = "The resource monitor is not included in this build.";

const notIncluded = () => new NativeTelemetryUnavailable({ reason: NOT_INCLUDED });

export const layer: Layer.Layer<NativeTelemetryClient> = Layer.succeed(
  NativeTelemetryClient,
  NativeTelemetryClient.of({
    capabilities: Effect.fail(notIncluded()),
    snapshots: Stream.empty,
    readHistory: Effect.fn("NativeTelemetryClient.readHistory")(function* () {
      return yield* notIncluded();
    }),
    setExternalProcesses: Effect.fn("NativeTelemetryClient.setExternalProcesses")(function* () {}),
    setHostPowerState: Effect.fn("NativeTelemetryClient.setHostPowerState")(function* () {}),
    sampleNow: Effect.fail(notIncluded()),
    processTable: Effect.fail(notIncluded()),
    retry: Effect.succeed(false),
    health: Effect.succeed({
      status: "unavailable",
      hello: Option.none(),
      lastSampleAt: Option.none(),
      lastError: Option.some(NOT_INCLUDED),
      restartCount: 0,
      sampleIntervalMs: IDLE_SAMPLE_INTERVAL_MS,
    }),
    subscribeHealth: Effect.succeed({
      latest: {
        status: "unavailable",
        hello: Option.none(),
        lastSampleAt: Option.none(),
        lastError: Option.some(NOT_INCLUDED),
        restartCount: 0,
        sampleIntervalMs: IDLE_SAMPLE_INTERVAL_MS,
      },
      changes: Stream.empty,
    }),
  }),
);

export const layerTest = (
  overrides: Partial<NativeTelemetryClient["Service"]> = {},
): Layer.Layer<NativeTelemetryClient> => {
  const health =
    overrides.health ??
    Effect.succeed({
      status: "unavailable" as const,
      hello: Option.none<ResourceMonitorHelloEvent>(),
      lastSampleAt: Option.none<DateTime.Utc>(),
      lastError: Option.some("Resource monitor test implementation is unavailable."),
      restartCount: 0,
      sampleIntervalMs: IDLE_SAMPLE_INTERVAL_MS,
    });
  return Layer.succeed(
    NativeTelemetryClient,
    NativeTelemetryClient.of({
      capabilities: Effect.succeed({
        cumulativeCpuTime: true,
        currentCpuPercent: true,
        residentMemory: true,
        virtualMemory: true,
        ioBytes: true,
        processStartTime: true,
        processTree: true,
      }),
      snapshots: Stream.empty,
      readHistory: Effect.fn("NativeTelemetryClient.readHistory")(function () {
        return Effect.fail(
          new NativeTelemetryUnavailable({
            reason: "No resource monitor history was configured for this test.",
          }),
        );
      }),
      setExternalProcesses: Effect.fn("NativeTelemetryClient.setExternalProcesses")(function () {
        return Effect.void;
      }),
      setHostPowerState: Effect.fn("NativeTelemetryClient.setHostPowerState")(function () {
        return Effect.void;
      }),
      sampleNow: Effect.fail(
        new NativeTelemetryUnavailable({
          reason: "No resource monitor sample was configured for this test.",
        }),
      ),
      processTable: Effect.fail(
        new NativeTelemetryUnavailable({
          reason: "No resource monitor process table was configured for this test.",
        }),
      ),
      retry: Effect.succeed(false),
      health,
      subscribeHealth:
        overrides.subscribeHealth ??
        health.pipe(
          Effect.map((initial) => ({
            latest: initial,
            changes: Stream.empty,
          })),
        ),
      ...overrides,
    }),
  );
};
