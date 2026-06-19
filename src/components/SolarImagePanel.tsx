import { useEffect, useState } from "react";
import type { RenderStatus, SolarImageWitness } from "../data/types";
import { formatUtcTimestamp } from "../utils/dateRange";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface SolarImagePanelProps {
  witness: SolarImageWitness | null;
  onRenderStatusChange?: (status: RenderStatus) => void;
}

function initialRenderStatus(witness: SolarImageWitness | null): RenderStatus {
  if (!witness?.imageUrl) {
    return "missing_url";
  }

  return witness.renderStatus ?? "not_attempted";
}

export function SolarImagePanel({
  witness,
  onRenderStatusChange
}: SolarImagePanelProps) {
  const [renderStatus, setRenderStatus] = useState<RenderStatus>(() =>
    initialRenderStatus(witness)
  );
  const imageUrl = witness?.imageUrl ?? null;
  const imageReady = Boolean(imageUrl) && renderStatus !== "render_error";

  useEffect(() => {
    const nextStatus = imageUrl
      ? witness?.renderStatus === "rendered" ||
        witness?.renderStatus === "render_error"
        ? witness.renderStatus
        : "loading"
      : "missing_url";

    setRenderStatus(nextStatus);
    onRenderStatusChange?.(nextStatus);
  }, [imageUrl, onRenderStatusChange, witness?.renderStatus, witness?.timestamp]);

  const updateRenderStatus = (status: RenderStatus) => {
    setRenderStatus(status);
    onRenderStatusChange?.(status);
  };

  const metadataStatus = witness?.metadataStatus ?? "unavailable";
  const imageFetchStatus = imageUrl
    ? witness?.imageFetchStatus ?? "unavailable"
    : "unavailable";

  return (
    <section className="panel solar-image-panel">
      <div className="panel-heading">
        <div>
          <h2>Solar Image Witness</h2>
          <p>{witness?.observatory ?? "Helioviewer"} / {witness?.instrument ?? "source"} / {witness?.measurement ?? "measurement"}</p>
        </div>
        <div className="source-badge-stack">
          <WitnessSourceBadge
            status={metadataStatus}
            label="HELIOVIEWER METADATA"
          />
          <WitnessSourceBadge
            status={imageFetchStatus}
            label="HELIOVIEWER IMAGE"
          />
          <WitnessSourceBadge status={renderStatus} label="IMAGE RENDER" />
        </div>
      </div>

      {imageReady ? (
        <figure className="solar-image-frame">
          <img
            src={imageUrl ?? ""}
            alt="Recent Sun image witness"
            onLoad={() => updateRenderStatus("rendered")}
            onError={() => updateRenderStatus("render_error")}
          />
          <figcaption>
            <span>UTC {formatUtcTimestamp(witness?.timestamp)}</span>
            <span>sourceId {witness?.sourceId ?? "unavailable witness"}</span>
          </figcaption>
        </figure>
      ) : (
        <>
          <EmptyState
            title="unavailable witness"
            detail={
              renderStatus === "missing_url"
                ? "Solar image witness has no renderable image URL."
                : "Solar image URL failed browser render."
            }
          />
          <p className="failure-classification">
            failure classification: unavailable_witness
          </p>
        </>
      )}

      {renderStatus === "render_error" && imageUrl ? (
        <details className="debug-details">
          <summary>render debug</summary>
          <code>{imageUrl}</code>
        </details>
      ) : null}
    </section>
  );
}
