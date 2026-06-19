import type { EventCarrierAlignment } from "../tct/alignment";
import { formatUtcTimestamp } from "../utils/dateRange";
import { compactNumber } from "../utils/number";

interface AlignmentPanelProps {
  alignment: EventCarrierAlignment;
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`packet-status packet-status--${value} source-badge--${value}`}>
      {value}
    </span>
  );
}

function featureValue(value: number | string | null, digits = 1) {
  if (typeof value === "number") {
    return compactNumber(value, digits);
  }

  return value ?? "-";
}

export function AlignmentPanel({ alignment }: AlignmentPanelProps) {
  const carrierWindow = alignment.carrierWindow;

  return (
    <section className="panel alignment-panel">
      <div className="panel-heading">
        <div>
          <h2>Event-Carrier Signature Alignment</h2>
          <p>
            Resolved requires live witnesses plus carrier-signature and Earth-response features.
          </p>
        </div>
        <StatusPill value={alignment.status} />
      </div>

      <div className="alignment-summary">
        <div>
          <span>selected event</span>
          <strong>{alignment.selectedEventId ?? "not selected"}</strong>
        </div>
        <div>
          <span>event type</span>
          <strong>{alignment.eventType ?? "underdeclared"}</strong>
        </div>
        <div>
          <span>alignment score</span>
          <strong>{alignment.alignmentScore}/9</strong>
        </div>
        <div>
          <span>packet gate</span>
          <strong>{alignment.alignmentPassed ? "passed" : "frontier"}</strong>
        </div>
      </div>

      {carrierWindow ? (
        <div className="alignment-window">
          <div>
            <span>carrier window start</span>
            <strong>{formatUtcTimestamp(carrierWindow.start)}</strong>
          </div>
          <div>
            <span>carrier window end</span>
            <strong>{formatUtcTimestamp(carrierWindow.end)}</strong>
          </div>
          <p>{carrierWindow.reason}</p>
        </div>
      ) : (
        <div className="alignment-window alignment-window--missing">
          <p>Carrier window unavailable until a selected event X is declared.</p>
        </div>
      )}

      <div className="alignment-reasons">
        <div>
          <span>supporting reasons</span>
          <ul>
            {alignment.supportingReasons.length > 0 ? (
              alignment.supportingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))
            ) : (
              <li>no supporting carrier signature exposed</li>
            )}
          </ul>
        </div>
        <div>
          <span>blocking reasons</span>
          <ul>
            {alignment.blockingReasons.length > 0 ? (
              alignment.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))
            ) : (
              <li>no blocking alignment reason exposed</li>
            )}
          </ul>
        </div>
      </div>

      <div className="alignment-feature-table" role="table" aria-label="Alignment feature table">
        <div role="row" className="alignment-feature-table__head">
          <span role="columnheader">Feature</span>
          <span role="columnheader">Value</span>
          <span role="columnheader">Unit</span>
          <span role="columnheader">Strength/status</span>
          <span role="columnheader">Reason</span>
        </div>
        {alignment.features.map((feature) => (
          <div role="row" className="alignment-feature-table__row" key={feature.key}>
            <span role="cell">{feature.label}</span>
            <span role="cell">{featureValue(feature.value)}</span>
            <span role="cell">{feature.unit ?? "-"}</span>
            <span role="cell">
              <StatusPill value={feature.status} />
            </span>
            <span role="cell">{feature.reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
