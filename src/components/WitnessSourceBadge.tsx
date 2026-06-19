import type { EvidenceStatus, RenderStatus, SourceStatus } from "../data/types";

interface WitnessSourceBadgeProps {
  status: SourceStatus | RenderStatus | EvidenceStatus;
  label?: string;
}

export function WitnessSourceBadge({ status, label }: WitnessSourceBadgeProps) {
  return (
    <span className={`source-badge source-badge--${status}`}>
      <span aria-hidden="true" />
      {label ? `${label}: ` : ""}
      {status}
    </span>
  );
}
