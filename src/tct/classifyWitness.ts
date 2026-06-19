import type { EvidenceStatus, SourceStatus } from "../data/types";
import type { PacketStatus, WitnessRole } from "./packetTypes";

export function sourceStatusToPacketStatus(
  status: SourceStatus | undefined,
  hasData: boolean
): PacketStatus {
  if (status === "fixture") {
    return "fixture_fallback_active";
  }

  if (status === "error") {
    return "source_fetch_failure";
  }

  if (!hasData || status === "unavailable") {
    return "unavailable_witness";
  }

  return "frontier_preserved";
}

export function witnessRole(
  label: string,
  source: string,
  sourceFetch: SourceStatus,
  evidence: EvidenceStatus,
  role: WitnessRole,
  closure: PacketStatus
) {
  return {
    label,
    source,
    sourceFetch,
    evidence,
    role,
    closure,
    status: closure
  };
}
