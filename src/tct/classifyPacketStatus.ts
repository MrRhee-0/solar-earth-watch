import type {
  EvidenceStatus,
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  RenderStatus,
  SolarImageRenderWitness,
  SolarImageWitness,
  SourceStatus,
  WitnessEvidence,
  WitnessSource
} from "../data/types";
import {
  evaluateEventCarrierAlignment,
  overlappingEventCandidates,
  type EventCarrierAlignment
} from "./alignment";
import type { PacketStatus, TctPacketStatus } from "./packetTypes";
import { witnessRole } from "./classifyWitness";

export const TCT_C =
  "Expose one solar-to-Earth event as preserved distinguishability across solar image, event record, L1 carrier trace, magnetometer trace, and Earth-response marker.";

export const TCT_THETA_C = [
  "solar image witness",
  "DONKI event record",
  "L1 plasma carrier trace",
  "L1 magnetometer carrier trace",
  "planetary K-index Earth-response marker"
];

export const TCT_INVARIANT = [
  "event timestamp continuity",
  "event type continuity",
  "linked-event continuity where present",
  "source-region continuity where present",
  "carrier-window continuity"
];

export const TCT_BOUNDARY = [
  "do not merge unrelated DONKI events",
  "do not infer a solar source when no source witness exists",
  "do not claim Earth response from Kp alone",
  "do not claim closure from fixture data",
  "do not treat missing data as randomness"
];

export interface ClassifyPacketInputs {
  selectedEvent: EventWitness | null;
  solarImage: SolarImageWitness | null;
  plasma: PlasmaPoint[];
  mag: MagPoint[];
  kp: KpPoint[];
  sourceStatus: Partial<Record<WitnessSource, SourceStatus>>;
  sourceErrors?: Partial<Record<WitnessSource, string | undefined>>;
  eventCandidates?: EventWitness[];
  selectedEventIsExplicit?: boolean;
  solarImageRenderWitness?: SolarImageRenderWitness;
  witnessEvidence?: WitnessEvidence[];
  alignment?: EventCarrierAlignment;
  representationSurfaceResolved?: boolean;
}

function isFallbackEvidence(evidence: WitnessEvidence | undefined) {
  return Boolean(
    evidence?.isFallback ||
      evidence?.evidenceStatus === "cached_snapshot_fallback" ||
      evidence?.evidenceStatus === "fixture_fallback"
  );
}

function evidenceToPacketStatus(
  evidence: WitnessEvidence,
  hasData: boolean
): PacketStatus {
  if (evidence.evidenceStatus === "error") {
    return "source_fetch_failure";
  }

  if (isFallbackEvidence(evidence)) {
    return "fixture_fallback_active";
  }

  if (!hasData || evidence.evidenceStatus === "unavailable") {
    return "unavailable_witness";
  }

  return "frontier_preserved";
}

function evidenceFor(
  evidenceEntries: WitnessEvidence[],
  sourceKey: string,
  fallback: WitnessEvidence
) {
  return (
    evidenceEntries.find((entry) => entry.sourceKey === sourceKey) ?? fallback
  );
}

function inferEvidence(
  sourceKey: string,
  status: SourceStatus | undefined,
  hasData: boolean,
  recordCount: number | null = null,
  latestTimestamp: string | null = null,
  reason: string | null = null
): WitnessEvidence {
  const evidenceStatus: EvidenceStatus =
    status === "fixture"
      ? "fixture_fallback"
      : status === "error"
        ? "error"
        : status === "live" && hasData
          ? "live_parsed"
          : status === "live"
            ? "empty_live"
            : "unavailable";

  return {
    sourceKey,
    evidenceStatus,
    isLive: evidenceStatus === "live_parsed" || evidenceStatus === "empty_live",
    isFallback: evidenceStatus === "fixture_fallback",
    isRenderable: false,
    recordCount,
    latestTimestamp,
    reason
  };
}

function hasFixtureStatus(
  status: Partial<Record<WitnessSource, SourceStatus>>,
  solarImage: SolarImageWitness | null,
  plasma: PlasmaPoint[],
  mag: MagPoint[],
  kp: KpPoint[]
) {
  return (
    Object.values(status).some((value) => value === "fixture") ||
    solarImage?.source === "FIXTURE" ||
    solarImage?.metadataStatus === "fixture" ||
    solarImage?.imageFetchStatus === "fixture" ||
    plasma.some((point) => point.source === "FIXTURE") ||
    mag.some((point) => point.source === "FIXTURE") ||
    kp.some((point) => point.source === "FIXTURE")
  );
}

function hasSourceFetchFailure(status: Partial<Record<WitnessSource, SourceStatus>>) {
  return Object.values(status).some((value) => value === "error");
}

function solarImagePacketStatus(
  solarImage: SolarImageWitness | null,
  renderStatus: RenderStatus,
  packetResolved: boolean
): PacketStatus {
  if (!solarImage?.imageUrl || renderStatus === "missing_url") {
    return "unavailable_witness";
  }

  if (renderStatus === "render_error") {
    return "unavailable_witness";
  }

  if (
    solarImage.source === "FIXTURE" ||
    solarImage.metadataStatus === "fixture" ||
    solarImage.imageFetchStatus === "fixture"
  ) {
    return "fixture_fallback_active";
  }

  if (packetResolved && renderStatus === "rendered") {
    return "resolved";
  }

  return "frontier_preserved";
}

function hasNonzeroNaturalDimensions(
  renderWitness: SolarImageRenderWitness | null
) {
  return (
    (renderWitness?.naturalWidth ?? 0) > 0 &&
    (renderWitness?.naturalHeight ?? 0) > 0
  );
}

function hasZeroNaturalDimensions(renderWitness: SolarImageRenderWitness | null) {
  return (
    renderWitness?.status === "rendered" &&
    (renderWitness.naturalWidth === 0 || renderWitness.naturalHeight === 0)
  );
}

function inferSolarEvidence(
  solarImage: SolarImageWitness | null,
  renderWitness: SolarImageRenderWitness | undefined,
  hasImageUrl: boolean,
  imageRendered: boolean
): WitnessEvidence {
  if (!solarImage) {
    return inferEvidence(
      "HELIOVIEWER",
      "unavailable",
      false,
      0,
      null,
      "Solar image witness is unavailable."
    );
  }

  if (!hasImageUrl || renderWitness?.status === "missing_url") {
    return {
      sourceKey: "HELIOVIEWER",
      evidenceStatus: "unavailable",
      isLive: false,
      isFallback: false,
      isRenderable: false,
      recordCount: 0,
      latestTimestamp: solarImage.timestamp,
      reason: "Solar image witness has no renderable image URL."
    };
  }

  if (renderWitness?.status === "render_error") {
    return {
      sourceKey: "HELIOVIEWER",
      evidenceStatus: "error",
      isLive: false,
      isFallback: solarImage.isFallbackImage,
      isRenderable: false,
      recordCount: 1,
      latestTimestamp: solarImage.timestamp,
      observedAt: renderWitness.observedAt,
      reason: renderWitness.error ?? "Solar image URL failed browser render."
    };
  }

  if (solarImage.isFallbackImage) {
    return {
      sourceKey: "HELIOVIEWER",
      evidenceStatus: solarImage.evidenceStatus,
      isLive: false,
      isFallback: true,
      isRenderable: imageRendered,
      recordCount: 1,
      latestTimestamp: solarImage.timestamp,
      observedAt: renderWitness?.observedAt ?? null,
      reason:
        solarImage.fallbackReason ??
        "Solar image is rendered from fallback, not live Helioviewer witness."
    };
  }

  return {
    sourceKey: "HELIOVIEWER",
    evidenceStatus: imageRendered ? "live_rendered" : solarImage.evidenceStatus,
    isLive: solarImage.isLiveImage,
    isFallback: false,
    isRenderable: imageRendered,
    recordCount: hasImageUrl ? 1 : 0,
    latestTimestamp: solarImage.timestamp,
    observedAt: renderWitness?.observedAt ?? null,
    reason: solarImage.error ?? null
  };
}

export function classifyPacketStatus({
  selectedEvent,
  solarImage,
  plasma,
  mag,
  kp,
  sourceStatus,
  sourceErrors = {},
  eventCandidates = [],
  selectedEventIsExplicit = false,
  solarImageRenderWitness,
  witnessEvidence = [],
  alignment: suppliedAlignment,
  representationSurfaceResolved = true
}: ClassifyPacketInputs): TctPacketStatus {
  const statusReasons: string[] = [];
  const hasSelectedEvent = Boolean(selectedEvent);
  const hasImageUrl = Boolean(solarImage?.imageUrl);
  const renderStatus = solarImageRenderWitness?.status ?? solarImage?.renderStatus ?? "not_attempted";
  const imageRendered =
    renderStatus === "rendered" &&
    hasNonzeroNaturalDimensions(solarImageRenderWitness ?? null);
  const imageZeroDimensions = hasZeroNaturalDimensions(
    solarImageRenderWitness ?? null
  );
  const hasPlasma = plasma.length > 0;
  const hasMag = mag.length > 0;
  const hasKp = kp.length > 0;
  const overlappingEvents = overlappingEventCandidates(selectedEvent, eventCandidates);
  const preservationBoundaryFails =
    overlappingEvents.length > 0 && !selectedEventIsExplicit;
  const sourceFetchFailed = hasSourceFetchFailure(sourceStatus);
  const representationSurfaceStatus: PacketStatus = representationSurfaceResolved
    ? "resolved"
    : "unavailable_witness";
  const solarEvidence = evidenceFor(
    witnessEvidence,
    "HELIOVIEWER",
    inferSolarEvidence(
      solarImage,
      solarImageRenderWitness,
      hasImageUrl,
      imageRendered
    )
  );
  const donkiEvidence = evidenceFor(
    witnessEvidence,
    "NASA_DONKI",
    inferEvidence(
      "NASA_DONKI",
      sourceStatus.NASA_DONKI,
      hasSelectedEvent,
      eventCandidates.length,
      selectedEvent?.startTime ?? null
    )
  );
  const plasmaEvidence = evidenceFor(
    witnessEvidence,
    "NOAA_SWPC_SOLAR_WIND_PLASMA",
    inferEvidence(
      "NOAA_SWPC_SOLAR_WIND_PLASMA",
      sourceStatus.NOAA_SWPC_SOLAR_WIND_PLASMA,
      hasPlasma,
      plasma.length,
      plasma[plasma.length - 1]?.timeTag ?? null
    )
  );
  const magEvidence = evidenceFor(
    witnessEvidence,
    "NOAA_SWPC_SOLAR_WIND_MAG",
    inferEvidence(
      "NOAA_SWPC_SOLAR_WIND_MAG",
      sourceStatus.NOAA_SWPC_SOLAR_WIND_MAG,
      hasMag,
      mag.length,
      mag[mag.length - 1]?.timeTag ?? null
    )
  );
  const kpEvidence = evidenceFor(
    witnessEvidence,
    "NOAA_SWPC_KP",
    inferEvidence(
      "NOAA_SWPC_KP",
      sourceStatus.NOAA_SWPC_KP,
      hasKp,
      kp.length,
      kp[kp.length - 1]?.timeTag ?? null
    )
  );
  const requiredEvidence = [
    solarEvidence,
    donkiEvidence,
    plasmaEvidence,
    magEvidence,
    kpEvidence
  ];
  const alignment =
    suppliedAlignment ??
    evaluateEventCarrierAlignment({
      selectedEvent,
      plasma,
      mag,
      kp,
      solarImageEvidence: solarEvidence,
      donkiEvidence,
      plasmaEvidence,
      magEvidence,
      kpEvidence,
      eventCandidates,
      selectedEventIsExplicit
    });
  const fallbackEvidenceSources = requiredEvidence
    .filter(isFallbackEvidence)
    .map((evidence) => evidence.sourceKey);
  const fixtureActive =
    fallbackEvidenceSources.length > 0 ||
    hasFixtureStatus(sourceStatus, solarImage, plasma, mag, kp);

  if (!hasSelectedEvent) {
    statusReasons.push("No selected solar event packet X.");
  }

  if (sourceStatus.NASA_DONKI === "fixture") {
    statusReasons.push(
      "fixture fallback active: DONKI event record is fixture-backed after source fetch failure."
    );
  }

  for (const [source, error] of Object.entries(sourceErrors)) {
    if (error) {
      statusReasons.push(`${source}: ${error}`);
    }
  }

  if (!hasImageUrl) {
    statusReasons.push("Solar image witness has no renderable image URL.");
  } else if (renderStatus === "render_error") {
    statusReasons.push("Solar image URL failed browser render.");
  } else if (imageZeroDimensions) {
    statusReasons.push(
      "Solar image render witness reported zero natural dimensions."
    );
  } else if (imageRendered) {
    statusReasons.push(
      "Solar image render witness observed with nonzero natural dimensions."
    );
  } else if (renderStatus === "rendered") {
    statusReasons.push(
      "Solar image render status is rendered, but natural dimensions were not observed."
    );
  } else if (!imageRendered) {
    statusReasons.push(
      `Solar image URL exists, but browser render is ${renderStatus}.`
    );
  }

  if (isFallbackEvidence(solarEvidence)) {
    statusReasons.push(
      "Solar image is rendered from fallback, not live Helioviewer witness."
    );
  }

  if (!hasPlasma) {
    statusReasons.push("unavailable witness: L1 plasma carrier has no points.");
  }

  if (!hasMag) {
    statusReasons.push(
      "unavailable witness: L1 magnetometer carrier has no points."
    );
  }

  if (!hasKp) {
    statusReasons.push(
      "frontier preserved: planetary K-index Earth-response marker has no points."
    );
  }

  if (preservationBoundaryFails) {
    statusReasons.push(
      `preservation-boundary failure: ${overlappingEvents.length} event candidate(s) share the carrier window without explicit X selection.`
    );
  } else if (overlappingEvents.length > 0 && selectedEventIsExplicit) {
    statusReasons.push(
      `removable burden: ${overlappingEvents.length} event candidate(s) share the carrier window, but X was explicitly selected.`
    );
  }

  statusReasons.push(`alignment.status: ${alignment.status}.`);

  for (const reason of alignment.supportingReasons.slice(0, 4)) {
    statusReasons.push(`alignment support: ${reason}`);
  }

  for (const reason of alignment.blockingReasons.slice(0, 4)) {
    statusReasons.push(`alignment block: ${reason}`);
  }

  if (fixtureActive) {
    statusReasons.push(
      "fixture fallback active: at least one witness surface is fixture-backed; closure is not claimed from fixture data."
    );
  }

  if (fallbackEvidenceSources.length > 0) {
    statusReasons.push(
      `fixture fallback active: required witness fallback evidence present: ${fallbackEvidenceSources.join(", ")}.`
    );
  }

  const missingRequiredWitness =
    !hasImageUrl ||
    renderStatus === "missing_url" ||
    renderStatus === "render_error" ||
    imageZeroDimensions ||
    !hasPlasma ||
    !hasMag ||
    !hasKp ||
    solarEvidence.evidenceStatus === "unavailable" ||
    solarEvidence.evidenceStatus === "error";
  const hasLiveRequiredEvidence =
    solarEvidence.evidenceStatus === "live_rendered" &&
    donkiEvidence.evidenceStatus === "live_parsed" &&
    plasmaEvidence.evidenceStatus === "live_parsed" &&
    magEvidence.evidenceStatus === "live_parsed" &&
    kpEvidence.evidenceStatus === "live_parsed";

  let measurementClosure: PacketStatus;

  if (!hasSelectedEvent) {
    measurementClosure = "underdeclared";
  } else if (preservationBoundaryFails) {
    measurementClosure = "preservation_boundary_failure";
  } else if (fixtureActive) {
    measurementClosure = "fixture_fallback_active";
  } else if (sourceFetchFailed) {
    measurementClosure = "source_fetch_failure";
  } else if (missingRequiredWitness) {
    measurementClosure = "unavailable_witness";
  } else if (alignment.status === "packet_resolved" && hasLiveRequiredEvidence) {
    measurementClosure = "resolved";
  } else if (
    alignment.status === "earth_response_candidate" ||
    alignment.status === "carrier_signature_candidate" ||
    alignment.status === "source_resolved_only"
  ) {
    measurementClosure = "frontier_preserved";
  } else if (alignment.status === "unresolved_carrier_alignment") {
    measurementClosure = "unresolved_carrier_alignment";
  } else if (alignment.status === "preservation_boundary_failure") {
    measurementClosure = "preservation_boundary_failure";
  } else if (alignment.status === "underdeclared") {
    measurementClosure = "underdeclared";
  } else {
    measurementClosure = "frontier_preserved";
  }

  const imageStatus = solarImagePacketStatus(
    solarImage,
    imageZeroDimensions ? "render_error" : renderStatus,
    measurementClosure === "resolved"
  );
  const donkiStatus = selectedEvent
    ? evidenceToPacketStatus(donkiEvidence, true)
    : "underdeclared";
  const plasmaStatus = evidenceToPacketStatus(plasmaEvidence, hasPlasma);
  const magStatus = evidenceToPacketStatus(magEvidence, hasMag);
  const kpStatus = evidenceToPacketStatus(kpEvidence, hasKp);
  const alignmentClosure: PacketStatus =
    alignment.status === "packet_resolved"
      ? "resolved"
      : alignment.status === "preservation_boundary_failure"
        ? "preservation_boundary_failure"
        : alignment.status === "unresolved_carrier_alignment"
          ? "unresolved_carrier_alignment"
          : alignment.status === "underdeclared"
            ? "underdeclared"
            : "frontier_preserved";
  const alignmentEvidence: EvidenceStatus =
    alignment.status === "packet_resolved" ||
    alignment.status === "earth_response_candidate" ||
    alignment.status === "carrier_signature_candidate" ||
    alignment.status === "source_resolved_only"
      ? "live_parsed"
      : "unavailable";

  if (measurementClosure === "resolved") {
    statusReasons.push(
      "packet closure resolved: selected event, rendered solar image witness, L1 plasma, L1 magnetometer, Kp marker, and event-carrier signature alignment are present."
    );
  } else if (
    measurementClosure === "frontier_preserved" &&
    selectedEvent &&
    hasImageUrl &&
    imageRendered &&
    hasPlasma &&
    hasMag &&
    hasKp
  ) {
    statusReasons.push(
      "Resolved requires live witnesses plus carrier-signature and Earth-response features. Source data existing inside a broad window is only frontier-preserved."
    );
  } else if (statusReasons.length === 0) {
    statusReasons.push(
      "frontier preserved: selected event and carrier witnesses exist, but v1 does not claim stronger packet closure."
    );
  }

  return {
    C: TCT_C,
    thetaC: TCT_THETA_C,
    selectedEventId: selectedEvent?.id ?? null,
    invariant: TCT_INVARIANT,
    preservationBoundary: TCT_BOUNDARY,
    measurementClosure,
    representationSurfaceStatus,
    alignment,
    statusReasons,
    witnessRoles: [
      witnessRole(
        "solar image witness",
        "HELIOVIEWER",
        sourceStatus.HELIOVIEWER ?? "unavailable",
        solarEvidence.evidenceStatus,
        "fixed_witness",
        imageStatus
      ),
      witnessRole(
        "DONKI event record",
        "NASA_DONKI",
        sourceStatus.NASA_DONKI ?? "unavailable",
        donkiEvidence.evidenceStatus,
        "fixed_witness",
        donkiStatus
      ),
      witnessRole(
        "L1 plasma carrier trace",
        "NOAA_SWPC_SOLAR_WIND_PLASMA",
        sourceStatus.NOAA_SWPC_SOLAR_WIND_PLASMA ?? "unavailable",
        plasmaEvidence.evidenceStatus,
        "target_forced_carrier",
        plasmaStatus
      ),
      witnessRole(
        "L1 magnetometer carrier trace",
        "NOAA_SWPC_SOLAR_WIND_MAG",
        sourceStatus.NOAA_SWPC_SOLAR_WIND_MAG ?? "unavailable",
        magEvidence.evidenceStatus,
        "target_forced_carrier",
        magStatus
      ),
      witnessRole(
        "planetary K-index Earth-response marker",
        "NOAA_SWPC_KP",
        sourceStatus.NOAA_SWPC_KP ?? "unavailable",
        kpEvidence.evidenceStatus,
        "measurement_closure",
        kpStatus
      ),
      witnessRole(
        "Γ_C dashboard alignment/control relation",
        "dashboard",
        "live",
        alignmentEvidence,
        "control_relation",
        alignmentClosure
      ),
      witnessRole(
        "Rem_r display-only metadata",
        "dashboard",
        "live",
        "live_parsed",
        "removable_burden",
        "frontier_preserved"
      ),
      witnessRole(
        "downstream representation surface",
        "Solar Earth Watch UI",
        "live",
        representationSurfaceResolved ? "live_rendered" : "unavailable",
        "downstream_surface",
        representationSurfaceStatus
      )
    ]
  };
}
