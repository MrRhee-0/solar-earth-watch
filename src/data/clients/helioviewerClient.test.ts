import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSolarImage } from "./helioviewerClient";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function imageHeadResponse(status = 200) {
  return new Response(null, {
    status,
    headers: {
      "content-type": "image/png",
      "content-length": status === 200 ? "3" : "0"
    }
  });
}

describe("Helioviewer client strategy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T16:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses getClosestImage returned timestamp for screenshot date", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("getClosestImage")) {
        return jsonResponse({ date: "2026-06-19T15:24:00Z" });
      }

      expect(init?.method).toBe("HEAD");
      const screenshotUrl = new URL(url, "http://localhost");
      expect(screenshotUrl.searchParams.get("date")).toBe(
        "2026-06-19T15:24:00Z"
      );
      expect(screenshotUrl.searchParams.get("_t")).toBe(String(Date.now()));
      return imageHeadResponse();
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSolarImage();

    expect(result.status).toBe("live");
    expect(result.data?.timestamp).toBe("2026-06-19T15:24:00Z");
    expect(result.data?.evidenceStatus).toBe("live_parsed");
    expect(result.data?.isLiveImage).toBe(true);
  });

  it("does not use raw now as the only screenshot date", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("getClosestImage")) {
        expect(new URL(url, "http://localhost").searchParams.get("date")).toBe(
          "2026-06-19T15:30:00.000Z"
        );
        return jsonResponse({ date: "2026-06-19T15:18:00Z" });
      }

      const screenshotUrl = new URL(url, "http://localhost");
      expect(screenshotUrl.searchParams.get("date")).toBe(
        "2026-06-19T15:18:00Z"
      );
      return imageHeadResponse();
    });

    vi.stubGlobal("fetch", fetchMock);

    await fetchSolarImage();
  });

  it("keeps trying fallback date candidates after a 404 screenshot", async () => {
    const closestDates = ["2026-06-19T15:20:00Z", "2026-06-19T13:55:00Z"];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("getClosestImage")) {
        return jsonResponse({ date: closestDates.shift() });
      }

      const screenshotDate = new URL(url, "http://localhost").searchParams.get(
        "date"
      );

      if (screenshotDate === "2026-06-19T15:20:00Z") {
        return imageHeadResponse(404);
      }

      return imageHeadResponse();
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSolarImage();

    expect(result.status).toBe("live");
    expect(result.data?.timestamp).toBe("2026-06-19T13:55:00Z");
    expect(result.data?.attemptedUrls).toHaveLength(2);
    expect(result.data?.isFallbackImage).toBe(false);
  });

  it("chooses fallback only after all live screenshot attempts fail", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("getClosestImage")) {
        const targetDate = new URL(url, "http://localhost").searchParams.get(
          "date"
        );
        return jsonResponse({ date: targetDate });
      }

      return imageHeadResponse(404);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSolarImage();

    expect(result.status).toBe("fixture");
    expect(result.data?.isFallbackImage).toBe(true);
    expect(result.data?.isLiveImage).toBe(false);
    expect(result.data?.evidenceStatus).toBe("fixture_fallback");
    expect(result.data?.attemptedUrls).toHaveLength(5);
    expect(result.error).toContain("HTTP 404");
  });
});
