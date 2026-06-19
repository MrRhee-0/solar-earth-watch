import helioviewerFixture from "../fixtures/helioviewer.fixture.json";
import {
  HELIOVIEWER_CONFIG,
  normalizeHelioviewer
} from "../normalize/normalizeHelioviewer";
import type { SolarImageWitness, SourceResult } from "../types";
import { fetchJson } from "../../utils/fetchJson";

const HELIOVIEWER_CLOSEST_IMAGE_URL =
  "https://api.helioviewer.org/v2/getClosestImage/";

function targetImageTime(): string {
  const fifteenMinutesMs = 15 * 60 * 1000;
  return new Date(Date.now() - fifteenMinutesMs).toISOString();
}

function closestImageUrl(): string {
  const params = new URLSearchParams({
    date: targetImageTime(),
    sourceId: String(HELIOVIEWER_CONFIG.sourceId)
  });

  return `${HELIOVIEWER_CLOSEST_IMAGE_URL}?${params.toString()}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "source fetch failure: unknown Helioviewer fetch error";
}

export async function fetchSolarImage(): Promise<
  SourceResult<SolarImageWitness | null>
> {
  try {
    const data = await fetchJson<unknown>(closestImageUrl(), {
      timeoutMs: 12000
    });

    return {
      status: "live",
      data: normalizeHelioviewer(data)
    };
  } catch (error) {
    return {
      status: "fixture",
      data: helioviewerFixture as SolarImageWitness,
      error: errorMessage(error)
    };
  }
}
