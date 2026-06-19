import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
  RenderStatus,
  SolarImageRenderWitness,
  SolarImageWitness,
  SourceStatus,
  WitnessSource
} from "../data/types";
import { hasCarrierAlignment, overlappingEventCandidates } from "./alignment";
import type { PacketStatus, TctPacketStatus } from "./packetTypes";
import { sourceStatusToPacketStatus, witnessRole } from "./classifyWitness";

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
  representationSurfaceResolved?: boolean;
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
  const alignmentPassed = selectedEvent
    ? hasCarrierAlignment(selectedEvent, plasma, mag)
    : false;
  const overlappingEvents = overlappingEventCandidates(selectedEvent, eventCandidates);
  const preservationBoundaryFails =
    overlappingEvents.length > 0 && !selectedEventIsExplicit;
  const fixtureActive = hasFixtureStatus(sourceStatus, solarImage, plasma, mag, kp);
  const sourceFetchFailed = hasSourceFetchFailure(sourceStatus);
  const representationSurfaceStatus: PacketStatus = representationSurfaceResolved
    ? "resolved"
    : "unavailable_witness";

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

  if (
    selectedEvent &&
    hasImageUrl &&
    imageRendered &&
    hasPlasma &&
    hasMag &&
    hasKp &&
    !alignmentPassed
  ) {
    statusReasons.push(
      "Required witnesses exist, but event-carrier alignment is not yet closure-sufficient."
    );
  }

  if (fixtureActive) {
    statusReasons.push(
      "fixture fallback active: at least one witness surface is fixture-backed; closure is not claimed from fixture data."
    );
  }

  const missingRequiredWitness =
    !hasImageUrl ||
    renderStatus === "missing_url" ||
    renderStatus === "render_error" ||
    imageZeroDimensions ||
    !hasPlasma ||
    !hasMag ||
    (!hasKp && !hasImageUrl && !hasPlasma && !hasMag);
  const readyForResolved =
    hasSelectedEvent &&
    hasImageUrl &&
    imageRendered &&
    hasPlasma &&
    hasMag &&
    hasKp &&
    alignmentPassed &&
    !preservationBoundaryFails &&
    !fixtureActive &&
    !sourceFetchFailed;

  let measurementClosure: PacketStatus;

  if (!hasSelectedEvent) {
    measurementClosure = "underdeclared";
  } else if (preservationBoundaryFails) {
    measurementClosure = "preservation_boundary_failure";
  } else if (missingRequiredWitness) {
    measurementClosure = "unavailable_witness";
  } else if (sourceFetchFailed) {
    measurementClosure = "source_fetch_failure";
  } else if (fixtureActive) {
    measurementClosure = "fixture_fallback_active";
  } else if (readyForResolved) {
    measurementClosure = "resolved";
  } else {
    measurementClosure = "frontier_preserved";
  }

  const imageStatus = solarImagePacketStatus(
    solarImage,
    imageZeroDimensions ? "render_error" : renderStatus,
    measurementClosure === "resolved"
  );

  if (measurementClosure === "resolved") {
    statusReasons.push(
      "packet closure resolved: selected event, rendered solar image witness, L1 plasma, L1 magnetometer, Kp marker, and carrier-window alignment are present."
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
    statusReasons,
    witnessRoles: [
      witnessRole(
        "solar image witness",
        "HELIOVIEWER",
        "fixed_witness",
        imageStatus
      ),
      witnessRole(
        "DONKI event record",
        "NASA_DONKI",
        "fixed_witness",
        selectedEvent
          ? sourceStatusToPacketStatus(sourceStatus.NASA_DONKI, true)
          : "underdeclared"
      ),
      witnessRole(
        "L1 plasma carrier trace",
        "NOAA_SWPC_SOLAR_WIND_PLASMA",
        "target_forced_carrier",
        sourceStatusToPacketStatus(
          sourceStatus.NOAA_SWPC_SOLAR_WIND_PLASMA,
          hasPlasma
        )
      ),
      witnessRole(
        "L1 magnetometer carrier trace",
        "NOAA_SWPC_SOLAR_WIND_MAG",
        "target_forced_carrier",
        sourceStatusToPacketStatus(sourceStatus.NOAA_SWPC_SOLAR_WIND_MAG, hasMag)
      ),
      witnessRole(
        "planetary K-index Earth-response marker",
        "NOAA_SWPC_KP",
        "measurement_closure",
        hasKp
          ? sourceStatusToPacketStatus(sourceStatus.NOAA_SWPC_KP, hasKp)
          : hasImageUrl || hasPlasma || hasMag
            ? "frontier_preserved"
            : "unavailable_witness"
      ),
      witnessRole(
        "Γ_C dashboard alignment/control relation",
        "dashboard",
        "control_relation",
        alignmentPassed ? "frontier_preserved" : "unresolved_carrier_alignment"
      ),
      witnessRole(
        "Rem_r display-only metadata",
        "dashboard",
        "removable_burden",
        "frontier_preserved"
      ),
      witnessRole(
        "downstream representation surface",
        "Solar Earth Watch UI",
        "downstream_surface",
        representationSurfaceStatus
      )
    ]
  };
}
