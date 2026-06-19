import type {
  EventWitness,
  KpPoint,
  MagPoint,
  PlasmaPoint,
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
}

function hasFixtureStatus(status: Partial<Record<WitnessSource, SourceStatus>>) {
  return Object.values(status).some((value) => value === "fixture");
}

function firstBlockingStatus(statuses: PacketStatus[]): PacketStatus | null {
  const priority: PacketStatus[] = [
    "underdeclared",
    "fixture_fallback_active",
    "source_fetch_failure",
    "preservation_boundary_failure",
    "unavailable_witness",
    "unresolved_carrier_alignment",
    "frontier_preserved"
  ];

  return priority.find((status) => statuses.includes(status)) ?? null;
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
  selectedEventIsExplicit = false
}: ClassifyPacketInputs): TctPacketStatus {
  const statusReasons: string[] = [];
  const blockingStatuses: PacketStatus[] = [];
  const imageExists = Boolean(solarImage?.imageUrl);
  const plasmaExists = plasma.length > 0;
  const magExists = mag.length > 0;
  const kpExists = kp.length > 0;
  const carrierAligned = hasCarrierAlignment(selectedEvent, plasma, mag);
  const overlappingEvents = overlappingEventCandidates(selectedEvent, eventCandidates);
  const preservationBoundaryFails =
    overlappingEvents.length > 0 && !selectedEventIsExplicit;

  if (!selectedEvent) {
    blockingStatuses.push("underdeclared");
    statusReasons.push("No selected solar event packet X.");
  }

  if (sourceStatus.NASA_DONKI === "fixture") {
    blockingStatuses.push("fixture_fallback_active");
    statusReasons.push(
      "fixture fallback active: DONKI event record is fixture-backed after source fetch failure."
    );
  }

  for (const [source, error] of Object.entries(sourceErrors)) {
    if (error) {
      statusReasons.push(`${source}: ${error}`);
    }
  }

  if (!imageExists) {
    blockingStatuses.push("unavailable_witness");
    statusReasons.push("unavailable witness: solar image witness is missing.");
  }

  if (!plasmaExists) {
    blockingStatuses.push("unavailable_witness");
    statusReasons.push("unavailable witness: L1 plasma carrier has no points.");
  }

  if (!magExists) {
    blockingStatuses.push("unavailable_witness");
    statusReasons.push(
      "unavailable witness: L1 magnetometer carrier has no points."
    );
  }

  if (!kpExists) {
    blockingStatuses.push("frontier_preserved");
    statusReasons.push(
      "frontier preserved: planetary K-index Earth-response marker has no points."
    );
  }

  if (preservationBoundaryFails) {
    blockingStatuses.push("preservation_boundary_failure");
    statusReasons.push(
      `preservation-boundary failure: ${overlappingEvents.length} event candidate(s) share the carrier window without explicit X selection.`
    );
  }

  if (selectedEvent && plasmaExists && magExists && !carrierAligned) {
    blockingStatuses.push("unresolved_carrier_alignment");
    statusReasons.push(
      "unresolved carrier alignment: plasma and magnetometer points do not both occur inside X to X+96h."
    );
  }

  if (hasFixtureStatus(sourceStatus)) {
    blockingStatuses.push("fixture_fallback_active");
    statusReasons.push(
      "fixture fallback active: at least one witness surface is fixture-backed; closure is not claimed from fixture data."
    );
  }

  const readyForResolved =
    selectedEvent &&
    imageExists &&
    plasmaExists &&
    magExists &&
    kpExists &&
    carrierAligned &&
    !preservationBoundaryFails &&
    !hasFixtureStatus(sourceStatus);

  const measurementClosure: PacketStatus = readyForResolved
    ? "resolved"
    : firstBlockingStatus(blockingStatuses) ?? "frontier_preserved";

  if (measurementClosure === "frontier_preserved" && statusReasons.length === 0) {
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
    statusReasons,
    witnessRoles: [
      witnessRole(
        "solar image witness",
        "HELIOVIEWER",
        "fixed_witness",
        sourceStatusToPacketStatus(sourceStatus.HELIOVIEWER, imageExists)
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
          plasmaExists
        )
      ),
      witnessRole(
        "L1 magnetometer carrier trace",
        "NOAA_SWPC_SOLAR_WIND_MAG",
        "target_forced_carrier",
        sourceStatusToPacketStatus(sourceStatus.NOAA_SWPC_SOLAR_WIND_MAG, magExists)
      ),
      witnessRole(
        "planetary K-index Earth-response marker",
        "NOAA_SWPC_KP",
        "measurement_closure",
        kpExists
          ? sourceStatusToPacketStatus(sourceStatus.NOAA_SWPC_KP, kpExists)
          : "frontier_preserved"
      ),
      witnessRole(
        "Γ_C dashboard alignment/control relation",
        "dashboard",
        "control_relation",
        carrierAligned ? "frontier_preserved" : "unresolved_carrier_alignment"
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
        measurementClosure
      )
    ]
  };
}
