import type { TctPacketStatus } from "../tct/packetTypes";

interface PacketStatusPanelProps {
  packet: TctPacketStatus;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`packet-status packet-status--${value}`}>{value}</span>;
}

export function PacketStatusPanel({ packet }: PacketStatusPanelProps) {
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
        <span>Θ_meas(X)</span>
        <StatusPill value={packet.measurementClosure} />
      </div>

      <div className="packet-block">
        <span>status reasons</span>
        <ul>
          {packet.statusReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

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
