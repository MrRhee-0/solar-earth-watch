import { describe, expect, it } from "vitest";
import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  WitnessEvidence
} from "../data/types";
import {
  carrierWindowForEvent,
  computeKpFeatures,
  computeMagFeatures,
  computePlasmaFeatures,
  evaluateEventCarrierAlignment
} from "./alignment";

const baseEvent: EventWitness = {
  id: "X-CME",
  eventType: "CME",
  startTime: "2026-06-15T00:00:00Z",
  endTime: null,
  linkedEvents: [],
  instruments: [],
  sourceLocation: "N14E32",
  activeRegionNum: null,
  catalog: "DONKI",
  raw: {},
  source: "NASA_DONKI"
};

const liveEvidence: Record<string, WitnessEvidence> = {
  HELIOVIEWER: {
    sourceKey: "HELIOVIEWER",
    evidenceStatus: "live_rendered",
    isLive: true,
    isFallback: false,
    isRenderable: true
  },
  NASA_DONKI: {
    sourceKey: "NASA_DONKI",
    evidenceStatus: "live_parsed",
    isLive: true,
    isFallback: false,
    isRenderable: false
  },
  NOAA_SWPC_SOLAR_WIND_PLASMA: {
    sourceKey: "NOAA_SWPC_SOLAR_WIND_PLASMA",
    evidenceStatus: "live_parsed",
    isLive: true,
    isFallback: false,
    isRenderable: false
  },
  NOAA_SWPC_SOLAR_WIND_MAG: {
    sourceKey: "NOAA_SWPC_SOLAR_WIND_MAG",
    evidenceStatus: "live_parsed",
    isLive: true,
    isFallback: false,
    isRenderable: false
  },
  NOAA_SWPC_KP: {
    sourceKey: "NOAA_SWPC_KP",
    evidenceStatus: "live_parsed",
    isLive: true,
    isFallback: false,
    isRenderable: false
  }
};

const quietPlasma: PlasmaPoint[] = [
  {
    timeTag: "2026-06-15T13:00:00Z",
    density: 4,
    speed: 360,
    temperature: 80000,
    source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
  },
  {
    timeTag: "2026-06-15T14:00:00Z",
    density: 5,
    speed: 390,
    temperature: 84000,
    source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
  }
];

const activePlasma: PlasmaPoint[] = [
  {
    timeTag: "2026-06-15T13:00:00Z",
    density: 7,
    speed: 430,
    temperature: 90000,
    source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
  },
  {
    timeTag: "2026-06-15T14:00:00Z",
    density: 12,
    speed: 660,
    temperature: 210000,
    source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
  },
  {
    timeTag: "2026-06-15T15:00:00Z",
    density: 5,
    speed: 520,
    temperature: 100000,
    source: "NOAA_SWPC_SOLAR_WIND_PLASMA"
  }
];

const quietMag: MagPoint[] = [
  {
    timeTag: "2026-06-15T13:00:00Z",
    bxGsm: 1,
    byGsm: 1,
    bzGsm: 1,
    bt: 3,
    latGsm: null,
    lonGsm: null,
    source: "NOAA_SWPC_SOLAR_WIND_MAG"
  }
];

const activeMag: MagPoint[] = [
  {
    timeTag: "2026-06-15T13:00:00Z",
    bxGsm: 1,
    byGsm: 1,
    bzGsm: -11,
    bt: 21,
    latGsm: null,
    lonGsm: null,
    source: "NOAA_SWPC_SOLAR_WIND_MAG"
  },
  {
    timeTag: "2026-06-15T13:05:00Z",
    bxGsm: 1,
    byGsm: 1,
    bzGsm: -8,
    bt: 15,
    latGsm: null,
    lonGsm: null,
    source: "NOAA_SWPC_SOLAR_WIND_MAG"
  },
  {
    timeTag: "2026-06-15T13:10:00Z",
    bxGsm: 1,
    byGsm: 1,
    bzGsm: -6,
    bt: 13,
    latGsm: null,
    lonGsm: null,
    source: "NOAA_SWPC_SOLAR_WIND_MAG"
  }
];

const quietKp: KpPoint[] = [
  {
    timeTag: "2026-06-15T18:00:00Z",
    kp: 3,
    source: "NOAA_SWPC_KP"
  }
];

const activeKp: KpPoint[] = [
  {
    timeTag: "2026-06-15T18:00:00Z",
    kp: 5,
    source: "NOAA_SWPC_KP"
  }
];

function evaluate(overrides: {
  plasma?: PlasmaPoint[];
  mag?: MagPoint[];
  kp?: KpPoint[];
  solarImageEvidence?: WitnessEvidence;
  donkiEvidence?: WitnessEvidence;
} = {}) {
  return evaluateEventCarrierAlignment({
    selectedEvent: baseEvent,
    plasma: overrides.plasma ?? activePlasma,
    mag: overrides.mag ?? activeMag,
    kp: overrides.kp ?? activeKp,
    solarImageEvidence: overrides.solarImageEvidence ?? liveEvidence.HELIOVIEWER,
    donkiEvidence: overrides.donkiEvidence ?? liveEvidence.NASA_DONKI,
    plasmaEvidence: liveEvidence.NOAA_SWPC_SOLAR_WIND_PLASMA,
    magEvidence: liveEvidence.NOAA_SWPC_SOLAR_WIND_MAG,
    kpEvidence: liveEvidence.NOAA_SWPC_KP,
    eventCandidates: [baseEvent],
    selectedEventIsExplicit: true
  });
}

describe("carrier window construction", () => {
  it("uses CME +12h to +96h", () => {
    expect(carrierWindowForEvent(baseEvent)).toMatchObject({
      start: "2026-06-15T12:00:00Z",
      end: "2026-06-19T00:00:00Z"
    });
  });

  it("uses FLR start to +24h", () => {
    const window = carrierWindowForEvent({ ...baseEvent, eventType: "FLR" });
    expect(window).toMatchObject({
      start: "2026-06-15T00:00:00Z",
      end: "2026-06-16T00:00:00Z"
    });
  });

  it("uses GST pre/post response window", () => {
    const window = carrierWindowForEvent({
      ...baseEvent,
      eventType: "GST",
      endTime: "2026-06-15T06:00:00Z"
    });
    expect(window).toMatchObject({
      start: "2026-06-14T12:00:00Z",
      end: "2026-06-15T18:00:00Z"
    });
  });

  it("uses UNKNOWN broad fallback", () => {
    const window = carrierWindowForEvent({ ...baseEvent, eventType: "UNKNOWN" });
    expect(window).toMatchObject({
      start: "2026-06-15T00:00:00Z",
      end: "2026-06-19T00:00:00Z"
    });
  });
});

describe("plasma feature extraction", () => {
  it("marks speed max >= 650 as strong", () => {
    const features = computePlasmaFeatures(activePlasma);
    expect(features.find((feature) => feature.key === "plasma_speed_max")).toMatchObject({
      status: "strong"
    });
  });

  it("marks speed delta >= 100 as present", () => {
    const features = computePlasmaFeatures(activePlasma);
    expect(features.find((feature) => feature.key === "plasma_speed_delta")).toMatchObject({
      status: "present"
    });
  });

  it("marks empty windows as missing", () => {
    const features = computePlasmaFeatures([]);
    expect(features.find((feature) => feature.key === "plasma_point_count")).toMatchObject({
      status: "missing"
    });
  });
});

describe("mag feature extraction", () => {
  it("marks Bz <= -10 as strong", () => {
    const features = computeMagFeatures(activeMag);
    expect(features.find((feature) => feature.key === "mag_bz_min")).toMatchObject({
      status: "strong"
    });
  });

  it("marks Bt >= 20 as strong", () => {
    const features = computeMagFeatures(activeMag);
    expect(features.find((feature) => feature.key === "mag_bt_max")).toMatchObject({
      status: "strong"
    });
  });

  it("detects sustained negative Bz", () => {
    const features = computeMagFeatures(activeMag);
    expect(
      features.find((feature) => feature.key === "mag_bz_sustained_negative_count")
    ).toMatchObject({
      value: 3,
      status: "present"
    });
  });
});

describe("Kp feature extraction", () => {
  it("marks Kp >= 5 as strong", () => {
    const features = computeKpFeatures(activeKp);
    expect(features.find((feature) => feature.key === "kp_max")).toMatchObject({
      status: "strong"
    });
  });

  it("marks live Kp below 4 as weak", () => {
    const features = computeKpFeatures(quietKp);
    expect(features.find((feature) => feature.key === "kp_max")).toMatchObject({
      status: "weak"
    });
  });
});

describe("alignment decision", () => {
  it("keeps all sources with no disturbance features as source_resolved_only", () => {
    const alignment = evaluate({
      plasma: quietPlasma,
      mag: quietMag,
      kp: quietKp
    });

    expect(alignment.status).toBe("source_resolved_only");
    expect(alignment.alignmentPassed).toBe(false);
  });

  it("keeps plasma/mag features without Kp as carrier_signature_candidate", () => {
    const alignment = evaluate({ kp: quietKp });

    expect(alignment.status).toBe("carrier_signature_candidate");
    expect(alignment.alignmentPassed).toBe(false);
  });

  it("keeps feature support without live image evidence as earth_response_candidate", () => {
    const alignment = evaluate({
      solarImageEvidence: {
        ...liveEvidence.HELIOVIEWER,
        evidenceStatus: "unavailable",
        isLive: false,
        isRenderable: false
      }
    });

    expect(alignment.status).toBe("earth_response_candidate");
    expect(alignment.alignmentPassed).toBe(false);
  });

  it("resolves when the full feature set and live evidence are present", () => {
    const alignment = evaluate();

    expect(alignment.status).toBe("packet_resolved");
    expect(alignment.alignmentScore).toBe(9);
    expect(alignment.alignmentPassed).toBe(true);
  });
});
