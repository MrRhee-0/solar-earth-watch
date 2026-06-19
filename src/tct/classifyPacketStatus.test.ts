import { describe, expect, it } from "vitest";
import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  RenderStatus,
  SolarImageRenderWitness,
  SolarImageWitness,
  WitnessEvidence
} from "../data/types";
import { classifyPacketStatus } from "./classifyPacketStatus";

const event: EventWitness = {
  id: "X-001",
  eventType: "CME",
  startTime: "2026-06-15T02:00:00Z",
  endTime: null,
  linkedEvents: [],
  instruments: [],
  sourceLocation: "N14E32",
  activeRegionNum: null,
  catalog: "DONKI",
  raw: {},
  source: "NASA_DONKI"
};

const image: SolarImageWitness = {
  imageUrl: "https://example.invalid/sun.png",
  timestamp: "2026-06-15T02:00:00Z",
  sourceId: 10,
  observatory: "SDO",
  instrument: "AIA",
  measurement: "171",
  metadataStatus: "live",
  imageFetchStatus: "live",
  renderStatus: "rendered",
  evidenceStatus: "live_parsed",
  isLiveImage: true,
  isFallbackImage: false,
  fallbackReason: null,
  attemptedUrls: ["https://example.invalid/sun.png"],
  selectedUrl: "https://example.invalid/sun.png",
  error: null,
  source: "HELIOVIEWER"
};

const plasma: PlasmaPoint[] = [
  {
    timeTag: "2026-06-15T06:00:00Z",
    density: 6,
    speed: 420,
    temperature: 90000,
    source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
  }
];

const mag: MagPoint[] = [
  {
    timeTag: "2026-06-15T06:00:00Z",
    bxGsm: 1,
    byGsm: 0,
    bzGsm: -3,
    bt: 4,
    latGsm: 2,
    lonGsm: 300,
    source: "NOAA_SWPC_SOLAR_WIND_MAG"
  }
];

const kp: KpPoint[] = [
  {
    timeTag: "2026-06-15T09:00:00Z",
    kp: 3.33,
    source: "NOAA_SWPC_KP"
  }
];

const liveStatus = {
  NASA_DONKI: "live",
  NOAA_SWPC_SOLAR_WIND_PLASMA: "live",
  NOAA_SWPC_SOLAR_WIND_MAG: "live",
  NOAA_SWPC_KP: "live",
  HELIOVIEWER: "live"
} as const;

function renderWitness(status: RenderStatus): SolarImageRenderWitness {
  return {
    status,
    naturalWidth: status === "rendered" ? 1024 : null,
    naturalHeight: status === "rendered" ? 1024 : null,
    clientWidth: status === "rendered" ? 384 : null,
    clientHeight: status === "rendered" ? 384 : null,
    observedAt: status === "not_attempted" ? null : "2026-06-15T06:00:00Z",
    error:
      status === "render_error"
        ? "Solar image URL failed browser render."
        : null
  };
}

function evidence(overrides: Partial<WitnessEvidence> = {}): WitnessEvidence[] {
  const base: WitnessEvidence[] = [
    {
      sourceKey: "HELIOVIEWER",
      evidenceStatus: "live_rendered",
      isLive: true,
      isFallback: false,
      isRenderable: true,
      recordCount: 1,
      latestTimestamp: image.timestamp
    },
    {
      sourceKey: "NASA_DONKI",
      evidenceStatus: "live_parsed",
      isLive: true,
      isFallback: false,
      isRenderable: false,
      recordCount: 1,
      latestTimestamp: event.startTime
    },
    {
      sourceKey: "NOAA_SWPC_SOLAR_WIND_PLASMA",
      evidenceStatus: "live_parsed",
      isLive: true,
      isFallback: false,
      isRenderable: false,
      recordCount: plasma.length,
      latestTimestamp: plasma[plasma.length - 1]?.timeTag
    },
    {
      sourceKey: "NOAA_SWPC_SOLAR_WIND_MAG",
      evidenceStatus: "live_parsed",
      isLive: true,
      isFallback: false,
      isRenderable: false,
      recordCount: mag.length,
      latestTimestamp: mag[mag.length - 1]?.timeTag
    },
    {
      sourceKey: "NOAA_SWPC_KP",
      evidenceStatus: "live_parsed",
      isLive: true,
      isFallback: false,
      isRenderable: false,
      recordCount: kp.length,
      latestTimestamp: kp[kp.length - 1]?.timeTag
    }
  ];

  if (!overrides.sourceKey) {
    return base;
  }

  return base.map((entry) =>
    entry.sourceKey === overrides.sourceKey ? { ...entry, ...overrides } : entry
  );
}

describe("classifyPacketStatus", () => {
  it("keeps the target underdeclared when no X is selected", () => {
    const packet = classifyPacketStatus({
      selectedEvent: null,
      solarImage: image,
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      solarImageRenderWitness: renderWitness("rendered"),
      witnessEvidence: evidence()
    });

    expect(packet.measurementClosure).toBe("underdeclared");
    expect(packet.statusReasons).toContain("No selected solar event packet X.");
  });

  it("does not resolve when the selected event has no solar image URL", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: { ...image, imageUrl: null, renderStatus: "missing_url" },
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("missing_url"),
      witnessEvidence: evidence({
        sourceKey: "HELIOVIEWER",
        evidenceStatus: "unavailable",
        isLive: false,
        isRenderable: false
      })
    });

    expect(packet.measurementClosure).toBe("unavailable_witness");
    expect(packet.statusReasons).toContain(
      "Solar image witness has no renderable image URL."
    );
    expect(
      packet.witnessRoles.find((row) => row.label === "solar image witness")?.status
    ).toBe("unavailable_witness");
  });

  it("does not resolve when the solar image URL fails browser render", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: { ...image, renderStatus: "render_error" },
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("render_error"),
      witnessEvidence: evidence({
        sourceKey: "HELIOVIEWER",
        evidenceStatus: "error",
        isLive: false,
        isRenderable: false,
        reason: "Solar image URL failed browser render."
      })
    });

    expect(packet.measurementClosure).toBe("unavailable_witness");
    expect(packet.statusReasons).toContain(
      "Solar image URL failed browser render."
    );
    expect(
      packet.witnessRoles.find((row) => row.label === "solar image witness")?.status
    ).toBe("unavailable_witness");
  });

  it("keeps the frontier when required witnesses exist but alignment is not proven", () => {
    const latePlasma: PlasmaPoint[] = [
      {
        ...plasma[0],
        timeTag: "2026-06-20T06:00:00Z"
      }
    ];
    const lateMag: MagPoint[] = [
      {
        ...mag[0],
        timeTag: "2026-06-20T06:00:00Z"
      }
    ];

    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: image,
      plasma: latePlasma,
      mag: lateMag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("rendered"),
      witnessEvidence: evidence()
    });

    expect(packet.measurementClosure).toBe("frontier_preserved");
    expect(packet.statusReasons).toContain(
      "Solar image render witness observed with nonzero natural dimensions."
    );
    expect(packet.statusReasons).toContain(
      "Required witnesses are present, but event-carrier alignment is not closure-sufficient."
    );
    expect(
      packet.witnessRoles.find((row) => row.label === "solar image witness")
    ).toMatchObject({
      sourceFetch: "live",
      evidence: "live_rendered",
      closure: "frontier_preserved"
    });
  });

  it("keeps the frontier when image render is loading even with a URL", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: { ...image, renderStatus: "loading" },
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("loading"),
      witnessEvidence: evidence({
        sourceKey: "HELIOVIEWER",
        evidenceStatus: "live_parsed",
        isRenderable: false
      })
    });

    expect(packet.measurementClosure).toBe("frontier_preserved");
    expect(packet.statusReasons).toContain(
      "Solar image URL exists, but browser render is loading."
    );
  });

  it("claims resolved only when all witnesses render and alignment passes without fixtures", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: image,
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("rendered"),
      witnessEvidence: evidence()
    });

    expect(packet.measurementClosure).toBe("resolved");
    expect(
      packet.witnessRoles.find((row) => row.label === "solar image witness")
    ).toMatchObject({
      sourceFetch: "live",
      evidence: "live_rendered",
      closure: "resolved"
    });
    expect(packet.statusReasons).toContain(
      "Solar image render witness observed with nonzero natural dimensions."
    );
    expect(packet.statusReasons).toContain(
      "packet closure resolved: selected event, rendered solar image witness, L1 plasma, L1 magnetometer, Kp marker, and carrier-window alignment are present."
    );
  });

  it("preserves fixture fallback as non-closure", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: {
        ...image,
        source: "FIXTURE",
        metadataStatus: "fixture",
        imageFetchStatus: "fixture",
        evidenceStatus: "fixture_fallback",
        isLiveImage: false,
        isFallbackImage: true,
        fallbackReason: "source fetch failure: HTTP 404"
      },
      plasma: plasma.map((point) => ({ ...point, source: "FIXTURE" })),
      mag,
      kp,
      sourceStatus: {
        ...liveStatus,
        HELIOVIEWER: "fixture",
        NOAA_SWPC_SOLAR_WIND_PLASMA: "fixture"
      },
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("rendered"),
      witnessEvidence: evidence({
        sourceKey: "HELIOVIEWER",
        evidenceStatus: "fixture_fallback",
        isLive: false,
        isFallback: true,
        isRenderable: true,
        reason: "source fetch failure: HTTP 404"
      })
    });

    expect(packet.measurementClosure).toBe("fixture_fallback_active");
    expect(packet.measurementClosure).not.toBe("resolved");
    expect(packet.statusReasons).toContain(
      "Solar image is rendered from fallback, not live Helioviewer witness."
    );
    expect(
      packet.witnessRoles.find((row) => row.label === "solar image witness")
        ?.evidence
    ).toBe("fixture_fallback");
  });

  it("detects preservation-boundary failure for non-explicit overlapping candidates", () => {
    const overlapping = {
      ...event,
      id: "X-002",
      startTime: "2026-06-15T08:00:00Z"
    };

    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: image,
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      eventCandidates: [event, overlapping],
      selectedEventIsExplicit: false,
      solarImageRenderWitness: renderWitness("rendered"),
      witnessEvidence: evidence()
    });

    expect(packet.measurementClosure).toBe("preservation_boundary_failure");
  });

  it("does not let a resolved representation surface force Θ_meas(X) resolved", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: { ...image, imageUrl: null, renderStatus: "missing_url" },
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event],
      solarImageRenderWitness: renderWitness("missing_url"),
      witnessEvidence: evidence({
        sourceKey: "HELIOVIEWER",
        evidenceStatus: "unavailable",
        isLive: false,
        isRenderable: false
      }),
      representationSurfaceResolved: true
    });

    expect(packet.representationSurfaceStatus).toBe("resolved");
    expect(packet.measurementClosure).not.toBe("resolved");
  });
});
