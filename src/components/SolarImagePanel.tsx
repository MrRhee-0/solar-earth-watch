import { useState } from "react";
import type { SolarImageWitness, SourceStatus } from "../data/types";
import { formatUtcTimestamp } from "../utils/dateRange";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface SolarImagePanelProps {
  image: SolarImageWitness | null;
  status: SourceStatus;
}

export function SolarImagePanel({ image, status }: SolarImagePanelProps) {
  const [failed, setFailed] = useState(false);
  const imageReady = Boolean(image?.imageUrl) && !failed;

  return (
    <section className="panel solar-image-panel">
      <div className="panel-heading">
        <div>
          <h2>Solar Image Witness</h2>
          <p>{image?.observatory ?? "Helioviewer"} / {image?.instrument ?? "source"} / {image?.measurement ?? "measurement"}</p>
        </div>
        <WitnessSourceBadge status={status} label={image?.source ?? "HELIOVIEWER"} />
      </div>

      {imageReady ? (
        <figure className="solar-image-frame">
          <img
            src={image?.imageUrl ?? ""}
            alt="Recent Sun image witness"
            onError={() => setFailed(true)}
          />
          <figcaption>
            <span>UTC {formatUtcTimestamp(image?.timestamp)}</span>
            <span>sourceId {image?.sourceId ?? "unavailable witness"}</span>
          </figcaption>
        </figure>
      ) : (
        <EmptyState
          title="unavailable witness"
          detail="Solar image witness is missing or failed to render."
        />
      )}
    </section>
  );
}
