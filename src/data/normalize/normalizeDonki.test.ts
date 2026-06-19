import { describe, expect, it } from "vitest";
import { normalizeDonkiEvents } from "./normalizeDonki";

describe("normalize DONKI event witnesses", () => {
  it("normalizes flare events into EventWitness records", () => {
    const events = normalizeDonkiEvents("FLR", [
      {
        flrID: "2026-06-15T01:22:00-FLR-001",
        beginTime: "2026-06-15T01:22Z",
        endTime: "2026-06-15T01:51Z",
        sourceLocation: "N14E32",
        activeRegionNum: 14211,
        linkedEvents: [{ activityID: "2026-06-15T02:06:00-CME-001" }],
        instruments: [{ displayName: "GOES" }]
      }
    ]);

    expect(events[0]).toMatchObject({
      id: "2026-06-15T01:22:00-FLR-001",
      eventType: "FLR",
      startTime: "2026-06-15T01:22Z",
      endTime: "2026-06-15T01:51Z",
      linkedEvents: ["2026-06-15T02:06:00-CME-001"],
      instruments: ["GOES"],
      sourceLocation: "N14E32",
      activeRegionNum: 14211,
      source: "NASA_DONKI"
    });
  });
});
