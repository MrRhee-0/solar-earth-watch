import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  WitnessEvidence
} from "../data/types";
import { parseUtcTime } from "../utils/dateRange";

const HOUR_MS = 60 * 60 * 1000;

export type AlignmentStatus =
  | "not_evaluated"
  | "underdeclared"
  | "source_resolved_only"
  | "carrier_signature_candidate"
  | "earth_response_candidate"
  | "packet_resolved"
  | "unresolved_carrier_alignment"
  | "preservation_boundary_failure";

export interface CarrierWindow {
  start: string;
  end: string;
  reason: string;
}

export interface AlignmentFeature {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  status: "present" | "missing" | "weak" | "strong";
  reason: string;
}

export interface EventCarrierAlignment {
  status: AlignmentStatus;
  selectedEventId: string | null;
  eventType: string | null;
  carrierWindow: CarrierWindow | null;
  features: AlignmentFeature[];
  blockingReasons: string[];
  supportingReasons: string[];
  alignmentScore: number;
  alignmentPassed: boolean;
}

export interface EvaluateEventCarrierAlignmentInput {
  selectedEvent: EventWitness | null;
  plasma: PlasmaPoint[];
  mag: MagPoint[];
  kp: KpPoint[];
  solarImageEvidence?: WitnessEvidence;
  donkiEvidence?: WitnessEvidence;
  plasmaEvidence?: WitnessEvidence;
  magEvidence?: WitnessEvidence;
  kpEvidence?: WitnessEvidence;
  eventCandidates?: EventWitness[];
  selectedEventIsExplicit?: boolean;
}

interface WindowParts {
  startMs: number;
  endMs: number;
  reason: string;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

function toWindow(parts: WindowParts): CarrierWindow {
  return {
    start: iso(parts.startMs),
    end: iso(parts.endMs),
    reason: parts.reason
  };
}

function eventWindowParts(selectedEvent: EventWitness): WindowParts | null {
  const startMs = parseUtcTime(selectedEvent.startTime);
  if (!Number.isFinite(startMs)) {
    return null;
  }

  switch (selectedEvent.eventType) {
    case "CME":
      return {
        startMs: startMs + 12 * HOUR_MS,
        endMs: startMs + 96 * HOUR_MS,
        reason:
          "CME carrier effects are evaluated in a broad post-event transit window."
      };
    case "FLR":
      return {
        startMs,
        endMs: startMs + 24 * HOUR_MS,
        reason:
          "Flare-linked near-Earth carrier/effect window is short unless linked CME exists."
      };
    case "HSS":
      return {
        startMs,
        endMs: startMs + 72 * HOUR_MS,
        reason: "High-speed stream carrier window."
      };
    case "GST": {
      const parsedEnd = selectedEvent.endTime
        ? parseUtcTime(selectedEvent.endTime)
        : Number.NaN;
      return {
        startMs: startMs - 12 * HOUR_MS,
        endMs: Number.isFinite(parsedEnd)
          ? parsedEnd + 12 * HOUR_MS
          : startMs + 24 * HOUR_MS,
        reason: "Geomagnetic storm is already an Earth-response event."
      };
    }
    case "IPS":
      return {
        startMs,
        endMs: startMs + 48 * HOUR_MS,
        reason: "Interplanetary shock carrier window."
      };
    case "SEP":
      return {
        startMs,
        endMs: startMs + 48 * HOUR_MS,
        reason: "Solar energetic particle event carrier window."
      };
    case "UNKNOWN":
    default:
      return {
        startMs,
        endMs: startMs + 96 * HOUR_MS,
        reason: "Unknown event type uses broad conservative window."
      };
  }
}

function responseWindowForCarrier(window: CarrierWindow): CarrierWindow | null {
  const startMs = parseUtcTime(window.start);
  const endMs = parseUtcTime(window.end);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  return {
    start: window.start,
    end: iso(endMs + 24 * HOUR_MS),
    reason: "Kp Earth-response marker is evaluated inside the carrier window plus 24 hours."
  };
}

export function carrierWindowForEvent(
  selectedEvent: EventWitness | null
): CarrierWindow | null {
  if (!selectedEvent) {
    return null;
  }

  const parts = eventWindowParts(selectedEvent);
  return parts ? toWindow(parts) : null;
}

export function pointInsideWindow(
  timeTag: string,
  window: CarrierWindow
): boolean {
  const pointMs = parseUtcTime(timeTag);
  const startMs = parseUtcTime(window.start);
  const endMs = parseUtcTime(window.end);
  return (
    Number.isFinite(pointMs) &&
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    pointMs >= startMs &&
    pointMs <= endMs
  );
}

function numericValues<T>(
  points: T[],
  selector: (point: T) => number | null
): number[] {
  return points
    .map(selector)
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

function maxValue(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function minValue(values: number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

function medianValue(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function deltaValue(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values) - Math.min(...values);
}

function pointCountFeature(
  key: string,
  label: string,
  count: number,
  reason: string
): AlignmentFeature {
  return {
    key,
    label,
    value: count,
    status: count > 0 ? "present" : "missing",
    reason
  };
}

function feature(
  key: string,
  label: string,
  value: number | string | null,
  unit: string | null,
  status: AlignmentFeature["status"],
  reason: string
): AlignmentFeature {
  return { key, label, value, unit, status, reason };
}

export function computePlasmaFeatures(points: PlasmaPoint[]): AlignmentFeature[] {
  const speedValues = numericValues(points, (point) => point.speed);
  const densityValues = numericValues(points, (point) => point.density);
  const temperatureValues = numericValues(points, (point) => point.temperature);
  const speedMax = maxValue(speedValues);
  const speedMedian = medianValue(speedValues);
  const speedDelta = deltaValue(speedValues);
  const densityMax = maxValue(densityValues);
  const densityMedian = medianValue(densityValues);
  const temperatureMax = maxValue(temperatureValues);
  const temperatureMedian = medianValue(temperatureValues);
  const temperatureElevated =
    temperatureMax !== null &&
    temperatureMedian !== null &&
    temperatureMedian > 0 &&
    temperatureMax >= temperatureMedian * 1.5;

  return [
    pointCountFeature(
      "plasma_point_count",
      "Plasma point count",
      points.length,
      points.length > 0
        ? "Plasma carrier points exist inside the selected carrier window."
        : "No plasma carrier points exist inside the selected carrier window."
    ),
    feature(
      "plasma_speed_max",
      "Speed max",
      speedMax,
      "km/s",
      speedMax === null ? "missing" : speedMax >= 650 ? "strong" : speedMax >= 500 ? "present" : "weak",
      speedMax === null
        ? "No speed values in the carrier window."
        : speedMax >= 650
          ? "Speed max crosses the strong high-speed carrier heuristic."
          : speedMax >= 500
            ? "Speed max crosses the carrier disturbance heuristic."
            : "Speed max is present but below the carrier disturbance heuristic."
    ),
    feature(
      "plasma_speed_median",
      "Speed median",
      speedMedian,
      "km/s",
      speedMedian === null ? "missing" : "present",
      speedMedian === null
        ? "No speed values for median computation."
        : "Speed median is retained as carrier context, not closure authority."
    ),
    feature(
      "plasma_speed_delta",
      "Speed delta",
      speedDelta,
      "km/s",
      speedDelta === null ? "missing" : speedDelta >= 100 ? "present" : "weak",
      speedDelta === null
        ? "No speed delta can be computed."
        : speedDelta >= 100
          ? "Speed delta crosses the carrier disturbance heuristic."
          : "Speed delta is present but below the carrier disturbance heuristic."
    ),
    feature(
      "plasma_density_max",
      "Density max",
      densityMax,
      "cm^-3",
      densityMax === null ? "missing" : densityMax >= 10 ? "present" : "weak",
      densityMax === null
        ? "No density values in the carrier window."
        : densityMax >= 10
          ? "Density max crosses the compression witness heuristic."
          : "Density max is present but below the compression witness heuristic."
    ),
    feature(
      "plasma_density_median",
      "Density median",
      densityMedian,
      "cm^-3",
      densityMedian === null ? "missing" : "present",
      densityMedian === null
        ? "No density values for median computation."
        : "Density median is retained as carrier context, not closure authority."
    ),
    feature(
      "plasma_temperature_max",
      "Temperature max",
      temperatureMax,
      "K",
      temperatureMax === null
        ? "missing"
        : temperatureElevated
          ? "present"
          : "weak",
      temperatureMax === null
        ? "No temperature values in the carrier window."
        : temperatureElevated
          ? "Temperature max is elevated relative to the local median."
          : "Temperature max exists but is not elevated relative to the local median."
    ),
    feature(
      "plasma_temperature_median",
      "Temperature median",
      temperatureMedian,
      "K",
      temperatureMedian === null ? "missing" : "present",
      temperatureMedian === null
        ? "No temperature values for median computation."
        : "Temperature median is retained as carrier context, not closure authority."
    )
  ];
}

function maxNegativeBzStreak(points: MagPoint[]): number {
  let current = 0;
  let max = 0;

  for (const point of points) {
    if ((point.bzGsm ?? 0) < 0) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }

  return max;
}

function estimateNegativeDurationHours(points: MagPoint[], streak: number): number | null {
  if (streak < 2 || points.length < 2) {
    return null;
  }

  const sorted = points
    .filter((point) => point.bzGsm !== null && point.bzGsm < 0)
    .map((point) => parseUtcTime(point.timeTag))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (sorted.length < 2) {
    return null;
  }

  const intervals = sorted
    .slice(1)
    .map((time, index) => time - sorted[index])
    .filter((interval) => interval > 0);
  const medianInterval = medianValue(intervals);

  return medianInterval ? (medianInterval * Math.max(streak - 1, 1)) / HOUR_MS : null;
}

export function computeMagFeatures(points: MagPoint[]): AlignmentFeature[] {
  const btValues = numericValues(points, (point) => point.bt);
  const bzValues = numericValues(points, (point) => point.bzGsm);
  const btMax = maxValue(btValues);
  const bzMin = minValue(bzValues);
  const bzStreak = maxNegativeBzStreak(points);
  const negativeDuration = estimateNegativeDurationHours(points, bzStreak);

  return [
    pointCountFeature(
      "mag_point_count",
      "Magnetometer point count",
      points.length,
      points.length > 0
        ? "Magnetometer carrier points exist inside the selected carrier window."
        : "No magnetometer carrier points exist inside the selected carrier window."
    ),
    feature(
      "mag_bt_max",
      "Bt max",
      btMax,
      "nT",
      btMax === null ? "missing" : btMax >= 20 ? "strong" : btMax >= 10 ? "present" : "weak",
      btMax === null
        ? "No Bt values in the carrier window."
        : btMax >= 20
          ? "Bt max crosses the strong magnetic-field heuristic."
          : btMax >= 10
            ? "Bt max crosses the magnetic-field disturbance heuristic."
            : "Bt max is present but below the magnetic-field disturbance heuristic."
    ),
    feature(
      "mag_bz_min",
      "Bz min",
      bzMin,
      "nT",
      bzMin === null ? "missing" : bzMin <= -10 ? "strong" : bzMin <= -5 ? "present" : "weak",
      bzMin === null
        ? "No Bz values in the carrier window."
        : bzMin <= -10
          ? "Bz min crosses the strong southward-field heuristic."
          : bzMin <= -5
            ? "Bz min crosses the southward-field disturbance heuristic."
            : "Bz min is present but below the southward-field disturbance heuristic."
    ),
    feature(
      "mag_bz_sustained_negative_count",
      "Sustained negative Bz count",
      bzStreak,
      "points",
      bzStreak >= 3 ? "present" : bzStreak > 0 ? "weak" : "missing",
      bzStreak >= 3
        ? "Bz is negative for three or more consecutive points."
        : bzStreak > 0
          ? "Bz has negative points but not a sustained three-point sequence."
          : "No negative Bz sequence is present."
    ),
    feature(
      "mag_bz_negative_duration_hours",
      "Negative Bz duration estimate",
      negativeDuration,
      "hours",
      negativeDuration === null ? "missing" : negativeDuration >= 1 ? "present" : "weak",
      negativeDuration === null
        ? "A duration estimate is unavailable from the observed cadence."
        : "Negative Bz duration is estimated from observed timestamp cadence."
    )
  ];
}

export function computeKpFeatures(points: KpPoint[]): AlignmentFeature[] {
  const kpValues = numericValues(points, (point) => point.kp);
  const kpMax = maxValue(kpValues);
  const latest = points.at(-1)?.kp ?? null;

  return [
    pointCountFeature(
      "kp_point_count",
      "Kp point count",
      points.length,
      points.length > 0
        ? "Kp points exist inside the response window."
        : "No Kp points exist inside the response window."
    ),
    feature(
      "kp_max",
      "Kp max",
      kpMax,
      null,
      kpMax === null ? "missing" : kpMax >= 5 ? "strong" : kpMax >= 4 ? "present" : "weak",
      kpMax === null
        ? "No Kp values in the response window."
        : kpMax >= 5
          ? "Kp max crosses the strong Earth-response heuristic."
          : kpMax >= 4
            ? "Kp max crosses the Earth-response heuristic."
            : "Kp is live but below the Earth-response heuristic."
    ),
    feature(
      "kp_latest",
      "Kp latest",
      latest,
      null,
      latest === null ? "missing" : latest >= 4 ? "present" : "weak",
      latest === null
        ? "No latest Kp value exists in the response window."
        : "Latest Kp is retained as Earth-response context, not packet authority."
    )
  ];
}

function hasFeature(
  features: AlignmentFeature[],
  keys: string[],
  statuses: AlignmentFeature["status"][] = ["present", "strong"]
) {
  return features.some(
    (featureItem) =>
      keys.includes(featureItem.key) && statuses.includes(featureItem.status)
  );
}

function sourceBacked(evidence: WitnessEvidence | undefined): boolean {
  return Boolean(
    evidence?.isLive &&
      !evidence.isFallback &&
      (evidence.evidenceStatus === "live_parsed" ||
        evidence.evidenceStatus === "live_rendered")
  );
}

function missingLiveEvidenceReason(
  label: string,
  evidence: WitnessEvidence | undefined
): string | null {
  if (sourceBacked(evidence)) {
    return null;
  }

  return `${label} is not live/source-backed evidence.`;
}

export function evaluateEventCarrierAlignment({
  selectedEvent,
  plasma,
  mag,
  kp,
  solarImageEvidence,
  donkiEvidence,
  plasmaEvidence,
  magEvidence,
  kpEvidence,
  eventCandidates = [],
  selectedEventIsExplicit = false
}: EvaluateEventCarrierAlignmentInput): EventCarrierAlignment {
  if (!selectedEvent) {
    return {
      status: "underdeclared",
      selectedEventId: null,
      eventType: null,
      carrierWindow: null,
      features: [],
      blockingReasons: ["No selected solar event packet X."],
      supportingReasons: [],
      alignmentScore: 0,
      alignmentPassed: false
    };
  }

  const carrierWindow = carrierWindowForEvent(selectedEvent);
  if (!carrierWindow) {
    return {
      status: "underdeclared",
      selectedEventId: selectedEvent.id,
      eventType: selectedEvent.eventType,
      carrierWindow: null,
      features: [],
      blockingReasons: ["Selected event start time cannot construct a carrier window."],
      supportingReasons: [],
      alignmentScore: 1,
      alignmentPassed: false
    };
  }

  const responseWindow = responseWindowForCarrier(carrierWindow);
  const plasmaInWindow = plasma.filter((point) =>
    pointInsideWindow(point.timeTag, carrierWindow)
  );
  const magInWindow = mag.filter((point) =>
    pointInsideWindow(point.timeTag, carrierWindow)
  );
  const kpInWindow = responseWindow
    ? kp.filter((point) => pointInsideWindow(point.timeTag, responseWindow))
    : [];
  const plasmaFeatures = computePlasmaFeatures(plasmaInWindow);
  const magFeatures = computeMagFeatures(magInWindow);
  const kpFeatures = computeKpFeatures(kpInWindow);
  const features = [...plasmaFeatures, ...magFeatures, ...kpFeatures];
  const plasmaDisturbance = hasFeature(plasmaFeatures, [
    "plasma_speed_max",
    "plasma_speed_delta",
    "plasma_density_max",
    "plasma_temperature_max"
  ]);
  const magDisturbance = hasFeature(magFeatures, [
    "mag_bt_max",
    "mag_bz_min",
    "mag_bz_sustained_negative_count"
  ]);
  const kpResponse = hasFeature(kpFeatures, ["kp_max"]);
  const overlappingEvents = eventCandidates.filter(
    (event) =>
      event.id !== selectedEvent.id && pointInsideWindow(event.startTime, carrierWindow)
  );
  const preservationBoundaryFailure =
    overlappingEvents.length > 0 && !selectedEventIsExplicit;
  const blockingReasons: string[] = [];
  const supportingReasons: string[] = [carrierWindow.reason];
  let score = 1;

  if (sourceBacked(solarImageEvidence) && solarImageEvidence?.isRenderable) {
    score += 1;
    supportingReasons.push("Live solar image render witness is present.");
  } else {
    const reason = missingLiveEvidenceReason(
      "Solar image render witness",
      solarImageEvidence
    );
    if (reason) {
      blockingReasons.push(reason);
    }
  }

  if (sourceBacked(donkiEvidence)) {
    score += 1;
    supportingReasons.push("Selected DONKI event is live/source-backed.");
  } else {
    const reason = missingLiveEvidenceReason("DONKI selected event", donkiEvidence);
    if (reason) {
      blockingReasons.push(reason);
    }
  }

  if (plasmaInWindow.length > 0) {
    score += 1;
    supportingReasons.push("Plasma points exist inside the carrier window.");
  } else {
    blockingReasons.push("No plasma points exist inside the carrier window.");
  }

  if (magInWindow.length > 0) {
    score += 1;
    supportingReasons.push("Magnetometer points exist inside the carrier window.");
  } else {
    blockingReasons.push("No magnetometer points exist inside the carrier window.");
  }

  if (kpInWindow.length > 0) {
    score += 1;
    supportingReasons.push("Kp points exist inside the response window.");
  } else {
    blockingReasons.push("No Kp points exist inside the response window.");
  }

  if (plasmaDisturbance) {
    score += 1;
    supportingReasons.push("Plasma carrier disturbance feature is present.");
  }

  if (magDisturbance) {
    score += 1;
    supportingReasons.push("Magnetometer carrier disturbance feature is present.");
  }

  if (kpResponse) {
    score += 1;
    supportingReasons.push("Kp Earth-response feature is present.");
  }

  if (!plasmaDisturbance && !magDisturbance) {
    blockingReasons.push("No plasma or magnetometer carrier disturbance feature is present.");
  }

  if ((plasmaDisturbance || magDisturbance) && !kpResponse) {
    blockingReasons.push("Carrier disturbance lacks a Kp Earth-response feature.");
  }

  const requiredSourceBacked =
    sourceBacked(solarImageEvidence) &&
    Boolean(solarImageEvidence?.isRenderable) &&
    sourceBacked(donkiEvidence) &&
    sourceBacked(plasmaEvidence) &&
    sourceBacked(magEvidence) &&
    sourceBacked(kpEvidence);

  if (!requiredSourceBacked) {
    blockingReasons.push("Not all required witnesses are live/source-backed.");
  }

  if (preservationBoundaryFailure) {
    blockingReasons.push(
      `${overlappingEvents.length} overlapping DONKI event candidate(s) share the carrier window without explicit X selection.`
    );
  } else if (overlappingEvents.length > 0 && selectedEventIsExplicit) {
    supportingReasons.push(
      `${overlappingEvents.length} overlapping DONKI event candidate(s) are preserved as warning burden because X was explicitly selected.`
    );
  }

  let status: AlignmentStatus;
  if (preservationBoundaryFailure) {
    status = "preservation_boundary_failure";
  } else if (
    plasmaInWindow.length === 0 ||
    magInWindow.length === 0 ||
    kpInWindow.length === 0
  ) {
    status = "unresolved_carrier_alignment";
  } else if (!plasmaDisturbance && !magDisturbance) {
    status = "source_resolved_only";
  } else if ((plasmaDisturbance || magDisturbance) && !kpResponse) {
    status = "carrier_signature_candidate";
  } else if (
    score >= 7 &&
    requiredSourceBacked &&
    plasmaDisturbance &&
    magDisturbance &&
    kpResponse
  ) {
    status = "packet_resolved";
  } else {
    status = "earth_response_candidate";
  }

  return {
    status,
    selectedEventId: selectedEvent.id,
    eventType: selectedEvent.eventType,
    carrierWindow,
    features,
    blockingReasons,
    supportingReasons,
    alignmentScore: score,
    alignmentPassed: status === "packet_resolved"
  };
}

export function hasCarrierAlignment(
  selectedEvent: EventWitness | null,
  plasma: PlasmaPoint[],
  mag: MagPoint[]
): boolean {
  const window = carrierWindowForEvent(selectedEvent);

  if (!window) {
    return false;
  }

  return (
    plasma.some((point) => pointInsideWindow(point.timeTag, window)) &&
    mag.some((point) => pointInsideWindow(point.timeTag, window))
  );
}

export function overlappingEventCandidates(
  selectedEvent: EventWitness | null,
  eventCandidates: EventWitness[]
): EventWitness[] {
  const window = carrierWindowForEvent(selectedEvent);

  if (!selectedEvent || !window) {
    return [];
  }

  return eventCandidates.filter(
    (event) =>
      event.id !== selectedEvent.id && pointInsideWindow(event.startTime, window)
  );
}
