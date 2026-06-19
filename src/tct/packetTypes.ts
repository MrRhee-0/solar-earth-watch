export type PacketStatus =
  | "resolved"
  | "frontier_preserved"
  | "underdeclared"
  | "unavailable_witness"
  | "source_fetch_failure"
  | "fixture_fallback_active"
  | "preservation_boundary_failure"
  | "unresolved_carrier_alignment";

export type WitnessRole =
  | "fixed_witness"
  | "preserved_relation"
  | "target_forced_carrier"
  | "removable_burden"
  | "control_relation"
  | "measurement_closure"
  | "downstream_surface"
  | "failure";

export interface TctPacketStatus {
  C: string;
  thetaC: string[];
  selectedEventId: string | null;
  invariant: string[];
  preservationBoundary: string[];
  measurementClosure: PacketStatus;
  representationSurfaceStatus: PacketStatus;
  statusReasons: string[];
  witnessRoles: Array<{
    label: string;
    source: string;
    role: WitnessRole;
    status: PacketStatus;
  }>;
}
