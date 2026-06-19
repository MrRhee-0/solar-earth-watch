import { useCallback, useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import type {
  RenderStatus,
  SolarImageRenderWitness,
  SolarImageWitness
} from "../data/types";
import { formatUtcTimestamp } from "../utils/dateRange";
import { EmptyState } from "./EmptyState";
import { WitnessSourceBadge } from "./WitnessSourceBadge";

interface SolarImagePanelProps {
  witness: SolarImageWitness | null;
  onRenderStatusChange?: (witness: SolarImageRenderWitness) => void;
}

function renderWitness(
  status: RenderStatus,
  error: string | null = null,
  dimensions: Partial<SolarImageRenderWitness> = {}
): SolarImageRenderWitness {
  return {
    status,
    naturalWidth: dimensions.naturalWidth ?? null,
    naturalHeight: dimensions.naturalHeight ?? null,
    clientWidth: dimensions.clientWidth ?? null,
    clientHeight: dimensions.clientHeight ?? null,
    observedAt: dimensions.observedAt ?? null,
    error
  };
}

function initialRenderWitness(
  witness: SolarImageWitness | null
): SolarImageRenderWitness {
  if (!witness?.imageUrl) {
    return renderWitness(
      "missing_url",
      "Solar image witness has no renderable image URL."
    );
  }

  return renderWitness(witness.renderStatus ?? "not_attempted", witness.error ?? null);
}

export function SolarImagePanel({
  witness,
  onRenderStatusChange
}: SolarImagePanelProps) {
  const [renderState, setRenderState] = useState<SolarImageRenderWitness>(() =>
    initialRenderWitness(witness)
  );
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const imageUrl = witness?.imageUrl ?? null;
  const imageReady = Boolean(imageUrl) && renderState.status !== "render_error";

  const emitRenderWitness = useCallback(
    (nextWitness: SolarImageRenderWitness) => {
      setRenderState(nextWitness);
      onRenderStatusChange?.(nextWitness);
    },
    [onRenderStatusChange]
  );

  useEffect(() => {
    const nextStatus: RenderStatus = imageUrl
      ? witness?.renderStatus === "rendered" ||
        witness?.renderStatus === "render_error"
        ? witness.renderStatus
        : "loading"
      : "missing_url";

    emitRenderWitness(
      renderWitness(
        nextStatus,
        nextStatus === "missing_url"
          ? "Solar image witness has no renderable image URL."
          : witness?.error ?? null
      )
    );
  }, [
    emitRenderWitness,
    imageUrl,
    witness?.error,
    witness?.renderStatus,
    witness?.timestamp
  ]);

  useEffect(() => {
    setLoadingOverdue(false);

    if (renderState.status !== "loading") {
      return undefined;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setLoadingOverdue(true);
    }, 10000);

    return () => globalThis.clearTimeout(timeoutId);
  }, [renderState.status, imageUrl]);

  const metadataStatus = witness?.metadataStatus ?? "unavailable";
  const imageFetchStatus = imageUrl
    ? witness?.imageFetchStatus ?? "unavailable"
    : "unavailable";
  const renderMessage =
    renderState.status === "rendered"
      ? "Solar image render witness preserved."
      : renderState.status === "render_error"
        ? "Solar image URL failed browser render."
        : renderState.status === "loading" && loadingOverdue
          ? "Solar image render witness still loading."
          : renderState.status === "missing_url"
            ? "Solar image witness has no renderable image URL."
            : null;

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const dimensions = {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      clientWidth: image.clientWidth,
      clientHeight: image.clientHeight,
      observedAt: new Date().toISOString()
    };

    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      emitRenderWitness(
        renderWitness(
          "render_error",
          "Solar image loaded with zero natural dimensions.",
          dimensions
        )
      );
      return;
    }

    emitRenderWitness(renderWitness("rendered", null, dimensions));
  };

  const handleImageError = () => {
    emitRenderWitness(
      renderWitness("render_error", "Solar image URL failed browser render.", {
        observedAt: new Date().toISOString()
      })
    );
  };

  const openImageInNewTab = () => {
    if (imageUrl) {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  };

  const copyImageUrl = async () => {
    if (!imageUrl || !navigator.clipboard) {
      setCopyStatus("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <section className="panel solar-image-panel">
      <div className="panel-heading">
        <div>
          <h2>Solar Image Witness</h2>
          <p>{witness?.observatory ?? "Helioviewer"} / {witness?.instrument ?? "source"} / {witness?.measurement ?? "measurement"}</p>
        </div>
      </div>

      <div className="render-status-strip" aria-label="Solar image render status">
        <WitnessSourceBadge status={metadataStatus} label="METADATA FETCH" />
        <WitnessSourceBadge status={imageFetchStatus} label="IMAGE FETCH" />
        <WitnessSourceBadge status={renderState.status} label="BROWSER RENDER" />
      </div>

      {imageUrl ? (
        <div className="image-actions">
          <button type="button" className="text-button" onClick={openImageInNewTab}>
            Open image in new tab
          </button>
          <button type="button" className="text-button" onClick={copyImageUrl}>
            Copy image URL
          </button>
          {copyStatus !== "idle" ? (
            <span className="copy-status" role="status">
              {copyStatus}
            </span>
          ) : null}
        </div>
      ) : null}

      {renderMessage ? (
        <p
          className={`render-witness-message render-witness-message--${renderState.status}`}
        >
          {renderMessage}
        </p>
      ) : null}

      {imageReady ? (
        <figure className="solar-image-frame">
          <img
            src={imageUrl ?? ""}
            alt="Recent Sun image witness"
            onLoad={handleImageLoad}
            onError={handleImageError}
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
              renderState.status === "missing_url"
                ? "Solar image witness has no renderable image URL."
                : "Solar image URL failed browser render."
            }
          />
          <p className="failure-classification">
            failure classification: unavailable_witness
          </p>
        </>
      )}

      {renderState.status === "render_error" && imageUrl ? (
        <details className="debug-details">
          <summary>render debug</summary>
          <code>{imageUrl}</code>
          {renderState.error ? <p>{renderState.error}</p> : null}
        </details>
      ) : null}
    </section>
  );
}
