import type { SolarImageWitness } from "../types";

export interface HelioviewerConfig {
  sourceId: number | string;
  observatory: string;
  instrument: string;
  measurement: string;
  screenshotLayers: string;
}

export const HELIOVIEWER_CONFIG: HelioviewerConfig = {
  sourceId: 10,
  observatory: "SDO",
  instrument: "AIA",
  measurement: "171",
  screenshotLayers: "[SDO,AIA,AIA,171,1,100]"
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
    x0: "0",
    y0: "0",
    width: "1024",
    height: "1024",
    display: "true",
    watermark: "false"
  });

  return `https://api.helioviewer.org/v2/takeScreenshot/?${params.toString()}`;
}

export function normalizeHelioviewer(
  data: unknown,
  config = HELIOVIEWER_CONFIG
): SolarImageWitness {
  const timestamp = isRecord(data)
    ? asString(data.date) ?? asString(data.time) ?? new Date().toISOString()
    : new Date().toISOString();

  return {
    imageUrl: buildHelioviewerScreenshotUrl(timestamp, config),
    timestamp,
    sourceId: config.sourceId,
    observatory: config.observatory,
    instrument: config.instrument,
    measurement: config.measurement,
    source: "HELIOVIEWER"
  };
}
