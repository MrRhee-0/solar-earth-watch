import type { RenderStatus, SourceStatus } from "../data/types";
import type { TctPacketStatus } from "../tct/packetTypes";

export interface SourceDiagnostics {
  helioviewerMetadataStatus: SourceStatus;
  helioviewerImageFetchStatus: SourceStatus;
  helioviewerRenderStatus: RenderStatus;
  imageUrl: string | null;
  proxiedImageUrl: string | null;
  remoteHelioviewerEndpointPath: string | null;
  imageUrlBeginsWithApiHelioviewer: boolean;
  displayTruePresent: boolean;
  layersContainSdoAia171: boolean;
  naturalWidth: number | null;
  naturalHeight: number | null;
  clientWidth: number | null;
  clientHeight: number | null;
  renderObservedAt: string | null;
  renderError: string | null;
  donkiStatus: SourceStatus;
  plasmaStatus: SourceStatus;
  magStatus: SourceStatus;
  kpStatus: SourceStatus;
  selectedEventId: string | null;
  alignmentPassed: boolean;
  carrierWindowStart: string | null;
  carrierWindowEnd: string | null;
}

interface PacketStatusPanelProps {
  packet: TctPacketStatus;
  diagnostics: SourceDiagnostics;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`packet-status packet-status--${value}`}>{value}</span>;
}

function diagnosticRows(diagnostics: SourceDiagnostics) {
  return [
    ["Helioviewer metadata status", diagnostics.helioviewerMetadataStatus],
    ["Helioviewer image URL status", diagnostics.helioviewerImageFetchStatus],
    ["Helioviewer render status", diagnostics.helioviewerRenderStatus],
    ["imageUrl", diagnostics.imageUrl ?? "missing_url"],
    ["Proxied image URL", diagnostics.proxiedImageUrl ?? "missing_url"],
    [
      "Remote Helioviewer endpoint path",
      diagnostics.remoteHelioviewerEndpointPath ?? "unavailable"
    ],
    [
      "image URL begins with /api/helioviewer",
      String(diagnostics.imageUrlBeginsWithApiHelioviewer)
    ],
    ["display=true present", String(diagnostics.displayTruePresent)],
    [
      "layers contains SDO,AIA,AIA,171",
      String(diagnostics.layersContainSdoAia171)
    ],
    ["naturalWidth", diagnostics.naturalWidth?.toString() ?? "unobserved"],
    ["naturalHeight", diagnostics.naturalHeight?.toString() ?? "unobserved"],
    ["clientWidth", diagnostics.clientWidth?.toString() ?? "unobserved"],
    ["clientHeight", diagnostics.clientHeight?.toString() ?? "unobserved"],
    ["render observed at", diagnostics.renderObservedAt ?? "unobserved"],
    ["render error", diagnostics.renderError ?? "none"],
    ["DONKI status", diagnostics.donkiStatus],
    ["SWPC plasma status", diagnostics.plasmaStatus],
    ["SWPC mag status", diagnostics.magStatus],
    ["Kp status", diagnostics.kpStatus],
    ["selected event id", diagnostics.selectedEventId ?? "not selected"],
    ["alignment passed", String(diagnostics.alignmentPassed)],
    ["carrier window start", diagnostics.carrierWindowStart ?? "unavailable"],
    ["carrier window end", diagnostics.carrierWindowEnd ?? "unavailable"]
  ] as const;
}

export function PacketStatusPanel({ packet, diagnostics }: PacketStatusPanelProps) {
  const statusReasons =
    packet.statusReasons.length > 0
      ? packet.statusReasons
      : packet.measurementClosure === "resolved"
        ? ["packet closure resolved."]
        : [`${packet.measurementClosure}: packet closure reason unavailable.`];

  return (
    <section className="panel packet-panel">
      <div className="panel-heading">
        <div>
          <h2>TCT Packet Status</h2>
          <p>Γ_C downstream alignment/control relation</p>
        </div>
        <StatusPill value={packet.measurementClosure} />
      </div>

      <div className="packet-block">
        <span>C</span>
        <p>{packet.C}</p>
      </div>

      <div className="packet-block">
        <span>Θ_C</span>
        <ul>
          {packet.thetaC.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="packet-block">
        <span>X</span>
        <p>{packet.selectedEventId ?? "not selected"}</p>
      </div>

      <div className="packet-columns">
        <div className="packet-block">
          <span>Inv^(r)(X)</span>
          <ul>
            {packet.invariant.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="packet-block">
          <span>B_r(X)</span>
          <ul>
            {packet.preservationBoundary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="packet-block">
        <span>Θ_meas(X) packet closure</span>
        <StatusPill value={packet.measurementClosure} />
      </div>

      <div className="packet-block packet-block--surface">
        <span>Representation surface</span>
        <StatusPill value={packet.representationSurfaceStatus} />
        <p>Resolved representation does not imply resolved witness packet.</p>
      </div>

      <div className="packet-block">
        <span>status reasons</span>
        <ul>
          {statusReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <details className="packet-diagnostics">
        <summary>Source diagnostics</summary>
        <dl>
          {diagnosticRows(diagnostics).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="witness-table" role="table" aria-label="Witness role table">
        <div role="row" className="witness-table__head">
          <span role="columnheader">label</span>
          <span role="columnheader">source</span>
          <span role="columnheader">role</span>
          <span role="columnheader">status</span>
        </div>
        {packet.witnessRoles.map((row) => (
          <div role="row" key={`${row.label}-${row.role}`} className="witness-table__row">
            <span role="cell">{row.label}</span>
            <span role="cell">{row.source}</span>
            <span role="cell">{row.role}</span>
            <span role="cell">
              <StatusPill value={row.status} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
