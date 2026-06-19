import type { KpPoint, SourceStatus } from "../data/types";
import { shortUtc } from "../utils/dateRange";
import { compactNumber } from "../utils/number";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface KpPanelProps {
  points: KpPoint[];
  status: SourceStatus;
}

export function KpPanel({ points, status }: KpPanelProps) {
  const recent = points.slice(-8);
  const latest = recent.at(-1) ?? null;

  return (
    <section className="panel kp-panel">
      <div className="panel-heading">
        <div>
          <h2>Planetary K-index</h2>
          <p>Earth-response marker, not packet authority</p>
        </div>
        <WitnessSourceBadge status={status} label="NOAA_SWPC_KP" />
      </div>

      {!latest ? (
        <EmptyState
          title="frontier preserved"
          detail="Kp marker is absent; the packet is not failed by Kp alone."
        />
      ) : (
        <>
          <div className="kp-latest">
            <span>latest Kp</span>
            <strong>{compactNumber(latest.kp, 2)}</strong>
            <small>{shortUtc(latest.timeTag)}</small>
          </div>
          <div className="kp-sequence" aria-label="Recent Kp sequence">
            {recent.map((point) => (
              <div className="kp-tile" key={point.timeTag}>
                <strong>{compactNumber(point.kp, 2)}</strong>
                <span>{shortUtc(point.timeTag)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
