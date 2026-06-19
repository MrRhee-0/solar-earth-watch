import helioviewerFixture from "../fixtures/helioviewer.fixture.json";
import {
  buildHelioviewerClosestImageUrl,
  buildHelioviewerScreenshotUrl,
  HELIOVIEWER_CONFIG,
  normalizeHelioviewerMetadata
} from "../normalize/normalizeHelioviewer";
import type { SolarImageWitness, SourceResult, SourceStatus } from "../types";
import { fetchJson } from "../../utils/fetchJson";

const IMAGE_RETRY_OFFSETS_MINUTES = [30, 120, 360, 720, 1440];

export interface ImageValidationResult {
  ok: boolean;
  status?: number;
  contentType?: string | null;
  byteSize?: number | null;
  error?: string | null;
}

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

function validationFailureReason(result: ImageValidationResult): string {
  if (result.error) {
    return result.error;
  }

  if (result.status && result.status >= 400) {
    return `source fetch failure: HTTP ${result.status}`;
  }

  if (result.contentType && !result.contentType.toLowerCase().includes("image/")) {
    return `source fetch failure: expected image content but received ${result.contentType}`;
  }

  if (result.byteSize !== null && result.byteSize !== undefined && result.byteSize <= 0) {
    return "source fetch failure: Helioviewer image response had zero bytes.";
  }

  return "source fetch failure: Helioviewer image validation failed.";
}

async function inspectImageResponse(
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number
): Promise<ImageValidationResult> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "image/*,*/*"
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const contentLength = response.headers.get("content-length");
    const byteSizeFromHeader = contentLength ? Number(contentLength) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        contentType,
        byteSize: byteSizeFromHeader,
        error: `source fetch failure: HTTP ${response.status}`
      };
    }

    if (!contentType.toLowerCase().includes("image/")) {
      return {
        ok: false,
        status: response.status,
        contentType,
        byteSize: byteSizeFromHeader,
        error: `source fetch failure: expected image content but received ${contentType || "unknown content type"}`
      };
    }

    if (method === "HEAD" && byteSizeFromHeader && byteSizeFromHeader > 0) {
      return {
        ok: true,
        status: response.status,
        contentType,
        byteSize: byteSizeFromHeader
      };
    }

    if (method === "HEAD") {
      return {
        ok: false,
        status: response.status,
        contentType,
        byteSize: byteSizeFromHeader,
        error: "source fetch failure: HEAD did not expose positive image byte size."
      };
    }

    const bytes = await response.arrayBuffer();
    const byteSize = bytes.byteLength;

    return {
      ok: byteSize > 0,
      status: response.status,
      contentType,
      byteSize,
      error:
        byteSize > 0
          ? null
          : "source fetch failure: Helioviewer image response had zero bytes."
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `source fetch failure: ${error.message}`
          : "source fetch failure: unknown Helioviewer image validation error"
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function validateImageUrl(
  url: string,
  timeoutMs = 12000
): Promise<ImageValidationResult> {
  const headResult = await inspectImageResponse(url, "HEAD", timeoutMs);

  if (headResult.ok) {
    return headResult;
  }

  return inspectImageResponse(url, "GET", timeoutMs);
}

function fallbackWitness(
  attemptedUrls: string[],
  fallbackReason: string,
  metadataStatus: SourceStatus
): SolarImageWitness {
  const fixture = helioviewerFixture as SolarImageWitness;

  return {
    ...fixture,
    metadataStatus,
    imageFetchStatus: fixture.imageFetchStatus ?? "fixture",
    renderStatus: "not_attempted",
    evidenceStatus:
      fixture.source === "CACHE"
        ? "cached_snapshot_fallback"
        : "fixture_fallback",
    isLiveImage: false,
    isFallbackImage: true,
    fallbackReason,
    attemptedUrls,
    selectedUrl: fixture.imageUrl,
    error: fallbackReason,
    source: fixture.source ?? "FIXTURE"
  };
}

export async function fetchSolarImage(): Promise<
  SourceResult<SolarImageWitness | null>
> {
  const attemptedUrls: string[] = [];
  const failureReasons: string[] = [];
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
      failureReasons.push(
        `${buildHelioviewerClosestImageUrl(candidateTime)} -> ${lastError}`
      );
      continue;
    }

    const timestamp = metadataWitness.timestamp ?? candidateTime;
    const imageUrl = buildHelioviewerScreenshotUrl(
      timestamp,
      HELIOVIEWER_CONFIG,
      Date.now()
    );
    attemptedUrls.push(imageUrl);

    const validation = await validateImageUrl(imageUrl);

    if (validation.ok) {
      return {
        status: "live",
        data: {
          ...metadataWitness,
          imageUrl,
          timestamp,
          metadataStatus: lastMetadataStatus,
          imageFetchStatus: "live",
          renderStatus: "not_attempted",
          evidenceStatus: "live_parsed",
          isLiveImage: true,
          isFallbackImage: false,
          fallbackReason: null,
          attemptedUrls,
          selectedUrl: imageUrl,
          error: null,
          source: "HELIOVIEWER"
        }
      };
    }

    lastError = validationFailureReason(validation);
    failureReasons.push(`${imageUrl} -> ${lastError}`);
  }

  const fallbackReason =
    failureReasons.length > 0 ? failureReasons.join(" | ") : lastError;
  const fallback = fallbackWitness(
    attemptedUrls,
    fallbackReason,
    lastMetadataStatus
  );

  return {
    status: "fixture",
    data: fallback,
    error: fallbackReason
  };
}
