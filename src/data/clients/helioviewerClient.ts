import helioviewerFixture from "../fixtures/helioviewer.fixture.json";
import {
  buildHelioviewerClosestImageUrl,
  buildHelioviewerScreenshotUrl,
  HELIOVIEWER_CONFIG,
  normalizeHelioviewerMetadata
} from "../normalize/normalizeHelioviewer";
import type { SolarImageWitness, SourceResult, SourceStatus } from "../types";
import { fetchJson } from "../../utils/fetchJson";

const IMAGE_RETRY_OFFSETS_MINUTES = [30, 120, 360, 720];

function targetImageTimes(): string[] {
  return IMAGE_RETRY_OFFSETS_MINUTES.map((minutes) =>
    new Date(Date.now() - minutes * 60 * 1000).toISOString()
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "source fetch failure: unknown Helioviewer fetch error";
}

function baseWitness(
  timestamp: string | null,
  metadataStatus: SourceStatus,
  error: string | null = null
): SolarImageWitness {
  return {
    imageUrl: null,
    timestamp,
    sourceId: HELIOVIEWER_CONFIG.sourceId,
    observatory: HELIOVIEWER_CONFIG.observatory,
    instrument: HELIOVIEWER_CONFIG.instrument,
    measurement: HELIOVIEWER_CONFIG.measurement,
    metadataStatus,
    imageFetchStatus: "unavailable",
    renderStatus: "not_attempted",
    error,
    source: "HELIOVIEWER"
  };
}

async function fetchImageUrl(url: string, timeoutMs = 12000): Promise<void> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "image/*,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`source fetch failure: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      throw new Error(
        `source fetch failure: expected image content but received ${contentType}`
      );
    }

    await response.arrayBuffer();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.startsWith("source fetch failure:")
          ? error.message
          : `source fetch failure: ${error.message}`
        : "source fetch failure: unknown Helioviewer image fetch error";
    throw new Error(message);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function fetchSolarImage(): Promise<
  SourceResult<SolarImageWitness | null>
> {
  let lastError = "source fetch failure: Helioviewer image URL unavailable";
  let lastMetadataStatus: SourceStatus = "unavailable";

  for (const candidateTime of targetImageTimes()) {
    let metadataWitness: SolarImageWitness | null = null;

    try {
      const metadata = await fetchJson<unknown>(
        buildHelioviewerClosestImageUrl(candidateTime),
        {
          timeoutMs: 12000
        }
      );

      metadataWitness = normalizeHelioviewerMetadata(metadata);
      lastMetadataStatus = "live";
    } catch (error) {
      lastMetadataStatus = lastMetadataStatus === "live" ? "live" : "error";
      lastError = errorMessage(error);
    }

    const timestamp = metadataWitness?.timestamp ?? candidateTime;
    const imageUrl = buildHelioviewerScreenshotUrl(timestamp);

    try {
      await fetchImageUrl(imageUrl);

      return {
        status: "live",
        data: {
          ...(metadataWitness ??
            baseWitness(
              timestamp,
              lastMetadataStatus,
              lastMetadataStatus === "error" ? lastError : null
            )),
          imageUrl,
          timestamp,
          metadataStatus: lastMetadataStatus,
          imageFetchStatus: "live",
          renderStatus: "not_attempted",
          source: "HELIOVIEWER"
        }
      };
    } catch (error) {
      lastError = errorMessage(error);
    }
  }

  return {
    status: "fixture",
    data: {
      ...(helioviewerFixture as SolarImageWitness),
      metadataStatus: lastMetadataStatus,
      imageFetchStatus: "fixture",
      renderStatus: "not_attempted",
      error: lastError,
      source: "FIXTURE"
    },
    error: lastError
  };
}
