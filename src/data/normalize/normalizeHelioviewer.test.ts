import { describe, expect, it } from "vitest";
import {
  buildHelioviewerScreenshotUrl,
  HELIOVIEWER_CONFIG,
  normalizeHelioviewerMetadata
} from "./normalizeHelioviewer";

describe("normalize Helioviewer witnesses", () => {
  it("keeps getClosestImage metadata separate from the rendered image URL", () => {
    const witness = normalizeHelioviewerMetadata({
      date: "2026-06-15T01:39:00Z"
    });

    expect(witness.imageUrl).toBeNull();
    expect(witness.timestamp).toBe("2026-06-15T01:39:00Z");
    expect(witness.metadataStatus).toBe("live");
    expect(witness.imageFetchStatus).toBe("unavailable");
  });

  it("builds a takeScreenshot URL with display enabled", () => {
    const url = new URL(
      buildHelioviewerScreenshotUrl("2026-06-15T01:39:00Z"),
      "http://localhost"
    );

    expect(url.pathname).toBe("/api/helioviewer/v2/takeScreenshot/");
    expect(url.searchParams.get("display")).toBe("true");
  });

  it("builds a full-disk screenshot ROI", () => {
    const url = new URL(
      buildHelioviewerScreenshotUrl("2026-06-15T01:39:00Z"),
      "http://localhost"
    );

    expect(url.searchParams.get("x1")).toBe("-1228.8");
    expect(url.searchParams.get("x2")).toBe("1228.8");
    expect(url.searchParams.get("y1")).toBe("-1228.8");
    expect(url.searchParams.get("y2")).toBe("1228.8");
  });

  it("uses the SDO AIA 171 layer identity", () => {
    const url = new URL(
      buildHelioviewerScreenshotUrl("2026-06-15T01:39:00Z"),
      "http://localhost"
    );

    expect(url.searchParams.get("layers")).toBe(HELIOVIEWER_CONFIG.screenshotLayers);
    expect(url.searchParams.get("layers")).toBe("[SDO,AIA,AIA,171,1,100]");
  });
});
