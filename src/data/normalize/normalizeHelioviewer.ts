import type { SolarImageWitness } from "../types";

export interface HelioviewerConfig {
  sourceId: number | string;
  observatory: string;
  instrument: string;
  measurement: string;
  screenshotLayers: string;
  apiBasePath: string;
}

export const HELIOVIEWER_CONFIG: HelioviewerConfig = {
  sourceId: 10,
  observatory: "SDO",
  instrument: "AIA",
  measurement: "171",
  screenshotLayers: "[SDO,AIA,AIA,171,1,100]",
  apiBasePath: "/api/helioviewer/v2"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

export function buildHelioviewerScreenshotUrl(
  timestamp: string,
  config = HELIOVIEWER_CONFIG
): string {
  const params = new URLSearchParams({
    date: timestamp,
    imageScale: "2.4204409",
    layers: config.screenshotLayers,
    events: "",
    eventLabels: "false",
    scale: "true",
    scaleType: "earth",
    scaleX: "0",
    scaleY: "0",
    x1: "-1228.8",
    x2: "1228.8",
    y1: "-1228.8",
    y2: "1228.8",
    display: "true",
    watermark: "true"
  });

  return `${config.apiBasePath}/takeScreenshot/?${params.toString()}`;
}

export function buildHelioviewerClosestImageUrl(
  timestamp: string,
  config = HELIOVIEWER_CONFIG
): string {
  const params = new URLSearchParams({
    date: timestamp,
    sourceId: String(config.sourceId)
  });

  return `${config.apiBasePath}/getClosestImage/?${params.toString()}`;
}

export function normalizeHelioviewerMetadata(
  data: unknown,
  config = HELIOVIEWER_CONFIG
): SolarImageWitness {
  const timestamp = isRecord(data)
    ? asString(data.date) ?? asString(data.time) ?? new Date().toISOString()
    : new Date().toISOString();

  return {
    imageUrl: null,
    timestamp,
    sourceId: config.sourceId,
    observatory: config.observatory,
    instrument: config.instrument,
    measurement: config.measurement,
    metadataStatus: "live",
    imageFetchStatus: "unavailable",
    renderStatus: "not_attempted",
    error: null,
    source: "HELIOVIEWER"
  };
}

export function normalizeHelioviewer(
  data: unknown,
  config = HELIOVIEWER_CONFIG
): SolarImageWitness {
  return normalizeHelioviewerMetadata(data, config);
}
