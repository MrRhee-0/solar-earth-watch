import { describe, expect, it } from "vitest";
import type { EventWitness, KpPoint, MagPoint, PlasmaPoint, SolarImageWitness } from "../data/types";
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

describe("classifyPacketStatus", () => {
  it("keeps the target underdeclared when no X is selected", () => {
    const packet = classifyPacketStatus({
      selectedEvent: null,
      solarImage: image,
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus
    });

    expect(packet.measurementClosure).toBe("underdeclared");
    expect(packet.statusReasons).toContain("No selected solar event packet X.");
  });

  it("claims resolved only when all witnesses exist and alignment passes without fixtures", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: image,
      plasma,
      mag,
      kp,
      sourceStatus: liveStatus,
      selectedEventIsExplicit: true,
      eventCandidates: [event]
    });

    expect(packet.measurementClosure).toBe("resolved");
  });

  it("preserves fixture fallback as non-closure", () => {
    const packet = classifyPacketStatus({
      selectedEvent: event,
      solarImage: { ...image, source: "FIXTURE" },
      plasma: plasma.map((point) => ({ ...point, source: "FIXTURE" })),
      mag,
      kp,
      sourceStatus: {
        ...liveStatus,
        HELIOVIEWER: "fixture",
        NOAA_SWPC_SOLAR_WIND_PLASMA: "fixture"
      },
      selectedEventIsExplicit: true,
      eventCandidates: [event]
    });

    expect(packet.measurementClosure).toBe("fixture_fallback_active");
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
      selectedEventIsExplicit: false
    });

    expect(packet.measurementClosure).toBe("preservation_boundary_failure");
  });
});
