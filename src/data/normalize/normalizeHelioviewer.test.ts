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
    expect(witness.evidenceStatus).toBe("live_parsed");
    expect(witness.isLiveImage).toBe(false);
  });

  it("normalizes Helioviewer space-separated UTC timestamps", () => {
    const witness = normalizeHelioviewerMetadata({
      date: "2026-06-19 21:46:09"
    });

    expect(witness.timestamp).toBe("2026-06-19T21:46:09Z");
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

  it("adds cache busting outside semantic Helioviewer params", () => {
    const url = new URL(
      buildHelioviewerScreenshotUrl("2026-06-15T01:39:00Z", HELIOVIEWER_CONFIG, 1234),
      "http://localhost"
    );

    expect(url.searchParams.get("date")).toBe("2026-06-15T01:39:00Z");
    expect(url.searchParams.get("_t")).toBe("1234");
  });
});
