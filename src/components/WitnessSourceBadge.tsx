import type { RenderStatus, SourceStatus } from "../data/types";

interface WitnessSourceBadgeProps {
  status: SourceStatus | RenderStatus;
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
