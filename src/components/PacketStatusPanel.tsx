import type { EvidenceStatus, RenderStatus, SourceStatus } from "../data/types";
import type { AlignmentStatus } from "../tct/alignment";
import type { TctPacketStatus } from "../tct/packetTypes";

export interface SourceDiagnostics {
  helioviewerMetadataStatus: SourceStatus;
  helioviewerImageFetchStatus: SourceStatus;
  helioviewerRenderStatus: RenderStatus;
  helioviewerEvidenceStatus: EvidenceStatus;
  imageUrl: string | null;
  proxiedImageUrl: string | null;
  selectedUrl: string | null;
  attemptedUrlCount: number;
  fallbackReason: string | null;
  isLiveImage: boolean;
  isFallbackImage: boolean;
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
  alignmentStatus: AlignmentStatus;
  alignmentScore: number;
  alignmentPassed: boolean;
  carrierWindowStart: string | null;
  carrierWindowEnd: string | null;
}

interface PacketStatusPanelProps {
  packet: TctPacketStatus;
  diagnostics: SourceDiagnostics;
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`packet-status packet-status--${value} source-badge--${value}`}>
      {value}
    </span>
  );
}

function diagnosticRows(diagnostics: SourceDiagnostics) {
  return [
    ["Helioviewer metadata status", diagnostics.helioviewerMetadataStatus],
    ["Helioviewer image URL status", diagnostics.helioviewerImageFetchStatus],
    ["Helioviewer render status", diagnostics.helioviewerRenderStatus],
    ["Helioviewer evidence status", diagnostics.helioviewerEvidenceStatus],
    ["imageUrl", diagnostics.imageUrl ?? "missing_url"],
    ["Proxied image URL", diagnostics.proxiedImageUrl ?? "missing_url"],
    ["selected URL", diagnostics.selectedUrl ?? "missing_url"],
    ["attempted URL count", String(diagnostics.attemptedUrlCount)],
    ["fallback reason", diagnostics.fallbackReason ?? "none"],
    ["displayed image is live", String(diagnostics.isLiveImage)],
    ["displayed image is fallback", String(diagnostics.isFallbackImage)],
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
    ["alignment status", diagnostics.alignmentStatus],
    ["alignment score", String(diagnostics.alignmentScore)],
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

      <div className="packet-help">
        <strong>Why do witnesses say frontier_preserved?</strong>
        <p>
          The source witness is present, but the selected solar-to-Earth packet is not closure-sufficient yet. Resolved requires live witnesses plus carrier-signature and Earth-response features. Source data existing inside a broad window is only frontier-preserved.
        </p>
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
          <span role="columnheader">Witness</span>
          <span role="columnheader">Source fetch</span>
          <span role="columnheader">Evidence</span>
          <span role="columnheader">TCT role</span>
          <span role="columnheader">TCT closure</span>
        </div>
        {packet.witnessRoles.map((row) => (
          <div role="row" key={`${row.label}-${row.role}`} className="witness-table__row">
            <span role="cell">{row.label}</span>
            <span role="cell">
              <StatusPill value={row.sourceFetch} />
            </span>
            <span role="cell">
              <StatusPill value={row.evidence} />
            </span>
            <span role="cell">{row.role}</span>
            <span role="cell">
              <StatusPill value={row.closure} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
